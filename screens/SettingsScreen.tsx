import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
  Image,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Navbar from "../components/SettingTopBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ThemeAlert } from "../components/ThemeAlert";

type SettingsScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "SettingsScreen"
>;

type Props = {
  navigation: SettingsScreenNavProp;
};

const API_BASE_URL = "https://fiza-tariq-shield-backend.hf.space";

export default function SettingsScreen({ navigation }: Props) {
  const [voice, setVoice] = useState(false);
  const [location, setLocation] = useState(false);
  const [recording, setRecording] = useState(false);
  const [vibration, setVibration] = useState(false);
  const [pin, setPin] = useState("");
  const [aiModelActive, setAiModelActive] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  // ── NEW: avatar url ──
  const [avatarUri, setAvatarUri] = useState<string | null>(null);

  const [signingOut, setSigningOut] = useState(false);

  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    type: "info" as "info" | "error" | "warning" | "success",
    buttons: [] as Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
  });

  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{
      text: string;
      onPress?: () => void;
      style?: "default" | "cancel" | "destructive";
    }>,
    type: "info" | "error" | "warning" | "success" = "info"
  ) => {
    setAlertConfig({ title, message, type, buttons: buttons || [{ text: "OK" }] });
    setAlertVisible(true);
  };

  // ── Load app settings ────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const loadSettings = async () => {
        try {
          const saved = await AsyncStorage.getItem("appSettings");
          if (saved && isActive) {
            const parsed = JSON.parse(saved);
            setVoice(parsed.voice ?? false);
            setLocation(parsed.location ?? false);
            setRecording(parsed.recording ?? false);
            setVibration(parsed.vibration ?? false);
            setPin(parsed.pin ?? "");
          }
          const aiState = await AsyncStorage.getItem("aiModelActive");
          if (isActive) {
            setAiModelActive(aiState === "true");
            setSettingsLoaded(true);
          }
        } catch (err) {
          console.error("Error loading settings:", err);
          if (isActive) setSettingsLoaded(true);
        }
      };
      loadSettings();
      return () => {
        isActive = false;
        setSettingsLoaded(false);
      };
    }, [])
  );

  // ── Save app settings ────────────────────────────────────────
  useEffect(() => {
    if (!settingsLoaded) return;
    const saveSettings = async () => {
      await AsyncStorage.setItem(
        "appSettings",
        JSON.stringify({ voice, location, recording, vibration, pin })
      );
    };
    saveSettings();
  }, [voice, location, recording, vibration, pin, settingsLoaded]);

  // ── AI model activation ──────────────────────────────────────
  useEffect(() => {
    if (!settingsLoaded) return;
    const allEnabled = voice && location && recording && vibration;
    if (allEnabled && !aiModelActive) {
      setAiModelActive(true);
      AsyncStorage.setItem("aiModelActive", "true");
      console.log("🤖 AI Model ACTIVATED");
    }
  }, [voice, location, recording, vibration, settingsLoaded]);

  // ── Load user profile (runs every time screen is focused) ────
  useFocusEffect(
    useCallback(() => {
      const loadUser = async () => {
        try {
          // 1. Try AsyncStorage first (fast, works offline)
          const stored = await AsyncStorage.getItem("user");
          if (stored) {
            const userData = JSON.parse(stored);
            applyUserData(userData);
          }

          // 2. Always re-fetch from server to get latest (including new avatar)
          const tokenKeys = [
            "accessToken", "token", "access_token",
            "auth_token", "authToken", "userToken",
          ];
          let authToken: string | null = null;
          for (const key of tokenKeys) {
            const val = await AsyncStorage.getItem(key);
            if (val) { authToken = val; break; }
          }

          if (authToken) {
            const response = await fetch(`${API_BASE_URL}/api/users/profile`, {
              headers: { Authorization: `Bearer ${authToken}` },
            });
            if (response.ok) {
              const data = await response.json();
              const apiUser = data.user || data.data || data.profile || data;
              // saveBack=true → persists full avatar URL to AsyncStorage
              applyUserData(apiUser, true);
            }
          }
        } catch (err) {
          console.error("Error loading user:", err);
        }
      };

      loadUser();

      // Also reload when navigating back from EditProfile
      const unsubscribe = navigation.addListener("focus", loadUser);
      return unsubscribe;
    }, [navigation])
  );

  // ── Helper: extract fields from any user object shape ────────
  const applyUserData = (userData: any, saveBack = false) => {
    const fullName =
      userData.full_name || userData.fullName || userData.name || userData.username || "User";
    const userEmail = userData.email || "No email";
    const created = userData.createdAt || userData.created_at || "";

    // Always build full URL — handles relative /uploads paths from server
    // AND already-full http:// URLs stored in AsyncStorage
    let avatar = userData.avatar || userData.profilePicture || userData.image || null;
    if (avatar && avatar.startsWith("/uploads")) {
      avatar = `${API_BASE_URL}${avatar}`;
    }

    setFullName(fullName);
    setEmail(userEmail);
    setCreatedAt(created);
    setAvatarUri(avatar);

    // If called from server fetch, persist full URL back to AsyncStorage
    if (saveBack && avatar) {
      const updated = { ...userData, avatar };
      AsyncStorage.setItem("user", JSON.stringify(updated)).catch(() => {});
    }
  };

  // ── Sign out ─────────────────────────────────────────────────
  const handleSignOut = async () => {
    if (signingOut) return;
    showAlert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        { text: "Sign Out", style: "destructive", onPress: performSignOut },
      ],
      "warning"
    );
  };

  const performSignOut = async () => {
    setSigningOut(true);
    try {
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      if (refreshToken) {
        try {
          const res = await fetch(`${API_BASE_URL}/api/users/logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });
          if (!res.ok) {
            showAlert("Signed out locally", "Server did not respond.", [{ text: "OK" }], "info");
          }
        } catch {
          showAlert("Signed out locally", "Could not contact server.", [{ text: "OK" }], "info");
        }
      }
    } finally {
      await AsyncStorage.clear();
      setSigningOut(false);
      navigation.replace("Login");
    }
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <>
      <View style={styles.container}>
        <Navbar
          title="Settings"
          onBack={() => navigation.goBack()}
          logoSource={require("../assets/logo.png")}
        />

        {/* USER PROFILE CARD */}
        <View style={styles.profileCard}>
          {/* Avatar circle — shows photo if available, else initial */}
          <View style={styles.profileCircleWrapper}>
            {avatarUri ? (
              <Image
                source={{ uri: avatarUri }}
                style={styles.profileAvatar}
                // If image fails to load (e.g. server down), fall back to initial
                onError={() => setAvatarUri(null)}
              />
            ) : (
              <View style={styles.profileCircle}>
                <Text style={styles.profileInitial}>
                  {full_name ? full_name.charAt(0).toUpperCase() : "?"}
                </Text>
              </View>
            )}
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.profileName}>{full_name}</Text>
            <Text style={styles.profileEmail}>{email}</Text>
            {createdAt ? (
              <Text style={styles.profileSince}>
                Empowered since {new Date(createdAt).toDateString()}
              </Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.editButton}
            onPress={() => navigation.navigate("EditProfile")}
            activeOpacity={0.8}
          >
            <Text style={styles.editText}>Edit</Text>
          </TouchableOpacity>
        </View>

        {/* SUPPORT SETTINGS */}
        <View style={styles.supportCard}>
          <View style={styles.headerRow}>
            <Ionicons name="shield-checkmark" size={22} color="#e9237f" style={styles.iconLeft} />
            <View>
              <Text style={styles.sectionTitle}>Support Settings</Text>
              <Text style={styles.sectionSubtitle}>Configure your safety preferences</Text>
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <Ionicons name="mic-outline" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Voice Activation</Text>
                <Text style={styles.settingDesc}>Trigger SOS with voice</Text>
              </View>
            </View>
            <Switch value={voice} onValueChange={setVoice} trackColor={{ false: "#ccc", true: "#363033ff" }} />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <Ionicons name="location-outline" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Auto Location Sharing</Text>
                <Text style={styles.settingDesc}>Share location in SOS</Text>
              </View>
            </View>
            <Switch value={location} onValueChange={setLocation} trackColor={{ false: "#ccc", true: "#363033ff" }} />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <Ionicons name="volume-high-outline" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Audio Recording</Text>
                <Text style={styles.settingDesc}>Record audio in danger</Text>
              </View>
            </View>
            <Switch value={recording} onValueChange={setRecording} trackColor={{ false: "#ccc", true: "#363033ff" }} />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <MaterialCommunityIcons name="vibrate" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Vibration Alerts</Text>
                <Text style={styles.settingDesc}>Silent SOS alerts</Text>
              </View>
            </View>
            <Switch value={vibration} onValueChange={setVibration} trackColor={{ false: "#ccc", true: "#363033ff" }} />
          </View>

          <View style={styles.divider} />

          <View style={styles.pinSection}>
            <View style={styles.leftRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#333" />
              <Text style={[styles.settingLabel, { marginLeft: 10 }]}>Emergency PIN</Text>
            </View>
            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={setPin}
                maxLength={4}
                secureTextEntry
                keyboardType="numeric"
                placeholder="••••"
                placeholderTextColor="#bbb"
              />
            </View>
            <Text style={styles.pinHint}>4-digit PIN to cancel false alarms</Text>
          </View>
        </View>

        {/* SIGN OUT */}
        <TouchableOpacity
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>{signingOut ? "Signing out..." : "Sign Out"}</Text>
        </TouchableOpacity>
      </View>

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

const AVATAR_SIZE = 60;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  profileCard: {
    flexDirection: "row",
    backgroundColor: "#f9f9f9",
    margin: 20,
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    elevation: 3,
  },

  // ── Avatar in profile card ──
  profileCircleWrapper: {
    marginRight: 15,
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    overflow: "hidden",
  },
  profileAvatar: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
  },
  profileCircle: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "#ff4081",
    justifyContent: "center",
    alignItems: "center",
  },
  profileInitial: { color: "#fff", fontSize: 20, fontWeight: "bold" },

  profileName: { fontSize: 16, fontWeight: "bold", color: "#333" },
  profileEmail: { fontSize: 13, color: "#e9237f" },
  profileSince: { fontSize: 12, color: "#999" },

  editButton: {
    backgroundColor: "#ff4081",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  editText: { color: "#fff", fontSize: 12 },

  supportCard: {
    backgroundColor: "#f9f9f9",
    margin: 20,
    marginTop: 0,
    padding: 18,
    borderRadius: 16,
    elevation: 3,
  },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 15 },
  iconLeft: { marginRight: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: "#333" },
  sectionSubtitle: { fontSize: 12, color: "#e9237f" },

  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginVertical: 8,
  },
  leftRow: { flexDirection: "row", alignItems: "center" },
  textBlock: { marginLeft: 10 },
  settingLabel: { fontSize: 14, color: "#333", fontWeight: "500" },
  settingDesc: { fontSize: 12, color: "#777" },
  divider: { height: 1, backgroundColor: "#eee", marginVertical: 12 },

  pinSection: {},
  pinInputWrapper: {
    backgroundColor: "#f2f2f2",
    borderRadius: 8,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  pinInput: { flex: 1, padding: 10, fontSize: 16, letterSpacing: 4, color: "#333" },
  pinHint: { fontSize: 11, color: "#888", marginTop: 5 },

  signOutButton: {
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 14,
    backgroundColor: "transparent",
    borderColor: "#ffd6c0",
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonDisabled: { opacity: 0.6 },
  signOutText: { fontSize: 16, color: "#ff7a2f", fontWeight: "500" },
});