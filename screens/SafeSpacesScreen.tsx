// src/screens/SafeSpacesScreen.tsx
import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Linking,
  Animated,
  Vibration,
  StatusBar,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Navbar from "../components/SpaceTopBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import MapView, { Marker, MapLongPressEvent, Region, Circle } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getAuthHeaders from "../helpers/authHeaders";
import BottomNavBar from "../components/BottomNavBar";
import { ThemeAlert } from "../components/ThemeAlert";
import { Audio } from "expo-av";
import * as TaskManager from "expo-task-manager";
import Constants from "expo-constants";

const API_BASE_URL = "https://fiza-tariq-shield-backend.hf.space";
const STORAGE_KEY_SAFEPLACES = "SAFE_PLACES_V1";
const STORAGE_KEY_CURRENT_LOCATION = "CURRENT_LOCATION_V1";
const MAP_HEIGHT = 250;

const GEOFENCING_TASK = "GEOFENCING_TASK";
const SAFE_ZONE_RADIUS = 3000;
const AUTO_SOS_DELAY_MS = 30_000;
const SAFE_ZONE_ALERT_COOLDOWN_MS = 60_000;
const STORAGE_KEY_SAFE_ZONE_LOCATION = "SAFE_ZONE_LOCATION";

// ─── Safe Notifications Helper (Expo Go compatible) ───────────────────────────
const isExpoGo = Constants.appOwnership === "expo";

const safeScheduleNotification = async (distanceKm: number, placeName?: string) => {
  if (isExpoGo) {
    console.log("[Notifications] Skipped in Expo Go — distance:", distanceKm);
    return;
  }
  try {
    const Notifications = await import("expo-notifications");
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: s } = await Notifications.requestPermissionsAsync();
      if (s !== "granted") return;
    }
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ Safe Zone Alert",
        body: placeName
          ? `You are ${distanceKm.toFixed(1)} km from "${placeName}". Open app to confirm you're safe or trigger SOS.`
          : `You are ${distanceKm.toFixed(1)} km away from your safe zone. Open app to confirm you're safe or trigger SOS.`,
        sound: true,
        data: { type: "safe_zone_alert", distanceKm },
        categoryIdentifier: "SAFE_ZONE_ALERT",
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[Notifications] Failed:", e);
  }
};

const safeSetupNotificationCategory = async () => {
  if (isExpoGo) return;
  try {
    const Notifications = await import("expo-notifications");
    await Notifications.setNotificationCategoryAsync("SAFE_ZONE_ALERT", [
      { identifier: "IM_SAFE", buttonTitle: "I'm Safe", options: { isDestructive: false, opensAppToForeground: true } },
      { identifier: "TRIGGER_SOS", buttonTitle: "Trigger SOS", options: { isDestructive: true, opensAppToForeground: true } },
    ]);
  } catch (e) {
    console.warn("[Notifications] Category setup failed:", e);
  }
};

type SafeSpaceScreenNavProp = StackNavigationProp<RootStackParamList, "SafeSpacesScreen">;
type Props = { navigation: SafeSpaceScreenNavProp };
type BannerType = "warning" | "danger" | "info" | "success";

// ─── In-App Notification Banner ───────────────────────────────────────────────
interface InAppBannerProps {
  visible: boolean;
  type: BannerType;
  title: string;
  message: string;
  countdown?: number;
  onDismiss: () => void;
  onSOS: () => void;
  onReturn: () => void;
}

function InAppBanner({ visible, type, title, message, countdown, onDismiss, onSOS, onReturn }: InAppBannerProps) {
  const slideAnim = useRef(new Animated.Value(-120)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 80, friction: 10 }).start();
      if (type === "danger") {
        Animated.loop(
          Animated.sequence([
            Animated.timing(pulseAnim, { toValue: 1.03, duration: 600, useNativeDriver: true }),
            Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
          ])
        ).start();
      }
    } else {
      Animated.timing(slideAnim, { toValue: -120, duration: 250, useNativeDriver: true }).start();
    }
  }, [visible, type]);

  const colors: Record<BannerType, { bg: string; accent: string; icon: string; text: string }> = {
    warning: { bg: "#FFF8E1", accent: "#FF8F00", icon: "warning", text: "#5D4037" },
    danger:  { bg: "#FFEBEE", accent: "#D32F2F", icon: "alert-circle", text: "#B71C1C" },
    info:    { bg: "#E3F2FD", accent: "#1565C0", icon: "information-circle", text: "#0D47A1" },
    success: { bg: "#E8F5E9", accent: "#2E7D32", icon: "checkmark-circle", text: "#1B5E20" },
  };
  const c = colors[type];

  return (
    <Animated.View
      style={[
        bannerStyles.wrapper,
        { transform: [{ translateY: slideAnim }, { scale: pulseAnim }], backgroundColor: c.bg, borderLeftColor: c.accent },
      ]}
      pointerEvents={visible ? "box-none" : "none"}
    >
      <View style={bannerStyles.iconRow}>
        <Ionicons name={c.icon as any} size={22} color={c.accent} />
        <View style={{ flex: 1, marginLeft: 10 }}>
          <Text style={[bannerStyles.title, { color: c.accent }]}>{title}</Text>
          <Text style={[bannerStyles.message, { color: c.text }]}>{message}</Text>
          {typeof countdown === "number" && countdown > 0 && (
            <Text style={[bannerStyles.countdown, { color: c.accent }]}>Auto-SOS in {countdown}s…</Text>
          )}
        </View>
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="close" size={18} color={c.text} />
        </TouchableOpacity>
      </View>
      <View style={bannerStyles.btnRow}>
        <TouchableOpacity style={[bannerStyles.btn, { borderColor: c.accent }]} onPress={onReturn} activeOpacity={0.8}>
          <Ionicons name="arrow-back" size={14} color={c.accent} />
          <Text style={[bannerStyles.btnText, { color: c.accent }]}>I'm Safe</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[bannerStyles.btn, { backgroundColor: c.accent, borderColor: c.accent }]} onPress={onSOS} activeOpacity={0.8}>
          <Ionicons name="alert" size={14} color="#fff" />
          <Text style={[bannerStyles.btnText, { color: "#fff" }]}>Trigger SOS</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const bannerStyles = StyleSheet.create({
  wrapper: {
    position: "absolute", top: 0, left: 12, right: 12, zIndex: 9999, elevation: 30,
    borderRadius: 14, borderLeftWidth: 4, padding: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 10,
  },
  iconRow: { flexDirection: "row", alignItems: "flex-start" },
  title: { fontWeight: "700", fontSize: 14, marginBottom: 2 },
  message: { fontSize: 12, lineHeight: 17 },
  countdown: { fontSize: 12, fontWeight: "700", marginTop: 4 },
  btnRow: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 5, paddingVertical: 8, borderRadius: 8, borderWidth: 1.5,
  },
  btnText: { fontSize: 13, fontWeight: "600" },
});

// ─── Fullscreen Map Modal ─────────────────────────────────────────────────────
interface FullscreenMapProps {
  visible: boolean;
  mapRegion: Region | null;
  currentLocation: { latitude: number; longitude: number } | null;
  safeZoneCenter: { latitude: number; longitude: number } | null;
  safePlaces: any[];
  addingCoord: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onLongPress: (ev: MapLongPressEvent) => void;
}

function FullscreenMapModal({
  visible, mapRegion, currentLocation, safeZoneCenter,
  safePlaces, addingCoord, onClose, onLongPress,
}: FullscreenMapProps) {
  const insets = useSafeAreaInsets();
  const [fullRegion, setFullRegion] = useState<Region | null>(null);

  useEffect(() => {
    if (visible && mapRegion) setFullRegion(mapRegion);
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View style={fsStyles.container}>
        <View style={[fsStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} style={fsStyles.closeBtn} activeOpacity={0.8}>
            <Ionicons name="chevron-down" size={22} color="#333" />
          </TouchableOpacity>
          <Text style={fsStyles.headerTitle}>Map View</Text>
          <TouchableOpacity
            onPress={() => {
              if (currentLocation)
                setFullRegion({ latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
            }}
            style={fsStyles.recenterHeaderBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="locate" size={20} color="#ff007f" />
          </TouchableOpacity>
        </View>

        <View style={fsStyles.hintBar}>
          <Ionicons name="hand-left-outline" size={13} color="#888" />
          <Text style={fsStyles.hintText}>Long-press anywhere to add a safe place</Text>
        </View>

        {fullRegion ? (
          <MapView
            style={fsStyles.map}
            region={fullRegion}
            onRegionChangeComplete={setFullRegion}
            onLongPress={onLongPress}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {/* Draw a circle for every saved place */}
            {safePlaces
              .filter((p) => p.location?.coordinates?.length === 2)
              .map((p) => (
                <Circle
                  key={`zone_${p._id}`}
                  center={{ latitude: p.location.coordinates[1], longitude: p.location.coordinates[0] }}
                  radius={SAFE_ZONE_RADIUS}
                  strokeColor="rgba(255,0,127,0.25)"
                  fillColor="rgba(255,0,127,0.05)"
                  strokeWidth={1.5}
                />
              ))}

            {currentLocation && (
              <Marker coordinate={currentLocation}>
                <View style={styles.currentMarker}><View style={styles.currentInner} /></View>
              </Marker>
            )}

            {safeZoneCenter && (
              <Marker coordinate={safeZoneCenter} title="Safe Zone">
                <View style={styles.safeZoneMarker}>
                  <Ionicons name="shield-checkmark" size={18} color="#ff007f" />
                </View>
              </Marker>
            )}

            {addingCoord && <Marker coordinate={addingCoord} pinColor="#ff007f" />}

            {safePlaces.map((p) => {
              const lat = p.location?.coordinates?.[1];
              const lng = p.location?.coordinates?.[0];
              if (typeof lat !== "number" || typeof lng !== "number") return null;
              const isPolice =
                (p.type || p.meta?.type || "").toString().toLowerCase() === "police" ||
                /\bpolice\b/.test((p.name || "").toLowerCase());
              return (
                <Marker key={p._id ?? `${lat}_${lng}`} coordinate={{ latitude: lat, longitude: lng }} title={p.name}>
                  <View style={[styles.placeMarker, isPolice ? { borderColor: "rgba(0,100,255,0.45)" } : {}]}>
                    <View style={styles.placeInner} />
                  </View>
                </Marker>
              );
            })}
          </MapView>
        ) : (
          <View style={fsStyles.loadingWrap}>
            <ActivityIndicator size="large" color="#ff007f" />
            <Text style={{ color: "#666", marginTop: 10 }}>Locating…</Text>
          </View>
        )}

        <TouchableOpacity
          style={[fsStyles.floatingRecenter, { bottom: insets.bottom + 24 }]}
          onPress={() => {
            if (currentLocation)
              setFullRegion({ latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 });
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={22} color="#ff007f" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const fsStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff",
    borderBottomWidth: 1, borderBottomColor: "#f0f0f0", zIndex: 10,
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f5f5f5", alignItems: "center", justifyContent: "center" },
  recenterHeaderBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff0f6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#333" },
  hintBar: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: "#fafafa", borderBottomWidth: 1, borderBottomColor: "#f0f0f0",
  },
  hintText: { fontSize: 12, color: "#888" },
  map: { flex: 1 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  floatingRecenter: {
    position: "absolute", right: 16, width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 6,
  },
});

// ─── Add Safe Place Bottom Sheet ──────────────────────────────────────────────
interface AddPlaceSheetProps {
  visible: boolean;
  currentLocation: { latitude: number; longitude: number } | null;
  onClose: () => void;
  onOpenMap: () => void;
  onSave: (name: string, lat: number, lng: number, address: string) => Promise<void>;
}

function AddPlaceSheet({ visible, currentLocation, onClose, onOpenMap, onSave }: AddPlaceSheetProps) {
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(400)).current;

  const [placeName, setPlaceName] = useState("");
  const [manualAddress, setManualAddress] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [tab, setTab] = useState<"current" | "manual">("current");

  useEffect(() => {
    if (visible) {
      setPlaceName(""); setManualAddress(""); setResolvedAddress(""); setTab("current");
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
      if (currentLocation) geocodeCurrentLocation(currentLocation.latitude, currentLocation.longitude);
    } else {
      Animated.timing(slideAnim, { toValue: 400, duration: 220, useNativeDriver: true }).start();
    }
  }, [visible]);

  const geocodeCurrentLocation = async (lat: number, lng: number) => {
    setGeocoding(true);
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (places?.[0]) {
        const p = places[0];
        setResolvedAddress([p.name, p.street, p.city, p.region, p.postalCode, p.country].filter(Boolean).join(", "));
      }
    } catch {
      setResolvedAddress("");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSaveCurrentLocation = async () => {
    if (!currentLocation) return;
    setSaving(true);
    await onSave(placeName.trim() || "My Safe Place", currentLocation.latitude, currentLocation.longitude, resolvedAddress);
    setSaving(false);
    onClose();
  };

  const handleSaveManual = async () => {
    if (!manualAddress.trim()) return;
    setSaving(true);
    try {
      const results = await Location.geocodeAsync(manualAddress.trim());
      if (results?.[0]) {
        const { latitude, longitude } = results[0];
        let formatted = manualAddress.trim();
        try {
          const rev = await Location.reverseGeocodeAsync({ latitude, longitude });
          if (rev?.[0]) {
            const p = rev[0];
            formatted = [p.name, p.street, p.city, p.region, p.postalCode, p.country].filter(Boolean).join(", ");
          }
        } catch { /* keep raw */ }
        await onSave(placeName.trim() || "Safe Place", latitude, longitude, formatted);
        onClose();
      } else {
        await onSave(placeName.trim() || "Safe Place", 0, 0, manualAddress.trim());
        onClose();
      }
    } catch {
      await onSave(placeName.trim() || "Safe Place", 0, 0, manualAddress.trim());
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={sheetStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[sheetStyles.sheet, { transform: [{ translateY: slideAnim }], paddingBottom: insets.bottom + 12 }]}>
        <View style={sheetStyles.handle} />
        <View style={sheetStyles.sheetHeader}>
          <Text style={sheetStyles.sheetTitle}>Add Safe Place</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="close" size={22} color="#555" />
          </TouchableOpacity>
        </View>

        <View style={sheetStyles.tabs}>
          <TouchableOpacity style={[sheetStyles.tab, tab === "current" && sheetStyles.tabActive]} onPress={() => setTab("current")} activeOpacity={0.8}>
            <Ionicons name="locate" size={15} color={tab === "current" ? "#ff007f" : "#888"} />
            <Text style={[sheetStyles.tabText, tab === "current" && sheetStyles.tabTextActive]}>Current Location</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[sheetStyles.tab, tab === "manual" && sheetStyles.tabActive]} onPress={() => setTab("manual")} activeOpacity={0.8}>
            <Ionicons name="search" size={15} color={tab === "manual" ? "#ff007f" : "#888"} />
            <Text style={[sheetStyles.tabText, tab === "manual" && sheetStyles.tabTextActive]}>Enter Address</Text>
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          {tab === "current" && (
            <View style={sheetStyles.tabContent}>
              <View style={sheetStyles.locationCard}>
                <View style={sheetStyles.locationDot}>
                  <View style={sheetStyles.locationDotInner} />
                </View>
                <View style={{ flex: 1 }}>
                  {geocoding ? (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <ActivityIndicator size="small" color="#ff007f" />
                      <Text style={sheetStyles.locationAddr}>Getting address…</Text>
                    </View>
                  ) : resolvedAddress ? (
                    <Text style={sheetStyles.locationAddr} numberOfLines={2}>{resolvedAddress}</Text>
                  ) : (
                    <Text style={[sheetStyles.locationAddr, { color: "#aaa" }]}>
                      {currentLocation
                        ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}`
                        : "Location unavailable"}
                    </Text>
                  )}
                  <Text style={sheetStyles.locationSub}>Your current GPS position</Text>
                </View>
              </View>

              <Text style={sheetStyles.label}>Place name</Text>
              <TextInput
                style={sheetStyles.input}
                placeholder="e.g. Home, Office, Mom's house…"
                placeholderTextColor="#bbb"
                value={placeName}
                onChangeText={setPlaceName}
                maxLength={60}
              />

              <TouchableOpacity style={sheetStyles.mapPickBtn} onPress={onOpenMap} activeOpacity={0.8}>
                <Ionicons name="map-outline" size={18} color="#ff007f" />
                <Text style={sheetStyles.mapPickText}>Or pick exact spot on map</Text>
                <Ionicons name="chevron-forward" size={16} color="#ff007f" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[sheetStyles.saveBtn, (!currentLocation || saving) && sheetStyles.saveBtnDisabled]}
                onPress={handleSaveCurrentLocation}
                activeOpacity={0.8}
                disabled={!currentLocation || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={sheetStyles.saveBtnText}>Save as Safe Place</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {tab === "manual" && (
            <View style={sheetStyles.tabContent}>
              <Text style={sheetStyles.label}>Place name</Text>
              <TextInput
                style={sheetStyles.input}
                placeholder="e.g. Grandma's house…"
                placeholderTextColor="#bbb"
                value={placeName}
                onChangeText={setPlaceName}
                maxLength={60}
              />

              <Text style={sheetStyles.label}>Address</Text>
              <TextInput
                style={[sheetStyles.input, { height: 70, textAlignVertical: "top", paddingTop: 10 }]}
                placeholder="Type full address or landmark…"
                placeholderTextColor="#bbb"
                value={manualAddress}
                onChangeText={setManualAddress}
                multiline
                maxLength={200}
              />

              <Text style={sheetStyles.hint}>
                We'll try to locate this address on the map. You can also pick a spot manually.
              </Text>

              <TouchableOpacity style={sheetStyles.mapPickBtn} onPress={onOpenMap} activeOpacity={0.8}>
                <Ionicons name="map-outline" size={18} color="#ff007f" />
                <Text style={sheetStyles.mapPickText}>Or pick exact spot on map</Text>
                <Ionicons name="chevron-forward" size={16} color="#ff007f" />
              </TouchableOpacity>

              <TouchableOpacity
                style={[sheetStyles.saveBtn, (!manualAddress.trim() || saving) && sheetStyles.saveBtnDisabled]}
                onPress={handleSaveManual}
                activeOpacity={0.8}
                disabled={!manualAddress.trim() || saving}
              >
                {saving ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                    <Text style={sheetStyles.saveBtnText}>Save as Safe Place</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}

const sheetStyles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.38)" },
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff",
    borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.12, shadowRadius: 12, elevation: 20,
  },
  handle: { width: 40, height: 4, backgroundColor: "#ddd", borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontWeight: "700", color: "#222" },
  tabs: { flexDirection: "row", backgroundColor: "#f5f5f5", borderRadius: 12, padding: 4, marginBottom: 18 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 9, borderRadius: 10 },
  tabActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  tabText: { fontSize: 13, color: "#888", fontWeight: "500" },
  tabTextActive: { color: "#ff007f", fontWeight: "700" },
  tabContent: { paddingBottom: 8 },
  locationCard: {
    flexDirection: "row", alignItems: "flex-start", backgroundColor: "#fff5f9",
    borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: "#ffd6e8", gap: 10,
  },
  locationDot: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,0,127,0.12)", alignItems: "center", justifyContent: "center", marginTop: 2 },
  locationDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#ff007f" },
  locationAddr: { fontSize: 13, color: "#333", fontWeight: "500", lineHeight: 18 },
  locationSub: { fontSize: 11, color: "#aaa", marginTop: 3 },
  label: { fontSize: 13, fontWeight: "600", color: "#555", marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: "#e8e8e8", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: Platform.OS === "ios" ? 13 : 10,
    fontSize: 14, color: "#333", backgroundColor: "#fafafa", marginBottom: 14,
  },
  hint: { fontSize: 12, color: "#aaa", marginBottom: 14, lineHeight: 17 },
  mapPickBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingVertical: 11, paddingHorizontal: 14,
    backgroundColor: "#fff5f9", borderRadius: 10, borderWidth: 1, borderColor: "#ffd6e8", marginBottom: 18,
  },
  mapPickText: { flex: 1, fontSize: 14, color: "#ff007f", fontWeight: "600" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#ff007f", borderRadius: 12, paddingVertical: 14, marginBottom: 4 },
  saveBtnDisabled: { opacity: 0.45 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SafeSpacesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [safePlaces, setSafePlaces] = useState<any[]>([]);
  const [nearestPolice, setNearestPolice] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingCoord, setAddingCoord] = useState<{ latitude: number; longitude: number } | null>(null);

  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [fullscreenMapVisible, setFullscreenMapVisible] = useState(false);
  const [mapPickModalVisible, setMapPickModalVisible] = useState(false);
  const [mapPickName, setMapPickName] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [filteredPlaces, setFilteredPlaces] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Safe zone — now tracks nearest of ALL saved places
  const [hasSafeZone, setHasSafeZone] = useState(false);
  const [safeZoneCenter, setSafeZoneCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [distanceFromSafeZone, setDistanceFromSafeZone] = useState<number | null>(null);

  const [bannerVisible, setBannerVisible] = useState(false);
  const [bannerType, setBannerType] = useState<BannerType>("warning");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerMessage, setBannerMessage] = useState("");
  const [sosCountdown, setSosCountdown] = useState<number | undefined>(undefined);

  const lastSafeZoneAlertRef = useRef<number>(0);
  const sosTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outsideSafeZoneRef = useRef(false);

  const [mapRegion, setMapRegion] = useState<Region | null>(null);
  const userPanningRef = useRef(false);
  const panResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchFailCountRef = useRef(0);
  const fetchBackoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const soundRef = useRef<Audio.Sound | null>(null);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "", message: "",
    type: "info" as "info" | "error" | "warning" | "success",
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }>,
  });

  const mapRef = useRef<MapView | null>(null);
  const watchSubscription = useRef<any>(null);
  const lastFetchRef = useRef<number>(0);
  const lastReverseRef = useRef<number>(0);
  const lastSavedLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: "default" | "cancel" | "destructive" }>,
    type: "info" | "error" | "warning" | "success" = "info"
  ) => {
    setAlertConfig({ title, message, type, buttons: buttons || [{ text: "OK" }] });
    setAlertVisible(true);
  };

  // ── Banner ────────────────────────────────────────────────────────────────
  const showSafeZoneBanner = useCallback((distanceKm: number, placeName: string) => {
    const isDanger = distanceKm > 5;
    setBannerType(isDanger ? "danger" : "warning");
    setBannerTitle(isDanger ? "⚠️ You've Left Your Safe Zone!" : "⚠️ Safe Zone Alert");
    setBannerMessage(
      `You are ${distanceKm.toFixed(1)} km from "${placeName}". ` +
      (isDanger
        ? "Tap 'Trigger SOS' immediately or confirm you're safe."
        : "Return to your safe area or trigger SOS if you need help.")
    );
    setBannerVisible(true);
    Vibration.vibrate(isDanger ? [0, 400, 200, 400, 200, 400] : [0, 300, 150, 300]);
    let remaining = Math.round(AUTO_SOS_DELAY_MS / 1000);
    setSosCountdown(remaining);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      setSosCountdown(remaining);
      if (remaining <= 0 && countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    }, 1000);
    if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
    sosTimerRef.current = setTimeout(() => {
      if (outsideSafeZoneRef.current) handleAutoSOS();
    }, AUTO_SOS_DELAY_MS);
  }, []);

  const dismissBanner = useCallback(() => {
    setBannerVisible(false);
    setSosCountdown(undefined);
    if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    outsideSafeZoneRef.current = false;
  }, []);

  const handleUserSafe = useCallback(() => {
    dismissBanner();
    if (soundRef.current) soundRef.current.stopAsync().catch(() => {});
    showAlert("Acknowledged", "Glad you're safe! We'll continue monitoring your safe zone.", [{ text: "OK" }], "success");
  }, [dismissBanner]);

  const handleManualSOS = useCallback(() => {
    dismissBanner();
    if (soundRef.current) soundRef.current.stopAsync().catch(() => {});
    navigation.navigate("SOSScreen");
  }, [dismissBanner, navigation]);

  const handleAutoSOS = useCallback(() => {
    setBannerVisible(false);
    setSosCountdown(undefined);
    if (soundRef.current) soundRef.current.stopAsync().catch(() => {});
    navigation.navigate("SOSScreen");
  }, [navigation]);

  // ── Per-user storage key ──────────────────────────────────────────────────
  const getPerUserStorageKey = async () => {
    try {
      const headers = await getAuthHeaders();
      const token = headers?.Authorization?.split?.(" ")?.[1] ?? "";
      return `${STORAGE_KEY_SAFEPLACES}_${token ? token.slice(-8) : "anon"}`;
    } catch {
      return STORAGE_KEY_SAFEPLACES + "_anon";
    }
  };

  // ── Utilities ─────────────────────────────────────────────────────────────
  const distanceMetersBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const formatDistance = (meters?: number): string => {
    if (meters == null) return "—";
    return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
  };

  const estimateWalkingETA = (meters?: number): string => {
    if (meters == null) return "—";
    const mins = Math.max(1, Math.round(meters / (5000 / 60)));
    if (mins < 60) return `${mins} min Walking`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hrs} hr Walking` : `${hrs} hr ${rem} min Walking`;
  };

  const toDMS = (lat: number, lng: number) => {
    const fmt = (deg: number, isLat: boolean) => {
      const abs = Math.abs(deg);
      const d = Math.floor(abs);
      const mf = (abs - d) * 60;
      const m = Math.floor(mf);
      const s = (mf - m) * 60;
      return `${d}°${m}'${s.toFixed(1)}"${isLat ? (deg >= 0 ? "N" : "S") : deg >= 0 ? "E" : "W"}`;
    };
    return `${fmt(lat, true)} ${fmt(lng, false)}`;
  };

  // ── Audio ─────────────────────────────────────────────────────────────────
  const loadAlarmSound = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(require("../assets/sounds/click.mp3"), {
        shouldPlay: false,
        isLooping: true,
      });
      soundRef.current = sound;
    } catch {}
  };

  const playAlarmSound = async () => {
    try {
      if (!soundRef.current) await loadAlarmSound();
      if (soundRef.current) {
        await soundRef.current.setPositionAsync(0);
        await soundRef.current.playAsync();
      }
    } catch {}
  };

  // ── Safe zone check — nearest of ALL saved places ─────────────────────────
  const handleLocationUpdate = useCallback(
    async (lat: number, lng: number) => {
      if (!safePlaces.length) return;

      const withDistances = safePlaces
        .filter((p) => p.location?.coordinates?.length === 2)
        .map((p) => {
          const [lng2, lat2] = p.location.coordinates;
          return { ...p, distanceMeters: distanceMetersBetween(lat, lng, lat2, lng2) };
        });

      if (!withDistances.length) return;

      withDistances.sort((a, b) => a.distanceMeters - b.distanceMeters);
      const nearest = withDistances[0];

      setDistanceFromSafeZone(nearest.distanceMeters);
      setSafeZoneCenter({
        latitude: nearest.location.coordinates[1],
        longitude: nearest.location.coordinates[0],
      });

      if (nearest.distanceMeters > SAFE_ZONE_RADIUS) {
        const now = Date.now();
        if (!outsideSafeZoneRef.current || now - lastSafeZoneAlertRef.current > SAFE_ZONE_ALERT_COOLDOWN_MS) {
          outsideSafeZoneRef.current = true;
          lastSafeZoneAlertRef.current = now;
          await playAlarmSound();
          await safeScheduleNotification(nearest.distanceMeters / 1000, nearest.name);
          showSafeZoneBanner(nearest.distanceMeters / 1000, nearest.name);
        }
      } else {
        if (outsideSafeZoneRef.current) {
          outsideSafeZoneRef.current = false;
          setBannerVisible(false);
          setSosCountdown(undefined);
          if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
          if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
          if (soundRef.current) soundRef.current.stopAsync().catch(() => {});
        }
      }
    },
    [safePlaces, showSafeZoneBanner]
  );

  // ── Geofencing ────────────────────────────────────────────────────────────
  const setupGeofencing = async (latitude: number, longitude: number) => {
  try {
    // ✅ Check background permission before starting
    const { status } = await Location.getBackgroundPermissionsAsync();
    if (status !== "granted") {
      showAlert(
        "Permission Required",
        "Background location permission is needed for safe zone monitoring. Please enable it in Settings.",
        [{ text: "OK" }],
        "warning"
      );
      return;
    }

    await AsyncStorage.setItem(STORAGE_KEY_SAFE_ZONE_LOCATION, JSON.stringify({ latitude, longitude }));
    await safeSetupNotificationCategory();
    await Location.startLocationUpdatesAsync(GEOFENCING_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 30_000,
      distanceInterval: 100,
      foregroundService: {
        notificationTitle: "Safe Zone Monitoring",
        notificationBody: "Monitoring your distance from safe zone",
        notificationColor: "#ff007f",
      },
    });
    await loadAlarmSound();
  } catch (e) {
    console.warn("Failed to setup geofencing:", e);
  }
};

  const setCurrentAsSafeZone = async () => {
    if (!currentLocation) {
      showAlert("Location unavailable", "Cannot set safe zone without current location.", [], "warning");
      return;
    }
    await setupGeofencing(currentLocation.latitude, currentLocation.longitude);
    setSafeZoneCenter({ latitude: currentLocation.latitude, longitude: currentLocation.longitude });
    setHasSafeZone(true);
    setDistanceFromSafeZone(0);
    showAlert(
      "Safe Zone Set ✓",
      "Your current location is now your safe zone. You'll be alerted if you move more than 3 km away.",
      [{ text: "OK" }],
      "success"
    );
  };

  const stopGeofencing = async () => {
    try {
      await Location.stopLocationUpdatesAsync(GEOFENCING_TASK);
      await AsyncStorage.removeItem(STORAGE_KEY_SAFE_ZONE_LOCATION);
      if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; }
      setSafeZoneCenter(null);
      setHasSafeZone(false);
      setDistanceFromSafeZone(null);
      outsideSafeZoneRef.current = false;
      setBannerVisible(false);
      if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      showAlert("Safe Zone Removed", "Geofencing monitoring has been stopped.", [], "info");
    } catch (e) {
      console.warn("Failed to stop geofencing:", e);
    }
  };

  const computeNearestPolice = (places: any[]) => {
    if (!places?.length) { setNearestPolice(null); return; }
    const candidates = places.filter((p) => {
      const t = String(p.type || p.meta?.type || "").toLowerCase();
      return (
        ["police", "police_station", "police-station"].includes(t) ||
        /\bpolice\b/.test(String(p.name || "").toLowerCase()) ||
        /\bpolice\b/.test(String(p.address || "").toLowerCase())
      );
    });
    if (!candidates.length) { setNearestPolice(null); return; }
    const enriched = candidates.map((p) => {
      let d = typeof p.distanceMeters === "number" ? p.distanceMeters : null;
      if ((d === null || isNaN(d)) && currentLocation && p.location?.coordinates) {
        const [lng, lat] = p.location.coordinates;
        d = distanceMetersBetween(currentLocation.latitude, currentLocation.longitude, lat, lng);
      }
      return { ...p, distanceMeters: d === null || isNaN(d) ? Infinity : d };
    });
    enriched.sort((a, b) => a.distanceMeters - b.distanceMeters);
    setNearestPolice(enriched[0] ?? null);
  };

  const maybeReverseGeocodeAndSave = async (latitude: number, longitude: number, force = false) => {
    try {
      const now = Date.now();
      const lastSaved = lastSavedLocationRef.current;
      const moved = lastSaved
        ? distanceMetersBetween(lastSaved.latitude, lastSaved.longitude, latitude, longitude)
        : Infinity;
      if (!force && now - lastReverseRef.current < 8000 && moved < 50) return;
      lastReverseRef.current = now;
      const dms = toDMS(latitude, longitude);
      let addressStr = "";
      try {
        const places = await Location.reverseGeocodeAsync({ latitude, longitude });
        if (Array.isArray(places) && places.length > 0) {
          const p = places[0];
          addressStr = [p.name, p.street, p.city, p.region, p.postalCode, p.country].filter(Boolean).join(", ");
        }
      } catch {}
      await AsyncStorage.setItem(
        STORAGE_KEY_CURRENT_LOCATION,
        JSON.stringify({ latitude, longitude, dms, address: addressStr, timestamp: new Date().toISOString() })
      );
      lastSavedLocationRef.current = { latitude, longitude };
    } catch {}
  };

  // ── Mount ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const key = await getPerUserStorageKey();
        const raw = await AsyncStorage.getItem(key);
        if (raw) setSafePlaces(JSON.parse(raw));
      } catch {}

      try {
        const s = await AsyncStorage.getItem(STORAGE_KEY_SAFE_ZONE_LOCATION);
        if (s) {
          const sz = JSON.parse(s);
          setHasSafeZone(true);
          setSafeZoneCenter({ latitude: sz.latitude, longitude: sz.longitude });
        }
      } catch {}

      try {
       const { status: fgStatus } = await Location.requestForegroundPermissionsAsync();
if (fgStatus !== "granted") {
  showAlert("Location permission required", "Enable location in settings.", [{ text: "OK" }], "warning");
  return;
}

// ✅ Must request background separately on Android
const { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
if (bgStatus !== "granted") {
  console.warn("Background location denied — geofencing won't work when app is minimized");
}
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const initial = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCurrentLocation(initial);
        setMapRegion({ ...initial, latitudeDelta: 0.02, longitudeDelta: 0.02 });
        maybeReverseGeocodeAndSave(initial.latitude, initial.longitude, true);
        fetchNearbyPlaces(pos.coords.latitude, pos.coords.longitude);

        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, distanceInterval: 10, timeInterval: 5000 },
          (p) => {
            const lat = p.coords.latitude;
            const lng = p.coords.longitude;
            setCurrentLocation({ latitude: lat, longitude: lng });
            if (!userPanningRef.current)
              setMapRegion((prev) =>
                prev
                  ? { ...prev, latitude: lat, longitude: lng }
                  : { latitude: lat, longitude: lng, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              );
            handleLocationUpdate(lat, lng);
            const now = Date.now();
            if (now - lastFetchRef.current > 4000) {
              lastFetchRef.current = now;
              fetchNearbyPlaces(lat, lng);
            }
            maybeReverseGeocodeAndSave(lat, lng);
          }
        );
        watchSubscription.current = sub;
      } catch (e) {
        console.warn("location error", e);
      }
    })();

    return () => {
      if (watchSubscription.current?.removeAsync) watchSubscription.current.removeAsync();
      if (watchSubscription.current?.remove) watchSubscription.current.remove();
      if (panResetTimerRef.current) clearTimeout(panResetTimerRef.current);
      if (sosTimerRef.current) clearTimeout(sosTimerRef.current);
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
      if (fetchBackoffTimerRef.current) clearTimeout(fetchBackoffTimerRef.current);
      if (soundRef.current) soundRef.current.unloadAsync();
      Location.stopLocationUpdatesAsync(GEOFENCING_TASK).catch(() => {});
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const key = await getPerUserStorageKey();
        await AsyncStorage.setItem(key, JSON.stringify(safePlaces));
      } catch {}
    })();
    computeNearestPolice(safePlaces);
  }, [safePlaces]);

  useEffect(() => { computeNearestPolice(safePlaces); }, [currentLocation]);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredPlaces(safePlaces);
      setShowSearchResults(false);
    } else {
      const q = searchQuery.toLowerCase().trim();
      setFilteredPlaces(
        safePlaces.filter(
          (p) =>
            p.name?.toLowerCase().includes(q) ||
            p.address?.toLowerCase().includes(q) ||
            p.type?.toLowerCase().includes(q) ||
            (p.meta?.type && p.meta.type.toLowerCase().includes(q))
        )
      );
      setShowSearchResults(true);
    }
  }, [searchQuery, safePlaces]);

  // ── API ───────────────────────────────────────────────────────────────────
  const fetchNearbyPlaces = async (latitude: number, longitude: number) => {
    if (fetchFailCountRef.current >= 5) return;
    setLoading(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);
      const headers = await getAuthHeaders();
      const res = await fetch(
        `${API_BASE_URL}/api/safeplaces?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&radius=5000&mine=true`,
        { method: "GET", headers, signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (!res.ok) { setLoading(false); return; }
      const data = await res.json();
      const normalized = Array.isArray(data)
        ? data.map((d: any) => ({
            _id: d._id || d.id,
            name: d.name,
            address: d.address || "",
            location: d.location,
            distanceMeters: typeof d.distanceMeters === "number" ? d.distanceMeters : null,
            createdAt: d.createdAt,
            type: d.type || d.meta?.type || null,
            meta: d.meta || {},
          }))
        : [];
      fetchFailCountRef.current = 0;
      setSafePlaces(normalized);
      try {
        const key = await getPerUserStorageKey();
        await AsyncStorage.setItem(key, JSON.stringify(normalized));
      } catch {}
    } catch {
      fetchFailCountRef.current += 1;
      if (fetchFailCountRef.current === 1 && __DEV__) console.log("[SafeSpaces] API unreachable, serving cached data.");
      if (fetchFailCountRef.current >= 3) {
        const backoffMs = Math.min(30_000 * (fetchFailCountRef.current - 2), 300_000);
        if (fetchBackoffTimerRef.current) clearTimeout(fetchBackoffTimerRef.current);
        fetchBackoffTimerRef.current = setTimeout(() => { fetchFailCountRef.current = 0; }, backoffMs);
      }
    } finally {
      setLoading(false);
    }
  };

  const createSafePlace = async (name: string, latitude: number, longitude: number, address?: string) => {
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/safeplaces`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ name, address: address || "", latitude, longitude }),
      });
      const txt = await res.text().catch(() => null);
      if (!res.ok) {
        showAlert("Failed", "Save failed: " + (txt || res.status), [{ text: "OK" }], "error");
        return;
      }
      const created = JSON.parse(txt || "{}");
      const sp = {
        _id: created._id || created.id,
        name: created.name,
        address: created.address || "",
        location: created.location,
        distanceMeters: created.distanceMeters ?? null,
        type: created.type || created.meta?.type || null,
        meta: created.meta || {},
      };
      setSafePlaces((s) => {
        const next = [sp, ...s];
        (async () => {
          try { const key = await getPerUserStorageKey(); await AsyncStorage.setItem(key, JSON.stringify(next)); } catch {}
        })();
        return next;
      });
    } catch {
      showAlert("Network error", "Failed to create place", [{ text: "OK" }], "error");
    }
  };

  const deleteSafePlace = async (id?: string) => {
    if (!id) return;
    showAlert(
      "Remove",
      "Remove this place?",
      [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${API_BASE_URL}/api/safeplaces/${id}`, { method: "DELETE", headers });
              if (!res.ok) { showAlert("Failed", "Could not remove place", [{ text: "OK" }], "error"); return; }
              setSafePlaces((s) => {
                const next = s.filter((sp) => sp._id !== id);
                (async () => {
                  try { const key = await getPerUserStorageKey(); await AsyncStorage.setItem(key, JSON.stringify(next)); } catch {}
                })();
                return next;
              });
            } catch {
              showAlert("Network error", "Failed to remove place", [{ text: "OK" }], "error");
            }
          },
        },
      ],
      "warning"
    );
  };

  // ── Map interactions ──────────────────────────────────────────────────────
  const handleMiniMapPress = () => setFullscreenMapVisible(true);

  const handleFullscreenLongPress = (ev: MapLongPressEvent) => {
    const { coordinate } = ev.nativeEvent;
    setAddingCoord({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    setMapPickName("");
    setMapPickModalVisible(true);
  };

  const saveMapPickPlace = async () => {
    if (!addingCoord) return;
    const name = mapPickName.trim() || `Safe Place ${safePlaces.length + 1}`;
    let addressStr = "";
    try {
      const places = await Location.reverseGeocodeAsync({ latitude: addingCoord.latitude, longitude: addingCoord.longitude });
      if (places?.[0]) {
        const p = places[0];
        addressStr = [p.name, p.street, p.city, p.region, p.postalCode, p.country].filter(Boolean).join(", ");
      }
    } catch {}
    setMapPickModalVisible(false);
    setFullscreenMapVisible(false);
    await createSafePlace(name, addingCoord.latitude, addingCoord.longitude, addressStr);
    setAddingCoord(null);
  };

  const handleSheetOpenMap = () => {
    setAddSheetVisible(false);
    setTimeout(() => setFullscreenMapVisible(true), 280);
  };

  const handleRecenter = () => {
    if (currentLocation) {
      userPanningRef.current = false;
      setMapRegion((prev) =>
        prev
          ? { ...prev, latitude: currentLocation.latitude, longitude: currentLocation.longitude }
          : { latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
      );
    }
  };

  // ── Nearest target for active card ────────────────────────────────────────
  const topTarget = useMemo(() => {
    if (!safePlaces.length) return nearestPolice ?? null;
    if (!currentLocation) return nearestPolice ?? safePlaces[0] ?? null;
    const withDist = safePlaces
      .filter((p) => p.location?.coordinates?.length === 2)
      .map((p) => {
        const [lng, lat] = p.location.coordinates;
        return {
          ...p,
          distanceMeters: distanceMetersBetween(currentLocation.latitude, currentLocation.longitude, lat, lng),
        };
      })
      .sort((a, b) => a.distanceMeters - b.distanceMeters);
    return nearestPolice ?? withDist[0] ?? null;
  }, [safePlaces, currentLocation, nearestPolice]);

  const handleNavigate = () => {
    const p = topTarget;
    if (p?.location?.coordinates) {
      const [lng, lat] = p.location.coordinates;
      const url = Platform.select({ ios: `maps:0,0?q=${lat},${lng}`, android: `geo:${lat},${lng}?q=${lat},${lng}` });
      url && Linking.openURL(url).catch(() => showAlert("Error", "Could not open maps", [{ text: "OK" }], "error"));
    } else {
      showAlert("No place", "No navigation target available.", [{ text: "OK" }], "warning");
    }
  };

  const handleCallSupport = () => showAlert("Calling support", "Feature not implemented yet", [{ text: "OK" }], "info");

  const safeZoneDistanceLabel = useMemo(() => {
    if (!hasSafeZone || distanceFromSafeZone === null) return null;
    const km = distanceFromSafeZone / 1000;
    const isOutside = distanceFromSafeZone > SAFE_ZONE_RADIUS;
    return {
      label: km < 1
        ? `${Math.round(distanceFromSafeZone)} m from safe zone`
        : `${km.toFixed(1)} km from safe zone`,
      isOutside,
    };
  }, [hasSafeZone, distanceFromSafeZone]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      <View style={styles.container}>
        <InAppBanner
          visible={bannerVisible}
          type={bannerType}
          title={bannerTitle}
          message={bannerMessage}
          countdown={sosCountdown}
          onDismiss={dismissBanner}
          onSOS={handleManualSOS}
          onReturn={handleUserSafe}
        />

        <Navbar title="Safe Spaces" onBack={() => navigation.goBack()} logoSource={require("../assets/logo.png")} />

        <LinearGradient colors={["#fff", "#fff"]} style={styles.gradientBackground}>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: insets.bottom + 100 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Safe Zone Status Bar */}
            {safeZoneDistanceLabel && (
              <View style={[styles.safeZoneStatus, safeZoneDistanceLabel.isOutside ? styles.safeZoneStatusDanger : styles.safeZoneStatusSafe]}>
                <Ionicons
                  name={safeZoneDistanceLabel.isOutside ? "warning" : "shield-checkmark"}
                  size={14}
                  color={safeZoneDistanceLabel.isOutside ? "#D32F2F" : "#2E7D32"}
                />
                <Text style={[styles.safeZoneStatusText, { color: safeZoneDistanceLabel.isOutside ? "#D32F2F" : "#2E7D32" }]}>
                  {safeZoneDistanceLabel.label}
                </Text>
              </View>
            )}

            {/* Search + Safe Zone Toggle */}
            <View style={styles.searchContainer}>
              <View style={styles.searchBar}>
                <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search safe places..."
                  placeholderTextColor="#999"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")}>
                    <Ionicons name="close-circle" size={20} color="#999" />
                  </TouchableOpacity>
                )}
              </View>
              <TouchableOpacity
                style={styles.safeZoneBtn}
                onPress={async () => {
                  const s = await AsyncStorage.getItem(STORAGE_KEY_SAFE_ZONE_LOCATION);
                  if (s) await stopGeofencing();
                  else await setCurrentAsSafeZone();
                }}
              >
                <Ionicons name={hasSafeZone ? "shield" : "shield-outline"} size={24} color="#ff007f" />
              </TouchableOpacity>
            </View>

            {/* Search Results */}
            {showSearchResults && (
              <View style={styles.searchResultsContainer}>
                {filteredPlaces.length > 0 ? (
                  filteredPlaces.map((place) => (
                    <TouchableOpacity
                      key={place._id}
                      style={styles.searchResultItem}
                      onPress={() => {
                        if (place.location?.coordinates) {
                          const [lng, lat] = place.location.coordinates;
                          userPanningRef.current = true;
                          setMapRegion({ latitude: lat, longitude: lng, latitudeDelta: 0.01, longitudeDelta: 0.01 });
                          setSearchQuery("");
                          setShowSearchResults(false);
                        }
                      }}
                    >
                      <Ionicons name="location" size={16} color="#ff007f" />
                      <View style={styles.searchResultText}>
                        <Text style={styles.searchResultName}>{place.name}</Text>
                        <Text style={styles.searchResultAddress} numberOfLines={1}>
                          {place.address || "Address not available"}
                        </Text>
                      </View>
                      {/* ✅ Fixed: no nested Text, explicit null check */}
                      <Text style={styles.searchResultDistance}>
                        {place.distanceMeters != null ? formatDistance(place.distanceMeters) : ""}
                      </Text>
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noResults}>
                    <Text style={styles.noResultsText}>No places found matching "{searchQuery}"</Text>
                  </View>
                )}
              </View>
            )}

            {/* Mini Map */}
            <View style={styles.mapContainer}>
              <TouchableOpacity activeOpacity={0.95} onPress={handleMiniMapPress} style={{ height: MAP_HEIGHT }}>
                {mapRegion == null ? (
                  <View style={[styles.mapMock, { height: MAP_HEIGHT }]}>
                    <ActivityIndicator size="small" color="#ff007f" />
                    <Text style={{ color: "#666", marginTop: 6 }}>Locating...</Text>
                  </View>
                ) : (
                  <View style={{ flex: 1 }}>
                    <MapView
                      ref={(r) => { mapRef.current = r; }}
                      style={{ flex: 1, borderRadius: 20 }}
                      region={mapRegion}
                      onRegionChangeComplete={(region) => {
                        setMapRegion(region);
                        if (panResetTimerRef.current) clearTimeout(panResetTimerRef.current);
                        panResetTimerRef.current = setTimeout(() => { userPanningRef.current = false; }, 8000);
                      }}
                      onPanDrag={() => {
                        userPanningRef.current = true;
                        if (panResetTimerRef.current) clearTimeout(panResetTimerRef.current);
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      rotateEnabled={false}
                      pitchEnabled={false}
                    >
                      {/* Draw a circle for every saved place */}
                      {safePlaces
                        .filter((p) => p.location?.coordinates?.length === 2)
                        .map((p) => (
                          <Circle
                            key={`minizone_${p._id}`}
                            center={{ latitude: p.location.coordinates[1], longitude: p.location.coordinates[0] }}
                            radius={SAFE_ZONE_RADIUS}
                            strokeColor="rgba(255,0,127,0.25)"
                            fillColor="rgba(255,0,127,0.05)"
                            strokeWidth={1.5}
                          />
                        ))}

                      {currentLocation && (
                        <Marker coordinate={currentLocation}>
                          <View style={styles.currentMarker}><View style={styles.currentInner} /></View>
                        </Marker>
                      )}

                      {safeZoneCenter && (
                        <Marker coordinate={safeZoneCenter} title="Safe Zone">
                          <View style={styles.safeZoneMarker}>
                            <Ionicons name="shield-checkmark" size={18} color="#ff007f" />
                          </View>
                        </Marker>
                      )}

                      {safePlaces.map((p) => {
                        const lat = p.location?.coordinates?.[1];
                        const lng = p.location?.coordinates?.[0];
                        if (typeof lat !== "number" || typeof lng !== "number") return null;
                        const isPolice =
                          (p.type || p.meta?.type || "").toString().toLowerCase() === "police" ||
                          /\bpolice\b/.test((p.name || "").toLowerCase());
                        return (
                          <Marker key={p._id ?? `${lat}_${lng}`} coordinate={{ latitude: lat, longitude: lng }} title={p.name}>
                            <View style={[styles.placeMarker, isPolice ? { borderColor: "rgba(0,100,255,0.45)" } : {}]}>
                              <View style={styles.placeInner} />
                            </View>
                          </Marker>
                        );
                      })}
                    </MapView>

                    <View style={styles.expandHint} pointerEvents="none">
                      <View style={styles.expandPill}>
                        <Ionicons name="expand" size={12} color="#fff" />
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.recenterBtn}
                      onPress={(e) => { e.stopPropagation(); handleRecenter(); }}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="locate" size={20} color="#ff007f" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Active card — shows nearest place */}
            <View style={styles.activeCard}>
              {topTarget ? (
                <>
                  <Text style={styles.activeName}>{topTarget.name}</Text>
                  <Text style={styles.activeAddress}>{topTarget.address ?? ""}</Text>
                  {nearestPolice ? (
                    <View style={[styles.activeBadge, { backgroundColor: "#e8f0ff" }]}>
                      <Text style={[styles.badgeText, { color: "#0b57d0" }]}>Nearest Police</Text>
                    </View>
                  ) : (
                    <View style={styles.activeBadge}>
                      <Text style={styles.badgeText}>Safe Place</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    {/* ✅ Fixed: explicit null checks, no raw expression outside Text */}
                    <Text style={styles.infoText}>
                      {topTarget.distanceMeters != null ? formatDistance(topTarget.distanceMeters) : "—"}
                    </Text>
                    <Text style={styles.infoText}>
                      {topTarget.distanceMeters != null ? estimateWalkingETA(topTarget.distanceMeters) : "—"}
                    </Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.navigateBtn} onPress={handleNavigate} activeOpacity={0.8}>
                      <Text style={styles.navigateText}>Navigate</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.activeName, { color: "#666" }]}>No saved places</Text>
                  <Text style={[styles.activeAddress, { color: "#999" }]}>
                    Tap "+ Add Safe Place" below to get started
                  </Text>
                </>
              )}
            </View>

            {/* Add Safe Place Button */}
            <TouchableOpacity style={styles.addPlaceBtn} onPress={() => setAddSheetVisible(true)} activeOpacity={0.85}>
              <LinearGradient
                colors={["#ff007f", "#c8005e"]}
                style={styles.addPlaceBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.addPlaceBtnText}>Add Safe Place</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* List header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <Text style={styles.listHeader}>
                Your Safe Spaces {safePlaces.length > 0 ? `(${safePlaces.length})` : ""}
              </Text>
              {loading && <ActivityIndicator size="small" color="#ff007f" />}
            </View>

            {/* Places list */}
            {safePlaces.map((space) => (
              <TouchableOpacity
                key={space._id ?? space.name}
                onLongPress={() => deleteSafePlace(space._id)}
                style={styles.listCard}
                activeOpacity={0.7}
              >
                <View style={styles.listLeft}>
                  <View style={[styles.iconCircle, { backgroundColor: "#ff007f" }]}>
                    <Ionicons name="shield-checkmark" size={18} color="#fff" />
                  </View>
                  <View style={styles.textContainer}>
                    <Text style={styles.listName} numberOfLines={1} ellipsizeMode="tail">{space.name}</Text>
                    <Text style={styles.listSubtitle} numberOfLines={2} ellipsizeMode="tail">
                      {space.address || "Address not available"}
                    </Text>
                  </View>
                </View>
                <View style={styles.rightBlock}>
                  {/* ✅ Fixed: explicit null checks throughout */}
                  <Text style={styles.distance}>
                    {space.distanceMeters != null ? formatDistance(space.distanceMeters) : "—"}
                  </Text>
                  <Text style={styles.time}>
                    {space.distanceMeters != null ? estimateWalkingETA(space.distanceMeters) : "—"}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}

            {safePlaces.length === 0 && (
              <View style={styles.emptyState}>
                <Ionicons name="shield-outline" size={40} color="#ddd" />
                <Text style={styles.emptyText}>No safe places yet</Text>
                <Text style={styles.emptySubText}>
                  Tap "Add Safe Place" above or long-press on the expanded map
                </Text>
              </View>
            )}

            <View style={[styles.bottomBtns, { marginTop: 16 }]}>
              <TouchableOpacity style={styles.callSupportBtn} onPress={handleCallSupport} activeOpacity={0.8}>
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.callSupportText}>Call Support</Text>
              </TouchableOpacity>
              <LinearGradient colors={["#4b00ff", "#8e2de2"]} style={styles.getComfortBtn}>
                <Ionicons name="heart" size={18} color="#fff" />
                <Text style={styles.getComfortText}>Get Comfort</Text>
              </LinearGradient>
            </View>
          </ScrollView>
        </LinearGradient>

        <View style={[styles.fixedBottom, { paddingBottom: insets.bottom ? insets.bottom : 12 }]} pointerEvents="box-none">
          <BottomNavBar
            onHome={() => navigation.navigate("Dashboard")}
            onLocation={() => navigation.navigate("SafeSpacesScreen")}
            onSOS={() => navigation.navigate("SOSScreen")}
            onLegal={() => navigation.navigate("LegalSupportScreen")}
            onContacts={() => navigation.navigate("ContactsScreen")}
          />
        </View>
      </View>

      {/* Fullscreen Map */}
      <FullscreenMapModal
        visible={fullscreenMapVisible}
        mapRegion={mapRegion}
        currentLocation={currentLocation}
        safeZoneCenter={safeZoneCenter}
        safePlaces={safePlaces}
        addingCoord={addingCoord}
        onClose={() => { setFullscreenMapVisible(false); setAddingCoord(null); }}
        onLongPress={handleFullscreenLongPress}
      />

      {/* Map-pick name modal */}
      <Modal
        visible={mapPickModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMapPickModalVisible(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: "700", marginBottom: 8, color: "#3D246C", fontSize: 15 }}>
              Name this place
            </Text>
            <TextInput
              placeholder="Place name (optional)"
              placeholderTextColor="#bbb"
              value={mapPickName}
              onChangeText={setMapPickName}
              style={{ borderWidth: 1, borderColor: "#eee", borderRadius: 10, padding: 12, width: "100%", marginBottom: 14, color: "#333", fontSize: 14 }}
              autoFocus
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setMapPickModalVisible(false); setAddingCoord(null); }}
                style={[styles.btn, { backgroundColor: "#f0f0f0", flex: 1 }]}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#666", fontWeight: "600" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveMapPickPlace}
                style={[styles.btn, { backgroundColor: "#ff007f", flex: 1 }]}
                activeOpacity={0.8}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>Save Place</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add Safe Place Bottom Sheet */}
      <AddPlaceSheet
        visible={addSheetVisible}
        currentLocation={currentLocation}
        onClose={() => setAddSheetVisible(false)}
        onOpenMap={handleSheetOpenMap}
        onSave={createSafePlace}
      />

      <ThemeAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", position: "relative" },
  gradientBackground: { flex: 1, paddingHorizontal: 5, paddingTop: 2 },
  mapContainer: { marginVertical: 20, borderRadius: 20, overflow: "hidden" },
  mapMock: { backgroundColor: "#f8f6ff", borderRadius: 20, height: 160, justifyContent: "center", alignItems: "center" },
  activeCard: { backgroundColor: "#f9f9f9", borderRadius: 15, padding: 15, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  activeName: { fontWeight: "700", fontSize: 16, color: "#333" },
  activeAddress: { color: "#777", marginBottom: 5 },
  activeBadge: { alignSelf: "flex-start", backgroundColor: "#e0ffe0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 10 },
  badgeText: { color: "#2a8a2a", fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  infoText: { color: "#555", fontSize: 14 },
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  navigateBtn: { backgroundColor: "#ff007f", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  navigateText: { color: "#fff", fontWeight: "600" },
  addPlaceBtn: { marginTop: 14, marginBottom: 6, borderRadius: 12, overflow: "hidden" },
  addPlaceBtnGradient: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13 },
  addPlaceBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  listHeader: { fontWeight: "700", fontSize: 15, color: "#444", marginBottom: 10 },
  listCard: { backgroundColor: "#f9f9f9", borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconCircle: { width: 35, height: 35, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  textContainer: { flex: 1, marginLeft: 10, marginRight: 8 },
  listName: { fontWeight: "600", fontSize: 14, flexShrink: 1 },
  listSubtitle: { color: "#777", fontSize: 12, flexWrap: "wrap" },
  rightBlock: { width: 90, alignItems: "flex-end", justifyContent: "center" },
  distance: { color: "#ff007f", fontWeight: "600", textAlign: "right" },
  time: { color: "#777", fontSize: 12, textAlign: "right", marginTop: 4 },
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 15, fontWeight: "600", color: "#bbb" },
  emptySubText: { fontSize: 12, color: "#ccc", textAlign: "center", maxWidth: 240 },
  bottomBtns: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  callSupportBtn: { backgroundColor: "#ff007f", flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 1, paddingVertical: 12, borderRadius: 10, marginRight: 8 },
  callSupportText: { color: "#fff", fontWeight: "600", marginLeft: 6 },
  getComfortBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 10, paddingVertical: 12, marginLeft: 8 },
  getComfortText: { color: "#fff", fontWeight: "600", marginLeft: 6 },
  currentMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(233,35,127,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(233,35,127,0.25)" },
  currentInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e9237f" },
  placeMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(233,35,127,0.25)" },
  placeInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e9237f" },
  safeZoneMarker: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(255,0,127,0.4)", shadowColor: "#ff007f", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  fixedBottom: { position: "absolute", left: 0, right: 0, bottom: 0, alignItems: "center", zIndex: 999, elevation: 20 },
  modalContent: { padding: 20, backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  searchContainer: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBar: { flex: 1, flexDirection: "row", alignItems: "center", backgroundColor: "#f9f9f9", borderRadius: 12, paddingHorizontal: 12, paddingVertical: Platform.OS === "ios" ? 12 : 8, borderWidth: 1, borderColor: "#eee", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: "#333", padding: 0 },
  safeZoneBtn: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#f9f9f9", justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: "#eee", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  searchResultsContainer: { backgroundColor: "#fff", borderRadius: 12, marginBottom: 15, maxHeight: 250, borderWidth: 1, borderColor: "#eee", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 },
  searchResultItem: { flexDirection: "row", alignItems: "center", padding: 12, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  searchResultText: { flex: 1, marginLeft: 10, marginRight: 8 },
  searchResultName: { fontSize: 14, fontWeight: "600", color: "#333" },
  searchResultAddress: { fontSize: 12, color: "#777", marginTop: 2 },
  searchResultDistance: { fontSize: 12, color: "#ff007f", fontWeight: "600" },
  noResults: { padding: 16, alignItems: "center" },
  noResultsText: { color: "#999", fontSize: 14 },
  recenterBtn: { position: "absolute", bottom: 12, right: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", justifyContent: "center", alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 5 },
  safeZoneStatus: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, marginBottom: 12 },
  safeZoneStatusSafe: { backgroundColor: "#E8F5E9", borderWidth: 1, borderColor: "#A5D6A7" },
  safeZoneStatusDanger: { backgroundColor: "#FFEBEE", borderWidth: 1, borderColor: "#EF9A9A" },
  safeZoneStatusText: { fontSize: 12, fontWeight: "600" },
  expandHint: { position: "absolute", top: 6, right: 6 },
  expandPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.42)", paddingHorizontal: 5, paddingVertical: 5, borderRadius: 20 },
});

// ─── Background geofencing task ───────────────────────────────────────────────
TaskManager.defineTask(GEOFENCING_TASK, async ({ data, error }) => {
  if (error) { console.error("Geofencing task error:", error); return; }
  if (!data) return;
  const { locations } = data as any;
  const location = locations?.[0];
  if (!location) return;
  const { latitude, longitude } = location.coords;
  try {
    const safeZoneStr = await AsyncStorage.getItem(STORAGE_KEY_SAFE_ZONE_LOCATION);
    if (!safeZoneStr) return;
    const safeZone = JSON.parse(safeZoneStr);
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(safeZone.latitude - latitude);
    const dLon = toRad(safeZone.longitude - longitude);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(latitude)) * Math.cos(toRad(safeZone.latitude)) * Math.sin(dLon / 2) ** 2;
    const distance = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (distance > SAFE_ZONE_RADIUS) {
      // Use dynamic import so Expo Go doesn't crash in background task too
      if (!isExpoGo) {
        const Notifications = await import("expo-notifications");
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "⚠️ Safe Zone Alert",
            body: `You are ${(distance / 1000).toFixed(1)} km away from your safe zone. Open app to confirm you're safe or trigger SOS.`,
            sound: true,
            data: { type: "safe_zone_alert", distanceKm: distance / 1000 },
            categoryIdentifier: "SAFE_ZONE_ALERT",
          },
          trigger: null,
        });
      }
    }
  } catch (e) {
    console.warn("Background geofencing task error:", e);
  }
});