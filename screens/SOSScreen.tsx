// screens/SOSScreen.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Platform,
  Linking,
  Alert,
  FlatList,
  ActivityIndicator,
  Share,
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getAuthHeaders from "../helpers/authHeaders";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Ionicons } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import DashboardScreen from "./Dashboard";

type SOSScreenNavProp = StackNavigationProp<RootStackParamList, "SOSScreen">;
type Props = { navigation: SOSScreenNavProp };
type ContactItem = { id?: string; name?: string; phone?: string; email?: string };

const API_BASE_URL = "https://fiza-tariq-shield-backend.hf.space";

// const API_BASE_URL = "http://192.168.10.8:5050";
const STORAGE_KEY_CURRENT_LOCATION = "CURRENT_LOCATION_V1";
const { width: SCREEN_W } = Dimensions.get("window");

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  danger:    "#ff007f",
  dangerDim: "#ff007f",
  dangerGlow:"rgba(255,45,85,0.35)",
  accent:    "#FF6B35",
  safe:      "#6c757d",
  info:      "#0A84FF",
  whatsapp:  "#25D366",
  bg:        "#ffffff",
  surface:   "#ffffff",
  surfaceAlt:"#ffffff",
  border:    "#e9ecef",
  borderBright:"rgba(255,255,255,0.14)",
  textPrimary: "#000",
  textSecondary:"#333",
  textMuted:  "#4E5569",
};

export default function SOSScreen({ navigation }: Props) {
  const [countdown, setCountdown] = useState<number | null>(3);
  const [isCounting, setIsCounting] = useState(true);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationMeta, setLocationMeta] = useState<{ dms?: string; address?: string; timestamp?: string } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);
  const [contacts, setContacts] = useState<ContactItem[] | null>(null);
  const [sendingToContacts, setSendingToContacts] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Animations
  const opacityAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim    = useRef(new Animated.Value(0.92)).current;
  const textScale    = useRef(new Animated.Value(1)).current;
  const pulseAnim    = useRef(new Animated.Value(1)).current;
  const ringAnim     = useRef(new Animated.Value(0)).current;
  const slideUp      = useRef(new Animated.Value(30)).current;

  const COUNT_START = 3;
  const tickPlayer  = useAudioPlayer(require("../assets/sounds/click.mp3"));
  const alarmPlayer = useAudioPlayer(require("../assets/sounds/click.mp3"));
  const countdownIntervalRef = useRef<any>(null);

  // ── Pulsing ring for countdown ─────────────────────────────────────────────
  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    ).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 0,    useNativeDriver: true }),
      ])
    ).start();
  };

  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUserId(user.id);
        }
      } catch (e) { console.warn("setAudioModeAsync failed", e); }

      Animated.parallel([
        Animated.timing(opacityAnim, { toValue: 1, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true }),
        Animated.timing(slideUp,     { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();

      startPulse();
      await loadCanonicalLocationIntoState();
      startCountdown();
      fetchFreshLocationIfNeeded();
    })();

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  // ── Location helpers (unchanged logic) ────────────────────────────────────
  const toDMS = (lat: number, lng: number) => {
    const format = (deg: number, isLat: boolean) => {
      const absolute = Math.abs(deg);
      const degrees = Math.floor(absolute);
      const minutesFloat = (absolute - degrees) * 60;
      const minutes = Math.floor(minutesFloat);
      const seconds = (minutesFloat - minutes) * 60;
      const direction = isLat ? (deg >= 0 ? "N" : "S") : (deg >= 0 ? "E" : "W");
      return `${degrees}°${minutes}'${seconds.toFixed(1)}"${direction}`;
    };
    return `${format(lat, true)} ${format(lng, false)}`;
  };

  const loadCanonicalLocationIntoState = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_CURRENT_LOCATION);
      if (!raw) return;
      const obj = JSON.parse(raw);
      if (obj && typeof obj.latitude === "number" && typeof obj.longitude === "number") {
        setLocation({ latitude: obj.latitude, longitude: obj.longitude });
        setLocationMeta({ dms: obj.dms, address: obj.address, timestamp: obj.timestamp });
      }
    } catch (e) { console.warn("load canonical location failed", e); }
  };

  const fetchFreshLocationIfNeeded = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_CURRENT_LOCATION);
      if (raw) return;
      await fetchAndSaveCurrentLocation();
    } catch (e) { console.warn("fetchFreshLocationIfNeeded fail", e); }
  };

  const fetchAndSaveCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") { setLoadingLocation(false); return; }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocation({ latitude: lat, longitude: lng });
      let address = "";
      try {
        const [place] = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })) || [];
        if (place) {
          const parts = [place.name, place.street, place.city, place.region, place.postalCode, place.country].filter(Boolean);
          address = parts.join(", ");
        }
      } catch (e) { console.warn("reverse geocode failed", e); }
      const dms = toDMS(lat, lng);
      const saved = { latitude: lat, longitude: lng, dms, address, timestamp: new Date().toISOString() };
      setLocationMeta({ dms, address, timestamp: saved.timestamp });
      await AsyncStorage.setItem(STORAGE_KEY_CURRENT_LOCATION, JSON.stringify(saved));
    } catch (e) { console.warn("fetchAndSaveCurrentLocation error", e); }
    finally { setLoadingLocation(false); }
  };

  const playTick = async () => {
    try {
      if (!tickPlayer) return;
      try { tickPlayer.seekTo?.(0); } catch (e) {}
      await tickPlayer.play?.();
    } catch (e) {
      try {
        setTimeout(async () => {
          try { tickPlayer.seekTo?.(0); } catch (err) {}
          await tickPlayer.play?.();
        }, 120);
      } catch {}
    }
  };

  const startCountdown = () => {
    setIsCounting(true);
    setCountdown(COUNT_START);

    Animated.sequence([
      Animated.timing(textScale, { toValue: 1.3, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(textScale, { toValue: 1,   duration: 140, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
    ]).start();
    playTick();

    let tick = COUNT_START;
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    countdownIntervalRef.current = setInterval(async () => {
      tick -= 1;
      if (tick <= 0) {
        try { tickPlayer.seekTo?.(0); } catch (e) {}
        await playTick();
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
        setCountdown(null);
        setIsCounting(false);
        triggerSOS();
      } else {
        setCountdown(tick);
        Animated.sequence([
          Animated.timing(textScale, { toValue: 1.3, duration: 140, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(textScale, { toValue: 1,   duration: 140, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
        ]).start();
        await playTick();
      }
    }, 1000);
  };

  const composeMessage = (
    loc: { latitude: number; longitude: number } | null,
    meta: { dms?: string; address?: string } | null
  ) => {
    if (!loc) return `🚨 SOS — I need help. Location not available.`;
    const maps = `https://www.google.com/maps/search/?api=1&query=${loc.latitude},${loc.longitude}`;
    let lines = [`🚨 SOS — I need help.`, `Location: ${maps}`];
    if (meta?.address) lines.push(`Address: ${meta.address}`);
    else if (meta?.dms) lines.push(`Coords: ${meta.dms}`);
    lines.push(`(Shared from SHEILD app)`);
    return lines.join("\n");
  };

  const triggerSOS = async () => {
    setSendingSos(true);
    try {
      if (!location) {
        await loadCanonicalLocationIntoState();
        if (!location) await fetchAndSaveCurrentLocation();
      }
      const headers = await getAuthHeaders().catch(() => ({}));
      const body = {
        type: "SOS",
        timestamp: new Date().toISOString(),
        location: location ?? null,
        meta: locationMeta ?? null,
      };
      try {
        await fetch(`${API_BASE_URL}/api/alerts`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }).catch((e) => { console.warn("sos post failed", e); });
      } catch (e) { console.warn("sos send error", e); }
      try { alarmPlayer.seekTo?.(0); await alarmPlayer.play?.(); } catch (e) {}
    } finally { setSendingSos(false); }
  };

  const loadContacts = async () => {
    if (contacts) return;
    setContacts(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/contacts`, { headers });
      if (res && res.ok) {
        const text = await res.text();
        let data: any = [];
        try { data = JSON.parse(text); } catch (e) { setContacts([]); return; }
        const contactsList = Array.isArray(data) ? data : data?.contacts || data?.data || [];
        const mappedContacts = contactsList.map((c: any) => ({
          id: c.id || c._id,
          name: c.full_name || c.fullName || c.name || c.phone || "Unknown",
          phone: c.phone || "",
          email: c.email || "",
        }));
        setContacts(mappedContacts);
      } else {
        setContacts([]);
      }
    } catch (e) { console.warn("loadContacts error", e); setContacts([]); }
  };

  const sendSOSViaChat = async (contact: ContactItem) => {
    if (!contact.id || !currentUserId) {
      Alert.alert("Error", "Cannot send message. Missing user or contact information.");
      return;
    }
    setSendingToContacts(true);
    try {
      const headers = await getAuthHeaders();
      const sosMessage = composeMessage(location, locationMeta);
      const res = await fetch(`${API_BASE_URL}/api/chat/${contact.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: sosMessage }),
      });
      if (!res.ok) throw new Error("Failed to send SOS message");
      Alert.alert("Sent", `SOS location sent to ${contact.name || contact.phone} via chat!`);
    } catch (error) {
      Alert.alert("Error", "Failed to send SOS message via chat. Try another method.");
    } finally { setSendingToContacts(false); }
  };

  const shareViaWhatsApp = async () => {
    const msg = composeMessage(location, locationMeta);
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) return Linking.openURL(url);
      return Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } catch (e) { Alert.alert("WhatsApp not available", "Could not open WhatsApp."); }
  };

  const shareNative = async () => {
    const msg = composeMessage(location, locationMeta);
    try { await Share.share({ message: msg }); } catch (e) { console.warn("share failed", e); }
  };

  const sendSmsToPhone = async (phone?: string) => {
    if (!phone) { Alert.alert("No phone number", "Contact has no phone number."); return; }
    const body = composeMessage(location, locationMeta);
    const url = Platform.select({
      ios: `sms:${phone}&body=${encodeURIComponent(body)}`,
      android: `sms:${phone}?body=${encodeURIComponent(body)}`,
    });
    try { if (url) await Linking.openURL(url); }
    catch (e) { Alert.alert("Failed", "Could not open SMS app."); }
  };

  // ── Derived animation values ───────────────────────────────────────────────
  const ringScale   = ringAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 2.2] });
  const ringOpacity = ringAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0.6, 0.2, 0] });

  // ── Contact picker ─────────────────────────────────────────────────────────
  const renderContactsPicker = () => (
    <View style={styles.contactsWrap}>
      <View style={styles.contactsHeader}>
        <View style={styles.contactsHeaderLeft}>
          <View style={styles.contactsBadge}>
            <Ionicons name="people" size={14} color={C.danger} />
          </View>
          <Text style={styles.contactsTitle}>Emergency Contacts</Text>
        </View>
        <TouchableOpacity style={styles.contactsClose} onPress={() => setContacts(null)}>
          <Ionicons name="close" size={16} color={C.textSecondary} />
        </TouchableOpacity>
      </View>

      {contacts === null ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator color={C.danger} size="small" />
          <Text style={styles.loadingText}>Loading contacts…</Text>
        </View>
      ) : contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="person-add-outline" size={28} color={C.textMuted} />
          <Text style={styles.emptyText}>No saved contacts found</Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(it, i) => it.id || it.phone || it.name || String(i)}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.contactRow}>
              <LinearGradient
                colors={[C.danger, C.accent]}
                style={styles.contactAvatar}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.contactInitials}>
                  {(item.name || "?")
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.contactName}>{item.name || "Unknown"}</Text>
                {item.phone ? (
                  <Text style={styles.contactPhone}>{item.phone}</Text>
                ) : null}
              </View>
              <View style={styles.contactActions}>
                <TouchableOpacity
                  style={styles.chatBtn}
                  onPress={() => sendSOSViaChat(item)}
                  disabled={sendingToContacts}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={[C.danger, C.dangerDim]}
                    style={styles.contactBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="chatbubble" size={13} color="#fff" />
                    <Text style={styles.contactBtnText}>Chat</Text>
                  </LinearGradient>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.smsBtn}
                  onPress={() => sendSmsToPhone(item.phone)}
                  activeOpacity={0.75}
                >
                  <LinearGradient
                    colors={[C.info, "#0055CC"]}
                    style={styles.contactBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="mail" size={13} color="#fff" />
                    <Text style={styles.contactBtnText}>SMS</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}
    </View>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      {/* Background: blurred dashboard */}
      <View style={styles.backgroundContainer} pointerEvents="none">
        <DashboardScreen navigation={navigation as any} />
      </View>
      <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />

      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Animated.View
            style={[
              styles.modalCard,
              { transform: [{ scale: scaleAnim }, { translateY: slideUp }] },
            ]}
          >

            {/* ── COUNTING DOWN ── */}
            {isCounting ? (
              <View style={styles.countdownWrap}>
                {/* Top pill */}
                <View style={styles.alertPill}>
                  <View style={styles.alertDot} />
                  <Text style={styles.alertPillText}>EMERGENCY ALERT</Text>
                </View>

                {/* Radial rings */}
                <View style={styles.countRingContainer}>
                  <Animated.View
                    style={[
                      styles.ringOuter,
                      { transform: [{ scale: ringScale }], opacity: ringOpacity },
                    ]}
                  />
                  <Animated.View
                    style={[styles.ringMiddle, { transform: [{ scale: pulseAnim }] }]}
                  />
                  <LinearGradient
                    colors={[C.danger, C.dangerDim]}
                    style={styles.countCircle}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Animated.Text style={[styles.countText, { transform: [{ scale: textScale }] }]}>
                      {countdown ?? ""}
                    </Animated.Text>
                  </LinearGradient>
                </View>

                <Text style={styles.countSubtitle}>SOS TRIGGERING IN</Text>
                <Text style={styles.countSeconds}>{countdown} SECOND{countdown !== 1 ? "S" : ""}</Text>
                <Text style={styles.countNote}>Alert will be sent to emergency contacts</Text>

                <TouchableOpacity
                  style={styles.cancelBtn}
                  activeOpacity={0.82}
                  onPress={() => {
                    setIsCounting(false);
                    setCountdown(null);
                    if (countdownIntervalRef.current) {
                      clearInterval(countdownIntervalRef.current);
                      countdownIntervalRef.current = null;
                    }
                    navigation.goBack();
                  }}
                >
                  <View style={styles.cancelBtnInner}>
                    <Ionicons name="close-circle" size={18} color={C.textSecondary} />
                    <Text style={styles.cancelBtnText}>Cancel Emergency</Text>
                  </View>
                </TouchableOpacity>
              </View>

            ) : (
              /* ── SOS TRIGGERED ── */
              <View style={styles.postWrap}>
                {/* Header */}
                <View style={styles.postHeader}>
                  <LinearGradient
                    colors={[C.danger + "30", C.danger + "08"]}
                    style={styles.sosIconWrap}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="warning" size={24} color={C.danger} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.postTitle}>SOS ACTIVATED</Text>
                    <Text style={styles.postSubtitle}>Emergency signal transmitted</Text>
                  </View>
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>

                {/* Divider */}
                <View style={styles.divider} />

                {/* Location card */}
                <View style={styles.locationBox}>
                  <View style={styles.locationRow}>
                    <View style={styles.locationIconWrap}>
                      <Ionicons name="location" size={16} color={C.safe} />
                    </View>
                    <Text style={styles.locationLabel}>CURRENT LOCATION</Text>
                    {loadingLocation && (
                      <ActivityIndicator size="small" color={C.info} style={{ marginLeft: 8 }} />
                    )}
                  </View>

                  <Text style={styles.locationCoords}>
                    {location
                      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                      : "Acquiring GPS signal…"}
                  </Text>

                  {locationMeta?.dms && (
                    <Text style={styles.locationDms}>{locationMeta.dms}</Text>
                  )}

                  <View style={styles.addressRow}>
                    <Ionicons name="navigate-circle-outline" size={13} color={C.textMuted} />
                    <Text style={styles.locationAddress} numberOfLines={2}>
                      {locationMeta?.address
                        ?? (loadingLocation ? "Resolving address…" : "Address unavailable")}
                    </Text>
                  </View>
                </View>

                {/* ── Primary CTA ── */}
                <TouchableOpacity
                  style={styles.primaryBtn}
                  activeOpacity={0.82}
                  onPress={async () => { await loadContacts(); }}
                >
                  <LinearGradient
                    colors={[C.danger, C.dangerDim]}
                    style={styles.primaryBtnGrad}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Ionicons name="people" size={20} color="#fff" />
                    <Text style={styles.primaryBtnText}>Notify Emergency Contacts</Text>
                    <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.6)" />
                  </LinearGradient>
                </TouchableOpacity>

                {/* ── Secondary CTAs ── */}
                <View style={styles.secondaryRow}>
                  <TouchableOpacity style={styles.secondaryBtn} onPress={shareViaWhatsApp} activeOpacity={0.8}>
                    <View style={styles.secondaryBtnInner}>
                      <View style={[styles.secondaryIcon, { backgroundColor: C.whatsapp + "20" }]}>
                        <Ionicons name="logo-whatsapp" size={18} color={C.whatsapp} />
                      </View>
                      <Text style={styles.secondaryBtnText}>WhatsApp</Text>
                    </View>
                  </TouchableOpacity>

                  <View style={styles.secondarySep} />

                  <TouchableOpacity style={styles.secondaryBtn} onPress={shareNative} activeOpacity={0.8}>
                    <View style={styles.secondaryBtnInner}>
                      <View style={[styles.secondaryIcon, { backgroundColor: C.info + "20" }]}>
                        <Ionicons name="share-social" size={18} color={C.info} />
                      </View>
                      <Text style={styles.secondaryBtnText}>Share</Text>
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Contacts picker (expanded when contacts !== null) */}
                {contacts !== null && renderContactsPicker()}

                {/* Close */}
                <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()} activeOpacity={0.8}>
                  <Text style={styles.closeBtnText}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  backgroundContainer: {
    position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
  },
  safe: { flex: 1, backgroundColor: "transparent" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Modal card ──────────────────────────────────────────────────────────────
  modalCard: {
    width: SCREEN_W * 0.91,
    maxHeight: "88%",
    backgroundColor: C.surface,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 22,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.borderBright,
    shadowColor: C.danger,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 20,
    overflow: "hidden",
  },

  // ── Countdown ───────────────────────────────────────────────────────────────
  countdownWrap: { alignItems: "center", width: "100%", paddingVertical: 8 },
  alertPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.danger + "22",
    borderWidth: 1,
    borderColor: C.danger + "55",
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 7,
    marginBottom: 32,
  },
  alertDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: C.danger,
  },
  alertPillText: {
    color: C.danger,
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 1.8,
  },

  countRingContainer: {
    width: 180,
    height: 180,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  ringOuter: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: C.danger,
  },
  ringMiddle: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 1.5,
    borderColor: C.danger + "55",
  },
  countCircle: {
    width: 110,
    height: 110,
    borderRadius: 55,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: C.danger,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 24,
    elevation: 12,
  },
  countText: {
    fontSize: 62,
    fontWeight: "900",
    color: "#fff",
    includeFontPadding: false,
  },

  countSubtitle: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2.5,
    marginBottom: 4,
  },
  countSeconds: {
   color: "#ff007f",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 8,
  },
  countNote: {
    color: C.textSecondary,
    fontSize: 13,
    marginBottom: 32,
    textAlign: "center",
  },

  cancelBtn: {
    width: "100%",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surfaceAlt,
    overflow: "hidden",
  },
  cancelBtnInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  cancelBtnText: {
    color: C.textSecondary,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // ── Post-trigger ─────────────────────────────────────────────────────────────
  postWrap: { width: "100%", alignItems: "center" },

  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    gap: 12,
    marginBottom: 16,
  },
  sosIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.danger + "40",
  },
  postTitle: {
    color: C.textPrimary,
    fontWeight: "900",
    fontSize: 17,
    letterSpacing: 1.2,
  },
  postSubtitle: {
    color: C.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  liveBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: C.danger + "22",
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: C.danger + "44",
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: C.danger,
  },
  liveText: {
    color: C.danger,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },

  divider: {
    width: "100%",
    height: 1,
    backgroundColor: C.border,
    marginBottom: 16,
  },

  // ── Location box ─────────────────────────────────────────────────────────────
  locationBox: {
    width: "100%",
    backgroundColor: C.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 10,
  },
  locationIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.safe + "20",
    justifyContent: "center",
    alignItems: "center",
  },
  locationLabel: {
    flex: 1,
    color: C.safe,
    fontWeight: "800",
    fontSize: 10,
    letterSpacing: 2,
  },
  locationCoords: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    marginBottom: 4,
  },
  locationDms: {
    color: C.textSecondary,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 8,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
  },
  locationAddress: {
    flex: 1,
    color: C.textMuted,
    fontSize: 12,
    lineHeight: 17,
  },

  // ── Primary button ──────────────────────────────────────────────────────────
  primaryBtn: {
    width: "100%",
    borderRadius: 16,
    overflow: "hidden",
    marginBottom: 10,
    shadowColor: C.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  primaryBtnText: {
    flex: 1,
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.3,
  },

  // ── Secondary buttons ────────────────────────────────────────────────────────
  secondaryRow: {
    flexDirection: "row",
    width: "100%",
    backgroundColor: C.surfaceAlt,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 14,
    overflow: "hidden",
  },
  secondaryBtn: { flex: 1, paddingVertical: 14 },
  secondaryBtnInner: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  secondaryIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryBtnText: {
    color: C.textPrimary,
    fontWeight: "700",
    fontSize: 13,
  },
  secondarySep: {
    width: 1,
    marginVertical: 10,
    backgroundColor: C.border,
  },

  // ── Contacts picker ──────────────────────────────────────────────────────────
  contactsWrap: {
    width: "100%",
    maxHeight: 280,
    backgroundColor: C.surfaceAlt,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: C.borderBright,
    marginBottom: 12,
  },
  contactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  contactsHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  contactsBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: C.danger + "22",
    justifyContent: "center",
    alignItems: "center",
  },
  contactsTitle: { color: C.textPrimary, fontWeight: "800", fontSize: 14 },
  contactsClose: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: C.border,
    justifyContent: "center",
    alignItems: "center",
  },

  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  loadingText: { color: C.textSecondary, fontSize: 13 },

  emptyState: { alignItems: "center", gap: 8, padding: 20 },
  emptyText: { color: C.textMuted, fontSize: 13 },

  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  contactAvatar: {
    width: 38,
    height: 38,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  contactInitials: { color: "#fff", fontWeight: "800", fontSize: 13 },
  contactName: { color: C.textPrimary, fontWeight: "700", fontSize: 13 },
  contactPhone: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  contactActions: { flexDirection: "row", gap: 6 },
  chatBtn: { borderRadius: 10, overflow: "hidden" },
  smsBtn: { borderRadius: 10, overflow: "hidden" },
  contactBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  contactBtnText: { color: "#fff", fontSize: 11, fontWeight: "700" },

  // ── Close ────────────────────────────────────────────────────────────────────
  closeBtn: {
    width: "100%",
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: C.surfaceAlt,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: "center",
    marginTop: 2,
  },
  closeBtnText: { color: C.textSecondary, fontWeight: "700", fontSize: 14 },
});