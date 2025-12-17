import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import Navbar from "../components/SettingTopBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { ThemeAlert } from "../components/ThemeAlert"; // ADDED

type SettingsScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "SettingsScreen"
>;

type Props = {
  navigation: SettingsScreenNavProp;
};

export default function SettingsScreen({ navigation }: Props) {
  // settings switches
  const [voice, setVoice] = useState(false);
  const [location, setLocation] = useState(false);
  const [recording, setRecording] = useState(false);
  const [vibration, setVibration] = useState(false);

  const [pin, setPin] = useState("");

  // NEW: user info loaded from signup
  const [full_name, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [createdAt, setCreatedAt] = useState("");

  const [signingOut, setSigningOut] = useState(false);

  // ADDED: Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

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

// In SettingsScreen.tsx, update the useFocusEffect callback:

useFocusEffect(
  useCallback(() => {
    const loadUser = async () => {
      try {
        // Try multiple keys to find user data
        const possibleUserKeys = ["user", "userProfile", "profile", "currentUser"];
        let userData = null;
        let foundKey = null;
        
        for (const key of possibleUserKeys) {
          const savedData = await AsyncStorage.getItem(key);
          if (savedData) {
            try {
              userData = JSON.parse(savedData);
              foundKey = key;
              console.log(`📱 Found user data in key: "${key}"`, userData);
              break;
            } catch (e) {
              console.log(`⚠️ Could not parse data from key "${key}"`);
            }
          }
        }
        
        if (userData) {
          console.log("🔍 Raw user data from storage:", userData);
          console.log("🔍 Available keys:", Object.keys(userData));
          
          // Extract data with multiple fallbacks
          const fullName = userData.full_name || userData.fullName || userData.name || userData.username || "User";
          const userEmail = userData.email || userData.userEmail || "No email";
          const createdAt = userData.createdAt || userData.created_at || userData.dateCreated || "";
          
          console.log("✅ Extracted - Full Name:", fullName);
          console.log("✅ Extracted - Email:", userEmail);
          
          setFullName(fullName);
          setEmail(userEmail);
          setCreatedAt(createdAt);
          
          // Also save to 'user' key for consistency
          if (foundKey !== "user") {
            await AsyncStorage.setItem("user", JSON.stringify(userData));
          }
        } else {
          console.log("❌ No user data found in AsyncStorage");
          
          // Try to fetch from API if we have a token
          try {
            const token = await AsyncStorage.getItem("token");
            if (token) {
              console.log("🔄 Trying to fetch user from API...");
              const response = await fetch("http://192.168.100.12:5050/api/users/profile", {
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });
              
              if (response.ok) {
                const data = await response.json();
                const apiUser = data.user || data.data || data.profile || data;
                
                if (apiUser) {
                  const fullName = apiUser.full_name || apiUser.fullName || apiUser.name || apiUser.username || "User";
                  const userEmail = apiUser.email || apiUser.userEmail || "No email";
                  
                  setFullName(fullName);
                  setEmail(userEmail);
                  setCreatedAt(apiUser.createdAt || "");
                  
                  // Save to AsyncStorage
                  await AsyncStorage.setItem("user", JSON.stringify(apiUser));
                  console.log("✅ Loaded user from API and saved locally");
                }
              }
            }
          } catch (apiError) {
            console.log("⚠️ Could not fetch from API:", apiError);
          }
        }
      } catch (err) {
        console.error("Error loading user:", err);
      }
    };

    loadUser();
    
    // Add an event listener for when we return from EditProfile
    const unsubscribe = navigation.addListener('focus', () => {
      loadUser();
    });

    return unsubscribe;
  }, [navigation])
);

  // ================================
  // 🔴 Sign Out Function
  // ================================
  const handleSignOut = async () => {
    if (signingOut) return;
    
    // Show confirmation dialog
    showAlert(
      "Sign Out",
      "Are you sure you want to sign out?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Do nothing on cancel
          }
        },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            await performSignOut();
          }
        }
      ],
      "warning"
    );
  };

  const performSignOut = async () => {
    setSigningOut(true);

    try {
      const refreshToken = await AsyncStorage.getItem("refreshToken");
      const url = "http://192.168.100.12:5050/api/users/logout";

      if (refreshToken) {
        try {
          const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refreshToken }),
          });

          if (!res.ok) {
            const txt = await res.text().catch(() => "");
            console.warn("Logout failed:", res.status, txt);
            showAlert(
              "Signed out locally",
              "Server did not respond.",
              [{ text: "OK" }],
              "info"
            );
          } else {
            showAlert(
              "Signed out",
              "You have been logged out.",
              [{ text: "OK" }],
              "success"
            );
          }
        } catch (err) {
          console.warn("Logout network error:", err);
          showAlert(
            "Signed out locally",
            "Could not contact server.",
            [{ text: "OK" }],
            "info"
          );
        }
      }
    } finally {
      await AsyncStorage.clear();
      setSigningOut(false);
      navigation.replace("Login");
    }
  };

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
          <View style={styles.profileCircle}>
            <Text style={styles.profileInitial}>
              {full_name ? full_name.charAt(0).toUpperCase() : "?"}
            </Text>
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
            <Ionicons
              name="shield-checkmark"
              size={22}
              color="#e9237f"
              style={styles.iconLeft}
            />
            <View>
              <Text style={styles.sectionTitle}>Support Settings</Text>
              <Text style={styles.sectionSubtitle}>
                Configure your safety preferences
              </Text>
            </View>
          </View>

          {/* switches remain same */}
          {/* Voice */}
          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <Ionicons name="mic-outline" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Voice Activation</Text>
                <Text style={styles.settingDesc}>Trigger SOS with voice</Text>
              </View>
            </View>
            <Switch
              value={voice}
              onValueChange={setVoice}
              trackColor={{ false: "#ccc", true: "#363033ff" }}
            />
          </View>

          {/* Location */}
          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <Ionicons name="location-outline" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Auto Location Sharing</Text>
                <Text style={styles.settingDesc}>Share location in SOS</Text>
              </View>
            </View>
            <Switch
              value={location}
              onValueChange={setLocation}
              trackColor={{ false: "#ccc", true: "#363033ff" }}
            />
          </View>

          {/* Audio */}
          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <Ionicons name="volume-high-outline" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Audio Recording</Text>
                <Text style={styles.settingDesc}>Record audio in danger</Text>
              </View>
            </View>
            <Switch
              value={recording}
              onValueChange={setRecording}
              trackColor={{ false: "#ccc", true: "#363033ff" }}
            />
          </View>

          {/* Vibration */}
          <View style={styles.settingRow}>
            <View style={styles.leftRow}>
              <MaterialCommunityIcons name="vibrate" size={20} color="#333" />
              <View style={styles.textBlock}>
                <Text style={styles.settingLabel}>Vibration Alerts</Text>
                <Text style={styles.settingDesc}>Silent SOS alerts</Text>
              </View>
            </View>
            <Switch
              value={vibration}
              onValueChange={setVibration}
              trackColor={{ false: "#ccc", true: "#363033ff" }}
            />
          </View>

          <View style={styles.divider} />

          {/* PIN */}
          <View style={styles.pinSection}>
            <View style={styles.leftRow}>
              <Ionicons name="lock-closed-outline" size={20} color="#333" />
              <Text style={[styles.settingLabel, { marginLeft: 10 }]}>
                Emergency PIN
              </Text>
            </View>

            <View style={styles.pinInputWrapper}>
              <TextInput
                style={styles.pinInput}
                value={pin}
                onChangeText={setPin}
                maxLength={4}
                secureTextEntry={true}
                keyboardType="numeric"
                placeholder="••••"
                placeholderTextColor="#bbb"
              />
            </View>

            <Text style={styles.pinHint}>4-digit PIN to cancel false alarms</Text>
          </View>
        </View>

        {/* SIGN OUT BUTTON */}
        <TouchableOpacity
          style={[styles.signOutButton, signingOut && styles.signOutButtonDisabled]}
          onPress={handleSignOut}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          <Text style={styles.signOutText}>
            {signingOut ? "Signing out..." : "Sign Out"}
          </Text>
        </TouchableOpacity>
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
  profileCircle: {
    backgroundColor: "#ff4081",
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
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
  pinInput: {
    flex: 1,
    padding: 10,
    fontSize: 16,
    letterSpacing: 4,
    color: "#333",
  },
  pinHint: { fontSize: 11, color: "#888", marginTop: 5 },

  signOutButton: {
    marginHorizontal: 20,
    marginBottom: 30,
    paddingVertical: 14,
backgroundColor: "transparent", borderColor: "#ffd6c0", borderWidth: 1, borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutText: {
    fontSize: 16, color: "#ff7a2f",
    fontWeight: "500",
  },
});