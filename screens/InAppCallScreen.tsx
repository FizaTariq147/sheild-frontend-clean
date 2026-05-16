import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Easing, Platform, Modal, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Audio } from "expo-av";
import { getCallSocket } from "../hooks/useCallSocket";

type InAppCallNavProp = StackNavigationProp<RootStackParamList, "InAppCallScreen">;
type InAppCallRouteProp = RouteProp<RootStackParamList, "InAppCallScreen">;
type Props = { navigation: InAppCallNavProp; route: InAppCallRouteProp };
type CallState = "ringing" | "connecting" | "active" | "ended" | "rejected" | "missed";

const KEYPAD_KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["*", "0", "#"],
];

const InAppCallScreen: React.FC<Props> = ({ navigation, route }) => {
  const {
    serviceName, phoneNumber,
    mode = "outgoing", callerId, receiverId, callType = "audio",
  } = route.params;

  const insets = useSafeAreaInsets();
  const [callState, setCallState]       = useState<CallState>(mode === "incoming" ? "ringing" : "connecting");
  const [isMuted, setIsMuted]           = useState(false);
  const [isSpeaker, setIsSpeaker]       = useState(false);
  const [isOnHold, setIsOnHold]         = useState(false);
  const [showKeypad, setShowKeypad]     = useState(false);
  const [keypadInput, setKeypadInput]   = useState("");
  const [elapsed, setElapsed]           = useState(0);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.8)).current;
  const waveAnims    = useRef(Array.from({ length: 9 }, () => new Animated.Value(0.4))).current;
  const elapsedRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef   = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Current user ─────────────────────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem("user").then((raw) => {
      const user = raw ? JSON.parse(raw) : null;
      if (user?.id) setCurrentUserId(user.id);
    });
  }, []);

  const safeGoBack = () => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace("Dashboard");
  };

  // ── Mute ─────────────────────────────────────────────────────
  const handleMute = async () => {
    try {
      const next = !isMuted;
      setIsMuted(next);
      // expo-av recording mute — if you have an active recording:
      // await recording.setIsMutedAsync(next);
    } catch (e) {
      console.log("Mute error:", e);
    }
  };

  // ── Speaker ──────────────────────────────────────────────────
  const handleSpeaker = async () => {
    try {
      const next = !isSpeaker;
      setIsSpeaker(next);
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        shouldDuckAndroid: false,
        // Route audio to speaker or earpiece
        playThroughEarpieceAndroid: !next,
      });
    } catch (e) {
      console.log("Speaker error:", e);
    }
  };

  // ── Hold ─────────────────────────────────────────────────────
  const handleHold = () => {
    const socket = getCallSocket();
    const next = !isOnHold;
    setIsOnHold(next);
    const peerId = mode === "outgoing" ? receiverId : callerId;
    socket?.emit(next ? "call:hold" : "call:resume", { peerId });
  };

  // ── Keypad key press ─────────────────────────────────────────
  const handleKeyPress = (key: string) => {
    setKeypadInput((prev) => prev + key);
    // DTMF tones would be sent here via WebRTC/Agora in a real implementation
    console.log("DTMF:", key);
  };

  // ── Socket events ─────────────────────────────────────────────
  useEffect(() => {
    const socket = getCallSocket();
    if (!socket) return;

    socket.on("call:accepted", () => setCallState("active"));

    socket.on("call:rejected", () => {
      setCallState("rejected");
      cleanup();
      timeoutRef.current = setTimeout(safeGoBack, 2000);
    });

    socket.on("call:ended", () => {
      setCallState("ended");
      cleanup();
      timeoutRef.current = setTimeout(safeGoBack, 1500);
    });

    socket.on("call:busy", () => {
      setCallState("missed");
      cleanup();
      timeoutRef.current = setTimeout(safeGoBack, 2000);
    });

    socket.on("call:hold", () => setIsOnHold(true));
    socket.on("call:resume", () => setIsOnHold(false));

    if (mode === "outgoing") {
      timeoutRef.current = setTimeout(() => {
        if (callState !== "active") {
          setCallState("missed");
          cleanup();
          socket.emit("call:end", { peerId: receiverId });
          setTimeout(safeGoBack, 1500);
        }
      }, 30000);
    }

    return () => {
      socket.off("call:accepted");
      socket.off("call:rejected");
      socket.off("call:ended");
      socket.off("call:busy");
      socket.off("call:hold");
      socket.off("call:resume");
    };
  }, [currentUserId]);

  // ── Timer ────────────────────────────────────────────────────
  useEffect(() => {
    if (callState === "active") {
      elapsedRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (elapsedRef.current) clearInterval(elapsedRef.current);
    }
    return () => { if (elapsedRef.current) clearInterval(elapsedRef.current); };
  }, [callState]);

  // ── Pulse animation ──────────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.timing(pulseAnim, { toValue: 1.8, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseOpacity, { toValue: 0, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  // ── Wave animation ───────────────────────────────────────────
  useEffect(() => {
    if (callState !== "active" || isOnHold) return;
    const WAVE_HEIGHTS = [10, 22, 30, 18, 34, 18, 30, 22, 10];
    const animations = waveAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 250 + i * 60, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0.15, duration: 250 + i * 60, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, [callState, isOnHold]);

  const cleanup = () => {
    if (elapsedRef.current) clearInterval(elapsedRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  useEffect(() => () => cleanup(), []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const getStatusLabel = (): string => {
    switch (callState) {
      case "ringing":    return mode === "incoming" ? "Incoming call..." : "Ringing...";
      case "connecting": return "Connecting...";
      case "active":     return isOnHold ? "On Hold" : formatTime(elapsed);
      case "ended":      return "Call Ended";
      case "rejected":   return "Call Declined";
      case "missed":     return "No Answer";
    }
  };

  const handleAccept = () => {
    const socket = getCallSocket();
    socket?.emit("call:accept", { callerId, receiverId: currentUserId });
    setCallState("active");
  };

  const handleReject = () => {
    const socket = getCallSocket();
    socket?.emit("call:reject", { callerId });
    setCallState("rejected");
    cleanup();
    setTimeout(safeGoBack, 1500);
  };

  const handleEndCall = () => {
    const socket = getCallSocket();
    const peerId = mode === "outgoing" ? receiverId : callerId;
    socket?.emit("call:end", { peerId });
    setCallState("ended");
    cleanup();
    setTimeout(safeGoBack, 1500);
  };

  const WAVE_HEIGHTS = [10, 22, 30, 18, 34, 18, 30, 22, 10];

  const controls = [
    { icon: isMuted    ? "mic-off"     : "mic",          label: isMuted    ? "Unmute"  : "Mute",    active: isMuted,    onPress: handleMute },
    { icon: isSpeaker  ? "volume-high" : "volume-medium", label: "Speaker",                          active: isSpeaker,  onPress: handleSpeaker },
    { icon: "keypad",                                     label: "Keypad",                           active: showKeypad, onPress: () => setShowKeypad(true) },
    { icon: "pause",                                      label: isOnHold   ? "Resume"  : "Hold",    active: isOnHold,   onPress: handleHold },
  ];

  return (
    <LinearGradient
      colors={["#1a0533", "#2d0a5e", "#4a0a6e", "#7b1a3e"]}
      start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      style={[styles.container, { paddingTop: insets.top }]}
    >
      {/* ── Badge ── */}
      <View style={styles.serviceBadge}>
        <Text style={styles.serviceBadgeText}>
          {mode === "incoming" ? "INCOMING CALL" : "OUTGOING CALL"}
        </Text>
      </View>

      {/* ── Center section ── */}
      <View style={styles.centerSection}>

        {/* Avatar */}
        <View style={styles.avatarWrap}>
          <Animated.View style={[styles.pulseRing, { transform: [{ scale: pulseAnim }], opacity: pulseOpacity }]} />
          <LinearGradient colors={["#ff2d7a", "#9d1af2"]} style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>{serviceName.charAt(0).toUpperCase()}</Text>
          </LinearGradient>
          {callState === "active" && <View style={styles.activeDot} />}
        </View>

        {/* Name / number / status */}
        <Text style={styles.serviceName}>{serviceName}</Text>
        <Text style={styles.phoneNumber}>{phoneNumber}</Text>
        <Text style={[
          styles.callStatusText,
          callState === "ended"                  && { color: "#ff6b6b" },
          callState === "rejected"               && { color: "#ff6b6b" },
          callState === "missed"                 && { color: "#FFC107" },
          callState === "active" && !isOnHold    && { color: "#4CAF50" },
          callState === "active" && isOnHold     && { color: "#FFC107" },
        ]}>
          {getStatusLabel()}
        </Text>

        {/* Muted badge */}
        {isMuted && callState === "active" && (
          <View style={styles.mutedBadge}>
            <Ionicons name="mic-off" size={12} color="#fff" />
            <Text style={styles.mutedBadgeText}>Muted</Text>
          </View>
        )}

        {/* Wave */}
        {callState === "active" && !isOnHold && !isMuted && (
          <View style={styles.waveRow}>
            {waveAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[styles.wavebar, { height: WAVE_HEIGHTS[i], transform: [{ scaleY: anim }], opacity: anim }]}
              />
            ))}
          </View>
        )}

        {/* Muted static wave */}
        {callState === "active" && !isOnHold && isMuted && (
          <View style={styles.waveRow}>
            {WAVE_HEIGHTS.map((h, i) => (
              <View key={i} style={[styles.wavebar, { height: h, opacity: 0.15 }]} />
            ))}
          </View>
        )}

        {/* On hold */}
        {callState === "active" && isOnHold && (
          <View style={styles.holdContainer}>
            <Ionicons name="pause-circle" size={48} color="rgba(255,255,255,0.3)" />
            <Text style={styles.holdText}>Call on hold</Text>
          </View>
        )}

        {/* Connecting dots */}
        {(callState === "ringing" || callState === "connecting") && (
          <View style={styles.dotsRow}>
            {[0, 1, 2].map((i) => <View key={i} style={styles.dot} />)}
          </View>
        )}

        {/* Incoming accept/reject */}
        {mode === "incoming" && callState === "ringing" && (
          <View style={styles.incomingActions}>
            <View style={styles.incomingBtnWrap}>
              <TouchableOpacity onPress={handleReject} activeOpacity={0.8}>
                <LinearGradient colors={["#ff2d7a", "#c41560"]} style={styles.callBtnGradient}>
                  <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.incomingBtnLabel}>Decline</Text>
            </View>
            <View style={styles.incomingBtnWrap}>
              <TouchableOpacity onPress={handleAccept} activeOpacity={0.8}>
                <LinearGradient colors={["#4CAF50", "#2e7d32"]} style={styles.callBtnGradient}>
                  <Ionicons name="call" size={28} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
              <Text style={styles.incomingBtnLabel}>Accept</Text>
            </View>
          </View>
        )}

        {/* Active controls */}
        {callState === "active" && (
          <View style={styles.controlsRow}>
            {controls.map((btn, i) => (
              <TouchableOpacity key={i} style={styles.ctrlBtn} onPress={btn.onPress} activeOpacity={0.7}>
                <View style={[styles.ctrlCircle, btn.active && styles.ctrlCircleActive]}>
                  <Ionicons
                    name={btn.icon as any}
                    size={22}
                    color={btn.active ? "#ff2d7a" : "rgba(255,255,255,0.85)"}
                  />
                </View>
                <Text style={styles.ctrlLabel}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* End call */}
        {!(mode === "incoming" && callState === "ringing") &&
          callState !== "ended" && callState !== "rejected" && callState !== "missed" && (
          <TouchableOpacity style={styles.endCallBtn} onPress={handleEndCall} activeOpacity={0.8}>
            <LinearGradient colors={["#ff2d7a", "#c41560"]} style={styles.endCallGradient}>
              <Ionicons name="call" size={30} color="#fff" style={{ transform: [{ rotate: "135deg" }] }} />
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Ended state */}
        {(callState === "ended" || callState === "rejected" || callState === "missed") && (
          <View style={styles.endedContainer}>
            <Ionicons name="call" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={styles.endedText}>
              {callState === "ended"    ? `Call ended · ${formatTime(elapsed)}` :
               callState === "rejected" ? "Call was declined" : "No answer"}
            </Text>
          </View>
        )}

      </View>{/* end centerSection */}

      {/* ── Keypad Modal ── */}
      <Modal
        visible={showKeypad}
        transparent
        animationType="slide"
        onRequestClose={() => setShowKeypad(false)}
      >
        <View style={styles.keypadOverlay}>
          <View style={styles.keypadSheet}>
            {/* Handle bar */}
            <View style={styles.keypadHandle} />

            <Text style={styles.keypadDisplay}>
              {keypadInput || " "}
            </Text>

            {KEYPAD_KEYS.map((row, ri) => (
              <View key={ri} style={styles.keypadRow}>
                {row.map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={styles.keypadBtn}
                    onPress={() => handleKeyPress(key)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.keypadBtnText}>{key}</Text>
                    <Text style={styles.keypadBtnSub}>
                      {{ "2":"ABC","3":"DEF","4":"GHI","5":"JKL","6":"MNO","7":"PQRS","8":"TUV","9":"WXYZ","0":"+" }[key] ?? ""}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ))}

            {/* Backspace + close row */}
            <View style={styles.keypadRow}>
              <TouchableOpacity
                style={styles.keypadBtn}
                onPress={() => setKeypadInput((p) => p.slice(0, -1))}
                activeOpacity={0.7}
              >
                <Ionicons name="backspace-outline" size={22} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.keypadBtn, styles.keypadCloseBtn]}
                onPress={() => setShowKeypad(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.keypadCloseBtnText}>Close</Text>
              </TouchableOpacity>
              <View style={styles.keypadBtn} />
            </View>
          </View>
        </View>
      </Modal>

    </LinearGradient>
  );
};

export default InAppCallScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 24,
  },
  serviceBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginTop: 20,
    marginBottom: 20,
    alignSelf: "center",
  },
  serviceBadgeText: { color: "rgba(255,255,255,0.75)", fontSize: 11, letterSpacing: 0.5 },

  // ── THE KEY FIX: centerSection wraps everything and centers it ──
  centerSection: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
  },

  avatarWrap: {
    width: 100, height: 100,
    alignItems: "center", justifyContent: "center",
    marginBottom: 20,
  },
  pulseRing: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    borderWidth: 2, borderColor: "rgba(255,45,122,0.5)",
  },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  avatarInitial: { fontSize: 40, fontWeight: "700", color: "#fff" },
  activeDot: {
    position: "absolute", bottom: 2, right: 2,
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: "#4CAF50", borderWidth: 2, borderColor: "#1a0533",
  },

  serviceName: { fontSize: 22, fontWeight: "700", color: "#fff", marginBottom: 5, textAlign: "center" },
  phoneNumber: { fontSize: 18, fontWeight: "500", color: "#ff6baa", letterSpacing: 1, marginBottom: 6, textAlign: "center" },
  callStatusText: { fontSize: 14, color: "rgba(255,255,255,0.55)", marginBottom: 16 },

  mutedBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "rgba(255,45,122,0.25)",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    marginBottom: 12,
  },
  mutedBadgeText: { color: "#fff", fontSize: 11 },

  waveRow: { flexDirection: "row", alignItems: "center", gap: 4, height: 40, marginBottom: 20 },
  wavebar: { width: 4, borderRadius: 3, backgroundColor: "rgba(255,107,170,0.7)" },

  dotsRow: { flexDirection: "row", alignItems: "center", marginBottom: 24, gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "rgba(255,107,170,0.5)" },

  holdContainer: { alignItems: "center", marginBottom: 24 },
  holdText: { color: "rgba(255,255,255,0.4)", fontSize: 14, marginTop: 8 },

  incomingActions: { flexDirection: "row", gap: 60, marginBottom: 28, alignItems: "center" },
  incomingBtnWrap: { alignItems: "center", gap: 10 },
  incomingBtnLabel: { color: "rgba(255,255,255,0.6)", fontSize: 12 },
  callBtnGradient: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },

  controlsRow: { flexDirection: "row", gap: 20, marginBottom: 28 },
  ctrlBtn: { alignItems: "center", gap: 7 },
  ctrlCircle: {
    width: 54, height: 54, borderRadius: 27,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 0.5, borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  ctrlCircleActive: { backgroundColor: "rgba(255,45,122,0.15)", borderColor: "#ff2d7a" },
  ctrlLabel: { color: "rgba(255,255,255,0.5)", fontSize: 10 },

  endCallBtn: {
    ...Platform.select({
      ios: { shadowColor: "#ff2d7a", shadowOpacity: 0.4, shadowRadius: 16 },
      android: { elevation: 8 },
    }),
  },
  endCallGradient: { width: 70, height: 70, borderRadius: 35, alignItems: "center", justifyContent: "center" },

  endedContainer: { alignItems: "center", gap: 12 },
  endedText: { color: "rgba(255,255,255,0.35)", fontSize: 14 },

  // ── Keypad Modal ──
  keypadOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  keypadSheet: {
    backgroundColor: "#1e0a3c",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 36,
    alignItems: "center",
  },
  keypadHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginBottom: 20,
  },
  keypadDisplay: {
    fontSize: 28, fontWeight: "600", color: "#fff",
    letterSpacing: 4, marginBottom: 20,
    minHeight: 40, textAlign: "center",
  },
  keypadRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 12,
  },
  keypadBtn: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  keypadBtnText: { fontSize: 24, fontWeight: "600", color: "#fff" },
  keypadBtnSub: { fontSize: 9, color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginTop: 1 },
  keypadCloseBtn: { backgroundColor: "rgba(255,45,122,0.25)" },
  keypadCloseBtnText: { fontSize: 14, fontWeight: "600", color: "#ff6baa" },
});