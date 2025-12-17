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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { useAudioPlayer, setAudioModeAsync } from "expo-audio";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getAuthHeaders from "../helpers/authHeaders";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Ionicons } from "@expo/vector-icons";
// Import DashboardScreen component
import { BlurView } from "expo-blur";
import DashboardScreen from "./Dashboard";

type SOSScreenNavProp = StackNavigationProp<RootStackParamList, "SOSScreen">;
type Props = { navigation: SOSScreenNavProp };
type ContactItem = { id?: string; name?: string; phone?: string; email?: string };

const API_BASE_URL = "http://192.168.100.12:5050";
const STORAGE_KEY_CURRENT_LOCATION = "CURRENT_LOCATION_V1";

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

  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const textScale = useRef(new Animated.Value(1)).current;

  const COUNT_START = 3;

  const tickPlayer = useAudioPlayer(require("../assets/sounds/click.mp3"));
  const alarmPlayer = useAudioPlayer(require("../assets/sounds/click.mp3"));

  const countdownIntervalRef = useRef<any>(null);

  useEffect(() => {
    (async () => {
      try {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: false,
        });

        // Load current user ID
        const userStr = await AsyncStorage.getItem("user");
        if (userStr) {
          const user = JSON.parse(userStr);
          setCurrentUserId(user.id);
        }
      } catch (e) {
        console.warn("setAudioModeAsync failed", e);
      }

      Animated.timing(opacityAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }).start();

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
    } catch (e) {
      console.warn("load canonical location failed", e);
    }
  };

  const fetchFreshLocationIfNeeded = async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY_CURRENT_LOCATION);
      if (raw) return;
      await fetchAndSaveCurrentLocation();
    } catch (e) {
      console.warn("fetchFreshLocationIfNeeded fail", e);
    }
  };

  const fetchAndSaveCurrentLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLoadingLocation(false);
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      setLocation({ latitude: lat, longitude: lng });

      let address = "";
      try {
        const [place] = (await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })) || [];
        if (place) {
          const parts = [
            place.name || "",
            place.street || "",
            place.city || "",
            place.region || "",
            place.postalCode || "",
            place.country || "",
          ].filter(Boolean);
          address = parts.join(", ");
        }
      } catch (e) {
        console.warn("reverse geocode failed", e);
      }

      const dms = toDMS(lat, lng);
      const saved = {
        latitude: lat,
        longitude: lng,
        dms,
        address,
        timestamp: new Date().toISOString(),
      };
      setLocationMeta({ dms, address, timestamp: saved.timestamp });
      await AsyncStorage.setItem(STORAGE_KEY_CURRENT_LOCATION, JSON.stringify(saved));
    } catch (e) {
      console.warn("fetchAndSaveCurrentLocation error", e);
    } finally {
      setLoadingLocation(false);
    }
  };

  const playTick = async () => {
    try {
      if (!tickPlayer) return;
      try {
        tickPlayer.seekTo?.(0);
      } catch (e) {}
      await tickPlayer.play?.();
    } catch (e) {
      try {
        setTimeout(async () => {
          try {
            tickPlayer.seekTo?.(0);
          } catch (err) {}
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
      Animated.timing(textScale, { toValue: 1, duration: 140, easing: Easing.in(Easing.ease), useNativeDriver: true }),
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
        try {
          tickPlayer.seekTo?.(0);
        } catch (e) {}
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
          Animated.timing(textScale, { toValue: 1, duration: 140, easing: Easing.in(Easing.ease), useNativeDriver: true }),
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
        }).catch((e) => {
          console.warn("sos post failed", e);
        });
      } catch (e) {
        console.warn("sos send error", e);
      }

      try {
        alarmPlayer.seekTo?.(0);
        await alarmPlayer.play?.();
      } catch (e) {}
    } finally {
      setSendingSos(false);
    }
  };

  const loadContacts = async () => {
    if (contacts) return;
    setContacts(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/contacts`, { headers });
      
      if (res && res.ok) {
        const text = await res.text();
        console.log("Raw contacts response:", text); // Debug log
        
        let data: any = [];
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.warn("Failed to parse contacts JSON:", e);
          setContacts([]);
          return;
        }
        
        const contactsList = Array.isArray(data) ? data : data?.contacts || data?.data || [];
        console.log("Parsed contacts list:", contactsList); // Debug log
        
        // Map backend contacts to include full_name as name
        const mappedContacts = contactsList.map((c: any) => {
          const name = c.full_name || c.fullName || c.name || "";
          console.log("Mapping contact:", { original: c, mapped_name: name }); // Debug log
          
          return {
            id: c.id || c._id,
            name: name || c.phone || "Unknown",
            phone: c.phone || "",
            email: c.email || "",
          };
        });
        
        console.log("Final mapped contacts:", mappedContacts); // Debug log
        setContacts(mappedContacts);
      } else {
        console.warn("Contacts fetch failed with status:", res.status);
        setContacts([]);
      }
    } catch (e) {
      console.warn("loadContacts error", e);
      setContacts([]);
    }
  };

  // Send SOS message via in-app chat
  const sendSOSViaChat = async (contact: ContactItem) => {
    if (!contact.id || !currentUserId) {
      Alert.alert("Error", "Cannot send message. Missing user or contact information.");
      return;
    }

    setSendingToContacts(true);
    try {
      const headers = await getAuthHeaders();
      const sosMessage = composeMessage(location, locationMeta);

      // Send message via chat API
      const res = await fetch(`${API_BASE_URL}/api/chat/${contact.id}/messages`, {
        method: "POST",
        headers,
        body: JSON.stringify({ text: sosMessage }),
      });

      if (!res.ok) {
        throw new Error("Failed to send SOS message");
      }

      Alert.alert("Success", `SOS location sent to ${contact.name || contact.phone} via chat!`);
    } catch (error) {
      console.error("Send SOS via chat error:", error);
      Alert.alert("Error", "Failed to send SOS message via chat. Try another method.");
    } finally {
      setSendingToContacts(false);
    }
  };

  const shareViaWhatsApp = async () => {
    const msg = composeMessage(location, locationMeta);
    const maa = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    try {
      const supported = await Linking.canOpenURL(maa);
      if (supported) return Linking.openURL(maa);
      return Linking.openURL(`https://wa.me/?text=${encodeURIComponent(msg)}`);
    } catch (e) {
      Alert.alert("WhatsApp not available", "Could not open WhatsApp.");
    }
  };

  const shareNative = async () => {
    const msg = composeMessage(location, locationMeta);
    try {
      await Share.share({ message: msg });
    } catch (e) {
      console.warn("share failed", e);
    }
  };

  const sendSmsToPhone = async (phone?: string) => {
    if (!phone) {
      Alert.alert("No phone number", "Contact has no phone number.");
      return;
    }
    const body = composeMessage(location, locationMeta);
    const url = Platform.select({
      ios: `sms:${phone}&body=${encodeURIComponent(body)}`,
      android: `sms:${phone}?body=${encodeURIComponent(body)}`,
    });
    try {
      if (url) await Linking.openURL(url);
    } catch (e) {
      Alert.alert("Failed", "Could not open SMS app.");
    }
  };

  const renderContactsPicker = () => {
    return (
      <View style={styles.contactsWrap}>
        <View style={styles.contactsHeader}>
          <Text style={styles.contactsTitle}>Choose contacts to notify</Text>
          <TouchableOpacity onPress={() => setContacts(null)}>
            <Ionicons name="close" size={24} color="#666" />
          </TouchableOpacity>
        </View>

        {contacts === null ? (
          <View style={{ padding: 12 }}>
            <ActivityIndicator color="#ff007f" />
          </View>
        ) : contacts.length === 0 ? (
          <View style={{ padding: 12 }}>
            <Text style={{ color: "#666" }}>No saved contacts.</Text>
          </View>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(it, i) => it.id || it.phone || it.name || String(i)}
            renderItem={({ item }) => (
              <View style={styles.contactRow}>
                <View style={styles.contactAvatar}>
                  <Text style={styles.contactInitials}>
                    {(item.name || "?")
                      .split(" ")
                      .map((w) => w[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactName}>{item.name || "Unknown"}</Text>
                  <Text style={styles.contactPhone}>{item.phone || "No phone"}</Text>
                </View>
                <View style={styles.contactActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => sendSOSViaChat(item)}
                    disabled={sendingToContacts}
                  >
                    <Ionicons name="chatbubble" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.smsButton]}
                    onPress={() => sendSmsToPhone(item.phone)}
                  >
                    <Ionicons name="mail" size={18} color="#fff" />
                    <Text style={styles.actionButtonText}>SMS</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* DashboardScreen in the background */}
      <View style={styles.backgroundContainer}>
        <DashboardScreen navigation={navigation as any} />
      </View>
        <BlurView
        intensity={80} // Adjust blur intensity (0-100)
        tint="dark" // Can be "light", "dark", or "default"
        style={StyleSheet.absoluteFill}
      />
      {/* SOS Modal Overlay */}
      <SafeAreaView style={styles.safe}>
        <Animated.View style={[styles.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[styles.modalCard, { transform: [{ scale: scaleAnim }] }]}>
            {isCounting ? (
              <View style={styles.countdownWrap}>
                <Animated.Text style={[styles.countText, { transform: [{ scale: textScale }] }]}>
                  {countdown ?? ""}
                </Animated.Text>
                <Text style={styles.countSubtitle}>SOS will trigger automatically</Text>
                <Text style={styles.smallNote}>Tap below to cancel</Text>
                <TouchableOpacity
                  style={styles.cancelBtn}
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
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.postWrap}>
                <View style={styles.sosHeader}>
                  <Ionicons name="alert-circle" size={32} color="#ff007f" />
                  <Text style={styles.postTitle}>SOS Triggered</Text>
                </View>

                <View style={styles.locationBox}>
                  <Text style={styles.locationLabel}>Current Location</Text>
                  <Text style={styles.locationCoords}>
                    {location
                      ? `${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}`
                      : "Location unavailable"}
                  </Text>
                  {locationMeta?.dms && (
                    <Text style={styles.locationDms}>{locationMeta.dms}</Text>
                  )}
                  <Text style={styles.locationAddress}>
                    {locationMeta?.address ?? (loadingLocation ? "Resolving address..." : "Address unavailable")}
                  </Text>
                </View>

                <View style={styles.shareOptions}>
                  <TouchableOpacity
                    style={styles.primaryActionBtn}
                    onPress={async () => {
                      await loadContacts();
                    }}
                  >
                    <Ionicons name="people" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>Notify Saved Contacts</Text>
                  </TouchableOpacity>

                  <View style={styles.secondaryActions}>
                    <TouchableOpacity style={styles.secondaryBtn} onPress={shareViaWhatsApp}>
                      <Ionicons name="logo-whatsapp" size={20} color="#25D366" />
                      <Text style={styles.secondaryBtnText}>WhatsApp</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryBtn} onPress={shareNative}>
                      <Ionicons name="share-social" size={20} color="#007aff" />
                      <Text style={styles.secondaryBtnText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {contacts !== null && renderContactsPicker()}

                <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                  <Text style={styles.closeBtnText}>Close</Text>
                </TouchableOpacity>
              </View>
            )}
          </Animated.View>
        </Animated.View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safe: { 
    flex: 1, 
    backgroundColor: "transparent" 
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    // backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    
  },
  
  modalCard: {
    width: "90%",
    maxHeight: "85%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    alignItems: "center",
    
  },
  countdownWrap: { alignItems: "center", width: "100%" },
  countText: { fontSize: 82, fontWeight: "900", color: "#ff007f" },
  countSubtitle: { marginTop: 8, fontSize: 14, color: "#333", fontWeight: "500" },
  smallNote: { fontSize: 12, color: "#777", marginTop: 6 },
  cancelBtn: {
    marginTop: 20,
    backgroundColor: "#333",
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 12,
  },
  postWrap: { width: "100%", alignItems: "center" },
  sosHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  postTitle: { fontSize: 22, fontWeight: "800", color: "#111" },
  locationBox: {
    width: "100%",
    padding: 14,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e9ecef",
  },
  locationLabel: { fontSize: 12, color: "#6c757d", fontWeight: "600" },
  locationCoords: { marginTop: 8, fontSize: 14, fontWeight: "700", color: "#212529" },
  locationDms: { marginTop: 6, color: "#495057", fontWeight: "600", fontSize: 13 },
  locationAddress: { marginTop: 8, color: "#6c757d", fontSize: 12, lineHeight: 18 },
  shareOptions: { marginTop: 16, width: "100%" },
  primaryActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#ff007f",
    shadowColor: "#ff007f",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  secondaryActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: "#f8f9fa",
    borderWidth: 1,
    borderColor: "#dee2e6",
  },
  secondaryBtnText: { color: "#495057", fontWeight: "600", fontSize: 13 },
  contactsWrap: {
    marginTop: 16,
    width: "100%",
    maxHeight: 300,
    backgroundColor: "#f8f9fa",
    borderRadius: 12,
    padding: 12,
  },
  contactsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#dee2e6",
  },
  contactsTitle: { fontWeight: "700", fontSize: 15, color: "#212529" },
  contactRow: {
    paddingVertical: 6,
    paddingHorizontal: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    backgroundColor: "#fff",
    borderRadius: 8,
    marginBottom: 8,
  },
  contactAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff7a2f",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 3,
  },
  contactInitials: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
  },
  contactName: { fontWeight: "600", fontSize: 14, color: "#212529" },
  contactPhone: { color: "#6c757d", marginTop: 4, fontSize: 8 },
  contactActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ff007f",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  smsButton: {
    backgroundColor: "#007aff",
  },
  actionButtonText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  closeBtn: {
    marginTop: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#f8f9fa",
    width: "100%",
    alignItems: "center",
  },
  closeBtnText: {
    color: "#495057",
    fontWeight: "600",
  },
});