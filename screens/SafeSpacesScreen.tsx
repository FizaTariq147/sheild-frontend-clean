// src/screens/SafeSpacesScreen.tsx
import React, { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Navbar from "../components/SpaceTopBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import getAuthHeaders from "../helpers/authHeaders";
import BottomNavBar from "../components/BottomNavBar";
import { ThemeAlert } from "../components/ThemeAlert"; // ADDED

const API_BASE_URL = "http://192.168.100.12:5050";
const STORAGE_KEY_SAFEPLACES = "SAFE_PLACES_V1";
const STORAGE_KEY_CURRENT_LOCATION = "CURRENT_LOCATION_V1";
const MAP_HEIGHT = 250;

type SafeSpaceScreenNavProp = StackNavigationProp<RootStackParamList, "SafeSpacesScreen">;
type Props = { navigation: SafeSpaceScreenNavProp };

export default function SafeSpacesScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [safePlaces, setSafePlaces] = useState<any[]>([]);
  const [nearestPolice, setNearestPolice] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [addingCoord, setAddingCoord] = useState<{ latitude: number; longitude: number } | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [newPlaceName, setNewPlaceName] = useState("");

  // ADDED: Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

  const mapRef = useRef<MapView | null>(null);
  const watchSubscription = useRef<any>(null);
  const lastFetchRef = useRef<number>(0);
  const lastReverseRef = useRef<number>(0);
  const lastSavedLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);

  // ADDED: Show alert function
  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    type: 'info' | 'error' | 'warning' | 'success' = 'info'
  ) => {
    setAlertConfig({
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK' }],
    });
    setAlertVisible(true);
  };

  const getPerUserStorageKey = async () => {
    try {
      const headers = await getAuthHeaders();
      const token = headers?.Authorization?.split?.(" ")?.[1] ?? "";
      const suffix = token ? token.slice(-8) : "anon";
      return `${STORAGE_KEY_SAFEPLACES}_${suffix}`;
    } catch (e) {
      return STORAGE_KEY_SAFEPLACES + "_anon";
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const key = await getPerUserStorageKey();
        const raw = await AsyncStorage.getItem(key);
        if (raw) setSafePlaces(JSON.parse(raw));
      } catch (e) {
        console.warn("load safe places cache failed", e);
      }

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          // CHANGED: Alert.alert to showAlert
          showAlert(
            "Location permission required", 
            "Enable location in settings.",
            [{ text: "OK" }],
            "warning"
          );
          return;
        }

        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest });
        const initial = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
        setCurrentLocation(initial);

        maybeReverseGeocodeAndSave(initial.latitude, initial.longitude, true);
        fetchNearbyPlaces(pos.coords.latitude, pos.coords.longitude);

        const sub = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Highest, distanceInterval: 5, timeInterval: 3000 },
          (p) => {
            const lat = p.coords.latitude;
            const lng = p.coords.longitude;
            setCurrentLocation({ latitude: lat, longitude: lng });
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
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const key = await getPerUserStorageKey();
        await AsyncStorage.setItem(key, JSON.stringify(safePlaces));
      } catch (e) {}
    })();
    computeNearestPolice(safePlaces);
  }, [safePlaces]);

  useEffect(() => {
    computeNearestPolice(safePlaces);
  }, [currentLocation]);

  const distanceMetersBetween = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const computeNearestPolice = (places: any[]) => {
    if (!places || places.length === 0) {
      setNearestPolice(null);
      return;
    }

    const policeCandidates = places.filter((p) => {
      const t = String(p.type || p.meta?.type || "").toLowerCase();
      if (t === "police" || t === "police_station" || t === "police-station") return true;
      const name = String(p.name || "").toLowerCase();
      const addr = String(p.address || "").toLowerCase();
      if (/\bpolice\b/.test(name) || /\bpolice\b/.test(addr)) return true;
      if (/\bpolice station\b/.test(name) || /\bpolice station\b/.test(addr) || /\bpolice-station\b/.test(name)) return true;
      return false;
    });

    if (policeCandidates.length === 0) {
      setNearestPolice(null);
      return;
    }

    const enriched = policeCandidates.map((p) => {
      let d = typeof p.distanceMeters === "number" ? p.distanceMeters : null;
      if ((d === null || isNaN(d)) && currentLocation && p.location && Array.isArray(p.location.coordinates)) {
        const [lng, lat] = p.location.coordinates;
        d = distanceMetersBetween(currentLocation.latitude, currentLocation.longitude, lat, lng);
      }
      return { ...p, distanceMeters: (d === null || isNaN(d)) ? Number.POSITIVE_INFINITY : d };
    });

    enriched.sort((a, b) => (a.distanceMeters ?? Number.POSITIVE_INFINITY) - (b.distanceMeters ?? Number.POSITIVE_INFINITY));
    setNearestPolice(enriched[0] ?? null);
  };

  const formatDistance = (meters?: number) => {
    if (!meters && meters !== 0) return "—";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(2)} km`;
  };

  const estimateWalkingETA = (meters?: number) => {
    if (!meters && meters !== 0) return "—";
    const metersPerMin = 5000 / 60;
    const mins = Math.max(1, Math.round((meters || 0) / metersPerMin));
    if (mins < 60) return `${mins} min Walking`;
    const hrs = Math.floor(mins / 60);
    const rem = mins % 60;
    return rem === 0 ? `${hrs} hr Walking` : `${hrs} hr ${rem} min Walking`;
  };

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

  const maybeReverseGeocodeAndSave = async (latitude: number, longitude: number, force = false) => {
    try {
      const now = Date.now();
      const lastReverse = lastReverseRef.current || 0;
      const lastSaved = lastSavedLocationRef.current;
      const moved = lastSaved ? distanceMetersBetween(lastSaved.latitude, lastSaved.longitude, latitude, longitude) : Number.POSITIVE_INFINITY;

      const MIN_MOVE_FOR_REVERSE = 50;
      const MIN_REVERSE_INTERVAL = 8000;

      if (!force && (now - lastReverse < MIN_REVERSE_INTERVAL) && moved < MIN_MOVE_FOR_REVERSE) {
        return;
      }

      lastReverseRef.current = now;

      const places = await Location.reverseGeocodeAsync({ latitude, longitude });
      let addressStr = "";
      if (Array.isArray(places) && places.length > 0) {
        const p = places[0];
        const parts = [
          p.name || "",
          p.street || "",
          p.city || "",
          p.region || "",
          p.postalCode || "",
          p.country || ""
        ].filter(Boolean);
        addressStr = parts.join(", ");
      }

      const dms = toDMS(latitude, longitude);
      const saved = {
        latitude,
        longitude,
        dms,
        address: addressStr,
        timestamp: new Date().toISOString(),
      };

      await AsyncStorage.setItem(STORAGE_KEY_CURRENT_LOCATION, JSON.stringify(saved));
      lastSavedLocationRef.current = { latitude, longitude };
    } catch (e) {
      console.warn("reverse geocode/save failed", e);
    }
  };

  const fetchNearbyPlaces = async (latitude: number, longitude: number) => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const q = `lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}&radius=5000&mine=true`;
      const res = await fetch(`${API_BASE_URL}/api/safeplaces?${q}`, { method: "GET", headers });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.warn("fetchNearbyPlaces server returned not ok", res.status, text);
        setLoading(false);
        return;
      }
      const data = await res.json();
      const normalized = Array.isArray(data) ? data.map((d: any) => ({
        _id: d._id || d.id,
        name: d.name,
        address: d.address || "",
        location: d.location,
        distanceMeters: typeof d.distanceMeters === "number" ? d.distanceMeters : d.distanceMeters,
        createdAt: d.createdAt,
        type: d.type || d.meta?.type || null,
        meta: d.meta || {}
      })) : [];
      console.debug("fetchNearbyPlaces -> normalized:", normalized.map((p: any) => ({
        id: p._id, name: p.name, type: p.type, address: p.address, distanceMeters: p.distanceMeters, coords: p.location?.coordinates
      })));
      setSafePlaces(normalized);
      try {
        const key = await getPerUserStorageKey();
        await AsyncStorage.setItem(key, JSON.stringify(normalized));
      } catch (_) {}
    } catch (e) {
      console.warn("fetchNearbyPlaces failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const createSafePlace = async (name: string, latitude: number, longitude: number, address?: string) => {
    try {
      const headers = await getAuthHeaders();
      const headersWithJson = { ...headers, "Content-Type": "application/json" };
      const body = { name, address: address || "", latitude, longitude };
      const res = await fetch(`${API_BASE_URL}/api/safeplaces`, { method: "POST", headers: headersWithJson, body: JSON.stringify(body) });
      const txt = await res.text().catch(() => null);
      if (!res.ok) {
        console.warn("createSafePlace failed", res.status, txt);
        // CHANGED: Alert.alert to showAlert
        showAlert(
          "Failed", 
          "Save failed: " + (txt || res.status),
          [{ text: "OK" }],
          "error"
        );
        return;
      }
      const created = JSON.parse(txt || "{}");
      const sp = { _id: created._id || created.id, name: created.name, address: created.address || "", location: created.location, distanceMeters: created.distanceMeters, type: created.type || created.meta?.type || null, meta: created.meta || {} };
      setSafePlaces((s) => {
        const next = [sp, ...s];
        (async () => {
          try { const key = await getPerUserStorageKey(); await AsyncStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
        })();
        return next;
      });
    } catch (e) {
      console.warn("createSafePlace error", e);
      // CHANGED: Alert.alert to showAlert
      showAlert("Network error", "Failed to create place", [{ text: "OK" }], "error");
    }
  };

  const deleteSafePlace = async (id?: string) => {
    if (!id) return;
    
    // CHANGED: Alert.alert to showAlert with confirmation dialog
    showAlert(
      "Remove", 
      "Remove this place?",
      [
        { 
          text: "Cancel", 
          style: "cancel",
          onPress: () => {
            // Do nothing on cancel
          }
        }, 
        { 
          text: "Remove", 
          style: "destructive", 
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${API_BASE_URL}/api/safeplaces/${id}`, { method: "DELETE", headers });
              if (!res.ok) {
                const t = await res.text().catch(() => null);
                console.warn("delete failed", res.status, t);
                // CHANGED: Alert.alert to showAlert
                showAlert("Failed", "Could not remove place", [{ text: "OK" }], "error");
                return;
              }
              setSafePlaces((s) => {
                const next = s.filter(sp => sp._id !== id);
                (async () => {
                  try { const key = await getPerUserStorageKey(); await AsyncStorage.setItem(key, JSON.stringify(next)); } catch (_) {}
                })();
                return next;
              });
            } catch (e) {
              console.warn("deleteSafePlace error", e);
              // CHANGED: Alert.alert to showAlert
              showAlert("Network error", "Failed to remove place", [{ text: "OK" }], "error");
            }
          }
        }
      ],
      "warning"
    );
  };

  const handleMapPress = (ev: MapPressEvent) => {
    const { coordinate } = ev.nativeEvent;
    setAddingCoord({ latitude: coordinate.latitude, longitude: coordinate.longitude });
    setNewPlaceName("");
    setModalVisible(true);
  };

  const saveNewPlace = async () => {
    if (!addingCoord) return;
    const nameToUse = newPlaceName.trim() || `Safe Place ${safePlaces.length + 1}`;

    let addressStr = "";
    try {
      const [place] = await Location.reverseGeocodeAsync({ latitude: addingCoord.latitude, longitude: addingCoord.longitude }) || [];
      if (place) {
        const parts = [
          place.name || "",
          place.street || "",
          place.city || "",
          place.region || "",
          place.postalCode || "",
          place.country || ""
        ].filter(Boolean);
        addressStr = parts.join(", ");
      }
    } catch (e) {
      console.warn("reverse geocode failed", e);
    }

    setModalVisible(false);
    await createSafePlace(nameToUse, addingCoord.latitude, addingCoord.longitude, addressStr);
    setAddingCoord(null);
  };

  const topTarget = nearestPolice ?? safePlaces[0] ?? null;

  const handleNavigate = () => {
    const p = topTarget;
    if (p && p.location?.coordinates) {
      const [lng, lat] = p.location.coordinates;
      const url = Platform.select({ 
        ios: `maps:0,0?q=${lat},${lng}`, 
        android: `geo:${lat},${lng}?q=${lat},${lng}` 
      });
      url && Linking.openURL(url).catch(() => {
        // CHANGED: Alert.alert to showAlert
        showAlert("Error", "Could not open maps", [{ text: "OK" }], "error");
      });
    } else {
      // CHANGED: Alert.alert to showAlert
      showAlert("No place", "No navigation target available.", [{ text: "OK" }], "warning");
    }
  };

  const handleCallSupport = () => {
    // CHANGED: Alert.alert to showAlert
    showAlert("Calling support", "Feature not implemented yet", [{ text: "OK" }], "info");
  };

  return (
    <>
      <View style={styles.container}>
        <Navbar
          title="Safe Spaces"
          onBack={() => navigation.goBack()}
          logoSource={require("../assets/logo.png")}
        />
        <LinearGradient colors={["#f9f9f9", "#f9f9f9"]} style={styles.gradientBackground}>
          <ScrollView
            contentContainerStyle={{
              paddingHorizontal: 20,
              paddingTop: 10,
              paddingBottom: insets.bottom + 100, // leave space for bottom bar
            }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.mapContainer}>
              <View style={{ height: MAP_HEIGHT }}>
                {currentLocation == null ? (
                  <View style={[styles.mapMock, { height: MAP_HEIGHT }]}>
                    <ActivityIndicator size="small" color="#ff007f" />
                    <Text style={{ color: "#666", marginTop: 6 }}>Locating...</Text>
                  </View>
                ) : (
                  <MapView
                    ref={(r) => { mapRef.current = r; }}
                    style={{ flex: 1, borderRadius: 20, overflow: "hidden" }}
                    initialRegion={{
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                      latitudeDelta: 0.02,
                      longitudeDelta: 0.02,
                    }}
                    onPress={handleMapPress}
                  >
                    <Marker coordinate={{ latitude: currentLocation.latitude, longitude: currentLocation.longitude }}>
                      <View style={styles.currentMarker}><View style={styles.currentInner} /></View>
                    </Marker>

                    {safePlaces.map((p) => {
                      const lat = p.location?.coordinates?.[1];
                      const lng = p.location?.coordinates?.[0];
                      if (typeof lat !== "number" || typeof lng !== "number") return null;
                      const isPolice = (p.type || p.meta?.type || "").toString().toLowerCase() === "police" ||
                        /\bpolice\b/.test((p.name || "").toLowerCase()) || /\bpolice\b/.test((p.address || "").toLowerCase());
                      return (
                        <Marker key={p._id ?? p.id ?? `${lat}_${lng}`} coordinate={{ latitude: lat, longitude: lng }} title={p.name}>
                          <View style={[styles.placeMarker, isPolice ? { borderColor: "rgba(0,100,255,0.45)" } : {}]}>
                            <View style={styles.placeInner} />
                          </View>
                        </Marker>
                      );
                    })}
                  </MapView>
                )}
              </View>
            </View>

            <View style={styles.activeCard}>
              {topTarget ? (
                <>
                  <Text style={styles.activeName}>{topTarget?.name}</Text>
                  <Text style={styles.activeAddress}>{topTarget?.address ?? ""}</Text>
                  {nearestPolice ? (
                    <View style={[styles.activeBadge, { backgroundColor: "#e8f0ff" }]}><Text style={[styles.badgeText, { color: "#0b57d0" }]}>Nearest Police</Text></View>
                  ) : (
                    <View style={styles.activeBadge}><Text style={styles.badgeText}>Saved Place</Text></View>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoText}>{topTarget?.distanceMeters ? formatDistance(topTarget.distanceMeters) : "—"}</Text>
                    <Text style={styles.infoText}>{topTarget?.distanceMeters ? estimateWalkingETA(topTarget.distanceMeters) : "—"}</Text>
                  </View>
                  <View style={styles.actionRow}>
                    <TouchableOpacity 
                      style={styles.navigateBtn} 
                      onPress={handleNavigate}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.navigateText}>Navigate</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.activeName, { color: "#666" }]}>No saved places</Text>
                  <Text style={[styles.activeAddress, { color: "#999" }]}>Tap the map to add your first safe place</Text>
                </>
              )}
            </View>

            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
              <Text style={styles.listHeader}>Your Safe Spaces</Text>
              {loading && <ActivityIndicator size="small" color="#ff007f" />}
            </View>

            {safePlaces.map((space) => {
              const distanceLabel = space.distanceMeters ? formatDistance(space.distanceMeters) : "—";
              return (
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
                      <Text style={styles.listSubtitle} numberOfLines={2} ellipsizeMode="tail">{space.address ?? "Address not available"}</Text>
                    </View>
                  </View>
                  <View style={styles.rightBlock}>
                    <Text style={styles.distance}>{distanceLabel}</Text>
                    <Text style={styles.time}>{space.distanceMeters ? estimateWalkingETA(space.distanceMeters) : "—"}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}

            {safePlaces.length === 0 && (
              <View style={{ padding: 16 }}>
                <Text style={{ color: "#666" }}>No saved places. Tap map to add a safe place with exact address.</Text>
              </View>
            )}

            <View style={[styles.bottomBtns, { marginTop: 16 }]}>
              <TouchableOpacity 
                style={styles.callSupportBtn} 
                onPress={handleCallSupport}
                activeOpacity={0.8}
              >
                <Ionicons name="call" size={18} color="#fff" />
                <Text style={styles.callSupportText}>Call Support</Text>
              </TouchableOpacity>

              <LinearGradient colors={["#4b00ff", "#8e2de2"]} style={styles.getComfortBtn}>
                <Ionicons name="heart" size={18} color="#fff" />
                <Text style={styles.getComfortText}>Get Comfort</Text>
              </LinearGradient>
            </View>
          </ScrollView>

          <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
            <View style={styles.modalWrap}>
              <View style={styles.modalContent}>
                <Text style={{ fontWeight: "700", marginBottom: 8, color: "#3D246C" }}>Add safe place</Text>
                <TextInput 
                  placeholder="Place name (optional)" 
                  placeholderTextColor="#999"
                  value={newPlaceName} 
                  onChangeText={setNewPlaceName} 
                  style={{ 
                    borderWidth: 1, 
                    borderColor: "#eee", 
                    borderRadius: 8, 
                    padding: 10, 
                    width: "100%", 
                    marginBottom: 12,
                    color: "#333"
                  }} 
                />
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <TouchableOpacity 
                    onPress={() => { setModalVisible(false); setAddingCoord(null); }} 
                    style={[styles.btn, { backgroundColor: "#eee" }]}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: "#666" }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={saveNewPlace} 
                    style={[styles.btn, { backgroundColor: "#e9237f" }]}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: "#fff", fontWeight: "600" }}>Save place</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </LinearGradient>

        <View
          style={[
            styles.fixedBottom,
            { paddingBottom: insets.bottom ? insets.bottom : 12 },
          ]}
          pointerEvents="box-none"
        >
          <BottomNavBar
            onHome={() => navigation.navigate("Dashboard")}
            onLocation={() => navigation.navigate("SafeSpacesScreen")}
            onSOS={() => navigation.navigate("SOSScreen")}
            onLegal={() => navigation.navigate("LegalSupportScreen")}
            onContacts={() => navigation.navigate("ContactsScreen")}
          />
        </View>
      </View>

      {/* ADDED: Theme Alert Component */}
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

// KEPT ALL YOUR EXISTING STYLES EXACTLY THE SAME
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", position: "relative" },
  gradientBackground: { flex: 1, paddingHorizontal: 5, paddingTop: 2 },
  mapContainer: { marginVertical: 20, borderRadius: 20, overflow: "hidden" },
  mapMock: { backgroundColor: "#f8f6ff", borderRadius: 20, height: 160, justifyContent: "center", alignItems: "center" },
  activeCard: { backgroundColor: "#fff", borderRadius: 15, padding: 15, shadowColor: "#000", shadowOpacity: 0.1, shadowRadius: 5, elevation: 3 },
  activeName: { fontWeight: "700", fontSize: 16, color: "#333" },
  activeAddress: { color: "#777", marginBottom: 5 },
  activeBadge: { alignSelf: "flex-start", backgroundColor: "#e0ffe0", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 10 },
  badgeText: { color: "#2a8a2a", fontSize: 12, fontWeight: "600" },
  infoRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  infoText: { color: "#555", fontSize: 14 },
  actionRow: { flexDirection: "row", justifyContent: "space-between" },
  navigateBtn: { backgroundColor: "#ff007f", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 25 },
  navigateText: { color: "#fff", fontWeight: "600" },
  callBtn: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingVertical: 8 },
  listHeader: { fontWeight: "700", fontSize: 15, color: "#444", marginBottom: 10 },
  listCard: { backgroundColor: "#fff", borderRadius: 10, padding: 10, marginBottom: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  listLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconCircle: { width: 35, height: 35, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  textContainer: { flex: 1, marginLeft: 10, marginRight: 8 },
  listName: { fontWeight: "600", fontSize: 14, flexShrink: 1 },
  listSubtitle: { color: "#777", fontSize: 12, flexWrap: "wrap" },
  rightBlock: { width: 90, alignItems: "flex-end", justifyContent: "center" },
  distance: { color: "#ff007f", fontWeight: "600", textAlign: "right" },
  time: { color: "#777", fontSize: 12, textAlign: "right", marginTop: 4 },
  bottomBtns: { flexDirection: "row", justifyContent: "space-between", marginTop: 15 },
  callSupportBtn: { backgroundColor: "#ff007f", flexDirection: "row", alignItems: "center", justifyContent: "center", flex: 1, paddingVertical: 12, borderRadius: 10, marginRight: 8 },
  callSupportText: { color: "#fff", fontWeight: "600", marginLeft: 6 },
  getComfortBtn: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", borderRadius: 10, paddingVertical: 12, marginLeft: 8 },
  getComfortText: { color: "#fff", fontWeight: "600", marginLeft: 6 },
  currentMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(233,35,127,0.15)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(233,35,127,0.25)" },
  currentInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e9237f" },
  placeMarker: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "rgba(233,35,127,0.25)" },
  placeInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#e9237f" },
  modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  fixedBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 999,
    elevation: 20,
  },
  modalContent: { padding: 16, backgroundColor: "#fff", borderTopLeftRadius: 12, borderTopRightRadius: 12 },
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, minWidth: 110, alignItems: "center", justifyContent: "center" },
});