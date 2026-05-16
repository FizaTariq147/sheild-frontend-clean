import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

type EditProfileNavProp = NativeStackNavigationProp<
  RootStackParamList,
  "EditProfile"
>;

type Props = {
  navigation: EditProfileNavProp;
};

const API_BASE_URL = "https://fiza-tariq-shield-backend.hf.space/api";

interface UserProfile {
  _id?: string;
  id?: string;
  full_name: string;
  name?: string;
  email: string;
  phone?: string;
  avatar?: string;
  address?: string;
  createdAt?: string;
}

export default function EditProfile({ navigation }: Props) {
  const [profile, setProfile] = useState<UserProfile>({ full_name: "", email: "" });
  const [originalProfile, setOriginalProfile] = useState<UserProfile>({ full_name: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  // ── NEW: local image uri picked from phone (not yet uploaded) ──
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    checkAndLoadToken();
  }, []);

  const checkAndLoadToken = async () => {
    try {
      const possibleTokenKeys = [
        "token", "access_token", "accessToken",
        "auth_token", "authToken", "userToken", "jwt_token", "jwtToken",
      ];
      let foundToken = null;
      let foundKey = null;
      for (const key of possibleTokenKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) { foundToken = value; foundKey = key; break; }
      }
      if (foundToken) {
        setToken(foundToken);
        console.log(`✅ Found token in key: "${foundKey}"`);
        loadProfile(foundToken);
      } else {
        Alert.alert("Authentication Required", "Please login again.", [
          { text: "Login", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Login" }] }) },
        ]);
      }
    } catch (error) {
      console.error("❌ Error checking token:", error);
    }
  };

  const loadProfile = async (authToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
      });
      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data.data || data.profile || data;
        const formatted = formatProfileData(userData);
        setProfile(formatted);
        setOriginalProfile(formatted);
        await AsyncStorage.setItem("user", JSON.stringify(formatted));
      } else {
        loadFromLocalStorage();
      }
    } catch {
      loadFromLocalStorage();
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadFromLocalStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem("user");
      if (stored) {
        const formatted = formatProfileData(JSON.parse(stored));
        setProfile(formatted);
        setOriginalProfile(formatted);
      }
    } catch (error) {
      console.error("❌ Error loading from local storage:", error);
    }
  };

  const formatProfileData = (data: any): UserProfile => {
    const full_name = data.full_name || data.fullName || data.name || data.username || "";
    // Always store full URL so AsyncStorage and <Image> both work
    let avatar = data.avatar || data.profilePicture || data.image || "";
    if (avatar && avatar.startsWith("/uploads")) {
      avatar = `https://fiza-tariq-shield-backend.hf.space${avatar}`;
    }
    return {
      _id: data._id || data.id,
      full_name,
      name: data.name || full_name,
      email: data.email || "",
      phone: data.phone || data.phoneNumber || "",
      avatar,
      address: data.address || "",
      createdAt: data.createdAt || data.created_at || "",
    };
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    const updated = { ...profile, [field]: value };
    setProfile(updated);
    const changed =
      value !== (originalProfile[field] || "") ||
      Object.keys(profile).some(
        (k) => k !== field && profile[k as keyof UserProfile] !== originalProfile[k as keyof UserProfile]
      );
    setHasChanges(changed);
  };

  // ── IMAGE PICKER ──────────────────────────────────────────────
  const handlePickImage = async () => {
    try {
      // Check existing permission first (avoids double-prompt on Android)
      const { status: existingStatus } =
        await ImagePicker.getMediaLibraryPermissionsAsync();

      let finalStatus = existingStatus;
      if (existingStatus !== "granted") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") {
        Alert.alert(
          "Permission Required",
          "Please allow photo library access in your device Settings.",
          [{ text: "OK" }]
        );
        return;
      }

      let result: ImagePicker.ImagePickerResult | null = null;
      try {
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"] as any,
          allowsEditing: true,
          aspect: [1, 1],
          quality: 0.5,
          base64: false,
        });
      } catch (pickerErr: any) {
        // Retry without allowsEditing — fixes Android Photo Picker crop crash
        console.warn("⚠️ Retrying without edit:", pickerErr?.message);
        result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"] as any,
          allowsEditing: false,
          quality: 0.5,
          base64: false,
        });
      }

      console.log("🖼 Picker result:", result?.canceled ? "canceled" : result?.assets?.[0]?.uri);

      if (result && !result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri;
        setLocalImageUri(uri);
        setHasChanges(true);
      }
    } catch (err) {
      console.error("❌ Image picker error:", err);
      Alert.alert("Error", "Could not open photo library. Please try again.");
    }
  };

  // Upload avatar as base64 JSON — avoids Android "Network request failed"
  // that happens when sending file:// URIs via FormData in Expo
  const uploadImage = async (authToken: string): Promise<string | null> => {
    if (!localImageUri) return null;
    setUploadingImage(true);
    try {
      // Read the file as base64
      // Resize to JPEG before reading — drastically reduces base64 size
      const resized = await ImageManipulator.manipulateAsync(
        localImageUri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
      );

      const base64 = await FileSystem.readAsStringAsync(resized.uri, {
        encoding: "base64",
      });

      const mimeType = "image/jpeg";
      console.log("📸 Uploading avatar as base64:", { mimeType, size: base64.length });

      const response = await fetch(`${API_BASE_URL}/users/avatar`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          avatar: base64,
          mimeType,
        }),
      });

      const rawText = await response.text();
      console.log("📡 Upload response status:", response.status);
      console.log("📡 Upload response body:", rawText);

      if (response.ok) {
        let data: any = {};
        try { data = JSON.parse(rawText); } catch { /* not JSON */ }

        const relativePath = data.user?.avatar || data.avatar || null;
        if (relativePath) {
          const fullUrl = relativePath.startsWith("http")
            ? relativePath
            : `https://fiza-tariq-shield-backend.hf.space${relativePath}`;
          console.log("✅ Avatar URL:", fullUrl);
          return fullUrl;
        }

        console.warn("⚠️ Upload succeeded but no avatar path in response:", data);
        return null;
      } else {
        console.warn("⚠️ Avatar upload failed:", response.status, rawText);
        return null;
      }
    } catch (err) {
      console.error("❌ Avatar upload error:", err);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  // ── SAVE ─────────────────────────────────────────────────────
  const validateForm = (): boolean => {
    if (!profile.full_name?.trim()) {
      Alert.alert("Validation Error", "Please enter your full name");
      return false;
    }
    if (!profile.email?.trim()) {
      Alert.alert("Validation Error", "Please enter your email address");
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(profile.email)) {
      Alert.alert("Validation Error", "Please enter a valid email address");
      return false;
    }
    return true;
  };

  const updateProfile = async () => {
    if (!validateForm()) return;
    if (!hasChanges) { Alert.alert("No Changes", "You haven't made any changes to save."); return; }
    if (!token) {
      Alert.alert("Authentication Required", "Please login again.", [
        { text: "Login", onPress: () => navigation.reset({ index: 0, routes: [{ name: "Login" }] }) },
      ]);
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ Upload avatar first (if a new image was picked)
      let newAvatarUrl: string | null = null;
      if (localImageUri) {
        newAvatarUrl = await uploadImage(token);
      }

      // 2️⃣ Update text fields
      const updateData: any = {
        full_name: profile.full_name.trim(),
        fullName: profile.full_name.trim(),
        name: profile.full_name.trim(),
        email: profile.email.trim(),
      };
      if (profile.phone?.trim()) {
        updateData.phone = profile.phone.trim();
        updateData.phoneNumber = profile.phone.trim();
      }

      console.log("📤 Sending text update:", updateData);

      const response = await fetch(`${API_BASE_URL}/users/profile`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Update failed (${response.status}): ${err}`);
      }

      // 3️⃣ Build updated local profile — use what WE sent (don't re-fetch stale data)
      const updatedProfile: UserProfile = {
        ...profile,
        full_name: profile.full_name.trim(),
        name: profile.full_name.trim(),
        email: profile.email.trim(),
        phone: profile.phone?.trim() || "",
        // Priority: server URL > local URI (shows even if upload failed) > existing
        avatar: newAvatarUrl || localImageUri || profile.avatar || "",
      };

      setProfile(updatedProfile);
      setOriginalProfile(updatedProfile);
      setHasChanges(false);
      setLocalImageUri(null);

      await AsyncStorage.setItem("user", JSON.stringify(updatedProfile));
      console.log("💾 Saved updated profile to AsyncStorage");

      Alert.alert("Success", "Your profile has been updated!", [
        { text: "OK", onPress: () => navigation.navigate("SettingsScreen") },
      ]);
    } catch (error: any) {
      console.error("❌ Update error:", error);
      Alert.alert("Update Failed", error.message || "Please try again.", [
        { text: "OK" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleBackPress = () => {
    if (hasChanges && !loading) {
      Alert.alert("Unsaved Changes", "Leave without saving?", [
        { text: "Cancel", style: "cancel" },
        { text: "Leave", style: "destructive", onPress: () => navigation.goBack() },
      ]);
    } else {
      navigation.goBack();
    }
  };

  // Which image to show: local pick > server avatar > nothing
  const displayImageUri = localImageUri || (profile.avatar ? profile.avatar : null);

  if (isLoadingProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#ff4081" />
        <Text style={styles.loadingText}>Loading your profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBackPress} style={styles.backButton} disabled={loading}>
          <Ionicons name="arrow-back" size={24} color={loading ? "#ccc" : "#333"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Avatar */}
      <View style={styles.avatarContainer}>
        <TouchableOpacity onPress={handlePickImage} disabled={loading || uploadingImage} activeOpacity={0.8}>
          <View style={styles.avatarWrapper}>
            {displayImageUri ? (
              <Image source={{ uri: displayImageUri }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
                </Text>
              </View>
            )}

            {/* Camera badge overlay */}
            <View style={styles.cameraBadge}>
              {uploadingImage ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="camera" size={16} color="#fff" />
              )}
            </View>
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={handlePickImage} disabled={loading || uploadingImage} style={styles.changePhotoButton}>
          <Text style={styles.changePhotoText}>
            {localImageUri ? "Photo selected — save to upload" : "Change Photo"}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Full Name */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, focusedField === "full_name" && styles.inputLabelFocused]}>
            Full Name *
          </Text>
          <LinearGradient
            colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inputGradient}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, loading && styles.inputDisabled]}
                value={profile.full_name}
                onChangeText={(t) => handleInputChange("full_name", t)}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                editable={!loading}
                onFocus={() => setFocusedField("full_name")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Email */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, focusedField === "email" && styles.inputLabelFocused]}>
            Email *
          </Text>
          <LinearGradient
            colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inputGradient}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, loading && styles.inputDisabled]}
                value={profile.email}
                onChangeText={(t) => handleInputChange("email", t)}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Phone */}
        <View style={styles.inputContainer}>
          <Text style={[styles.inputLabel, focusedField === "phone" && styles.inputLabelFocused]}>
            Phone
          </Text>
          <LinearGradient
            colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.inputGradient}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, loading && styles.inputDisabled]}
                value={profile.phone || ""}
                onChangeText={(t) => handleInputChange("phone", t)}
                placeholder="Enter your phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                editable={!loading}
                onFocus={() => setFocusedField("phone")}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </LinearGradient>
        </View>

        {hasChanges && (
          <View style={styles.changeIndicator}>
            <Ionicons name="alert-circle" size={16} color="#ff9800" />
            <Text style={styles.changeIndicatorText}>You have unsaved changes</Text>
          </View>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          (loading || uploadingImage) && styles.saveButtonDisabled,
          !hasChanges && styles.saveButtonInactive,
        ]}
        onPress={updateProfile}
        disabled={loading || uploadingImage || !hasChanges}
        activeOpacity={0.8}
      >
        {loading || uploadingImage ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>
            {hasChanges ? "Save Changes" : "No Changes"}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color="#2196F3" />
        <Text style={styles.infoText}>
          Your changes will be saved permanently to the database.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#fff" },
  loadingText: { marginTop: 12, fontSize: 16, color: "#666" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: "600", color: "#333" },

  // ── Avatar ──
  avatarContainer: { alignItems: "center", paddingVertical: 10, marginBottom: 20 },
  avatarWrapper: { position: "relative", marginBottom: 10 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: "#ff4081" },
  avatarPlaceholder: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: "#e0e0e0", justifyContent: "center", alignItems: "center",
  },
  avatarText: { fontSize: 48, fontWeight: "bold", color: "#333" },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#ff4081",
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  changePhotoButton: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  changePhotoText: { fontSize: 14, color: "#ff4081", fontWeight: "500" },

  // ── Form ──
  form: { paddingHorizontal: 20 },
  inputContainer: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: "500", color: "#666", marginBottom: 8, marginLeft: 4 },
  inputLabelFocused: { color: "#ff4081" },
  inputGradient: { borderRadius: 12, padding: 2 },
  inputWrapper: { backgroundColor: "#f8f8f8", borderRadius: 10 },
  input: { backgroundColor: "transparent", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: "#333" },
  inputDisabled: { color: "#999" },

  changeIndicator: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 12, backgroundColor: "#fff8e1", borderRadius: 8, marginTop: 10,
    borderWidth: 1, borderColor: "#ffecb3",
  },
  changeIndicatorText: { fontSize: 14, color: "#ff9800", fontWeight: "500", marginLeft: 8 },

  saveButton: {
    backgroundColor: "#ff4081", marginHorizontal: 20, marginTop: 10,
    paddingVertical: 16, borderRadius: 25, alignItems: "center", justifyContent: "center",
    elevation: 3, shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  saveButtonDisabled: { backgroundColor: "#ff80ab", opacity: 0.7 },
  saveButtonInactive: { backgroundColor: "#cccccc" },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  infoBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#e3f2fd",
    marginHorizontal: 20, marginTop: 20, marginBottom: 30, padding: 15,
    borderRadius: 8, borderWidth: 1, borderColor: "#bbdefb",
  },
  infoText: { flex: 1, fontSize: 14, color: "#1976d2", marginLeft: 10 },
});