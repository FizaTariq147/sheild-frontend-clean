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
import { LinearGradient } from 'expo-linear-gradient';
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

type EditProfileNavProp = NativeStackNavigationProp<
  RootStackParamList,
  "EditProfile"
>;

type Props = {
  navigation: EditProfileNavProp;
};

const API_BASE_URL = "http://192.168.100.12:5050/api";

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
  const [profile, setProfile] = useState<UserProfile>({
    full_name: "",
    email: "",
  });
  const [originalProfile, setOriginalProfile] = useState<UserProfile>({
    full_name: "",
    email: "",
  });
  const [loading, setLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [focusedField, setFocusedField] = useState<string | null>(null);

  useEffect(() => {
    checkAndLoadToken();
  }, []);

  const checkAndLoadToken = async () => {
    try {
      console.log("🔍 Checking for authentication token...");
      
      const possibleTokenKeys = [
        "token",
        "access_token",
        "accessToken",
        "auth_token",
        "authToken",
        "userToken",
        "jwt_token",
        "jwtToken"
      ];
      
      let foundToken = null;
      let foundKey = null;
      
      for (const key of possibleTokenKeys) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          foundToken = value;
          foundKey = key;
          console.log(`✅ Found token in key: "${key}"`);
          break;
        }
      }
      
      if (foundToken) {
        setToken(foundToken);
        console.log(`📋 Token found (from key "${foundKey}"): ${foundToken.substring(0, 20)}...`);
        loadProfile(foundToken);
      } else {
        console.log("❌ No token found in any key");
        Alert.alert(
          "Authentication Required",
          "Please login again to access your profile.",
          [
            {
              text: "Login",
              onPress: () => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Login" }],
                });
              }
            }
          ]
        );
      }
    } catch (error) {
      console.error("❌ Error checking token:", error);
    }
  };

  const loadProfile = async (authToken: string) => {
    try {
      console.log("🔄 Loading profile...");
      
      const endpoints = [
        `${API_BASE_URL}/users/profile`,
        `${API_BASE_URL}/user/profile`,
        `${API_BASE_URL}/auth/profile`,
        `${API_BASE_URL}/profile`,
      ];

      let userData = null;
      let successfulEndpoint = null;
      
      for (const endpoint of endpoints) {
        try {
          console.log(`🔍 Trying endpoint: ${endpoint}`);
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });

          console.log(`📡 Response status: ${response.status}`);
          
          if (response.ok) {
            const data = await response.json();
            console.log("✅ Profile loaded from API:", data);
            
            userData = data.user || data.data || data.profile || data;
            successfulEndpoint = endpoint;
            break;
          } else {
            const errorText = await response.text();
            console.log(`⚠️ Endpoint ${endpoint} failed: ${response.status}`, errorText);
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} error:`, error.message);
        }
      }

      if (userData) {
        console.log(`🎯 Successfully loaded from: ${successfulEndpoint}`);
        const formattedProfile = formatProfileData(userData);
        setProfile(formattedProfile);
        setOriginalProfile(formattedProfile);
        
        await saveToLocalStorage(formattedProfile);
      } else {
        console.log("⚠️ No API endpoint worked, loading from local storage");
        loadFromLocalStorage();
      }

    } catch (error) {
      console.error("❌ Error loading profile:", error);
      loadFromLocalStorage();
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadFromLocalStorage = async () => {
    try {
      const stored = await AsyncStorage.getItem("user");
      if (stored) {
        const userData = JSON.parse(stored);
        const formattedProfile = formatProfileData(userData);
        setProfile(formattedProfile);
        setOriginalProfile(formattedProfile);
        console.log("📦 Loaded from local storage:", formattedProfile);
      } else {
        console.log("⚠️ No user data found in local storage");
      }
    } catch (error) {
      console.error("❌ Error loading from local storage:", error);
    }
  };

  const formatProfileData = (data: any): UserProfile => {
    console.log("🔧 Formatting data - Input:", data);
    console.log("🔧 Available keys:", Object.keys(data));
    
    const full_name = data.full_name || data.fullName || data.name || data.username || "";
    console.log(`🔧 Extracted full_name: "${full_name}"`);
    
    return {
      _id: data._id || data.id,
      full_name: full_name,
      name: data.name || full_name,
      email: data.email || "",
      phone: data.phone || data.phoneNumber || "",
      avatar: data.avatar || data.profilePicture || data.image || "",
      address: data.address || "",
      createdAt: data.createdAt || data.created_at || "",
    };
  };

  const saveToLocalStorage = async (profileData: UserProfile) => {
    try {
      await AsyncStorage.setItem("user", JSON.stringify(profileData));
      console.log("💾 Saved to local storage");
    } catch (error) {
      console.error("❌ Error saving to local storage:", error);
    }
  };

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    const updatedProfile = { ...profile, [field]: value };
    setProfile(updatedProfile);
    
    const isChanged = value !== (originalProfile[field] || "");
    setHasChanges(isChanged || Object.keys(profile).some(key => 
      key !== field && profile[key as keyof UserProfile] !== originalProfile[key as keyof UserProfile]
    ));
  };

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

  if (!hasChanges) {
    Alert.alert("No Changes", "You haven't made any changes to save.");
    return;
  }

  if (!token) {
    Alert.alert(
      "Authentication Required",
      "Please login again to save changes.",
      [
        {
          text: "Login",
          onPress: () => {
            navigation.reset({
              index: 0,
              routes: [{ name: "Login" }],
            });
          }
        }
      ]
    );
    return;
  }

  setLoading(true);

  try {
    const updateData: any = {
      full_name: profile.full_name.trim(),
      fullName: profile.full_name.trim(),
      name: profile.full_name.trim(),
      email: profile.email.trim(),
    };

    if (profile.phone && profile.phone.trim()) {
      updateData.phone = profile.phone.trim();
      updateData.phoneNumber = profile.phone.trim();
    }
    
    if (profile.address && profile.address.trim()) {
      updateData.address = profile.address.trim();
    }

    console.log("📤 Sending update to API:", JSON.stringify(updateData, null, 2));
    console.log("🔑 Token exists:", !!token);

    const endpoints = [
      { url: `${API_BASE_URL}/users/profile`, method: "PUT" },
      { url: `${API_BASE_URL}/users/profile`, method: "PATCH" },
      { url: `${API_BASE_URL}/user/profile`, method: "PUT" },
      { url: `${API_BASE_URL}/user/profile`, method: "PATCH" },
      { url: `${API_BASE_URL}/auth/profile`, method: "PUT" },
      { url: `${API_BASE_URL}/auth/profile`, method: "PATCH" },
      { url: `${API_BASE_URL}/profile`, method: "PUT" },
      { url: `${API_BASE_URL}/profile`, method: "PATCH" },
    ];

    if (profile._id || profile.id) {
      const userId = profile._id || profile.id;
      endpoints.push(
        { url: `${API_BASE_URL}/users/${userId}`, method: "PUT" },
        { url: `${API_BASE_URL}/users/${userId}`, method: "PATCH" },
        { url: `${API_BASE_URL}/user/${userId}`, method: "PUT" },
        { url: `${API_BASE_URL}/user/${userId}`, method: "PATCH" }
      );
    }

    let success = false;
    let successfulEndpoint = null;
    let responseStatus = null;
    let responseData = null;

    for (const endpoint of endpoints) {
      try {
        console.log(`🔄 Trying: ${endpoint.method} ${endpoint.url}`);
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(updateData),
        });

        responseStatus = response.status;
        console.log(`📡 Response status: ${responseStatus}`);
        
        if (response.ok) {
          const data = await response.json();
          console.log("✅ Profile update API response:", data);
          
          success = true;
          successfulEndpoint = endpoint.url;
          responseData = data;
          
          const updatedUser = data.user || data.data || data.profile || data;
          if (updatedUser && updatedUser.full_name !== undefined) {
            console.log("✅ Backend accepted full_name field");
          } else if (updatedUser && updatedUser.fullName !== undefined) {
            console.log("✅ Backend accepted fullName field");
          } else if (updatedUser && updatedUser.name !== undefined) {
            console.log("✅ Backend accepted name field");
          }
          break;
        } else {
          const errorText = await response.text();
          console.log(`⚠️ Endpoint failed:`, responseStatus, errorText);
          
          if (response.status === 401) {
            Alert.alert(
              "Session Expired",
              "Your session has expired. Please login again.",
              [
                {
                  text: "Login",
                  onPress: () => {
                    navigation.reset({
                      index: 0,
                      routes: [{ name: "Login" }],
                    });
                  }
                }
              ]
            );
            setLoading(false);
            return;
          }
        }
      } catch (error) {
        console.log(`❌ Endpoint error:`, error.message);
      }
    }

    if (success) {
      console.log(`🎯 Successfully updated via: ${successfulEndpoint}`);
      
      const refreshedProfile = await fetchUpdatedProfile(token);
      
      if (refreshedProfile) {
        console.log("✅ Refreshed profile from server:", refreshedProfile);
        
        setProfile(refreshedProfile);
        setOriginalProfile(refreshedProfile);
        setHasChanges(false);
        
        await saveToLocalStorage(refreshedProfile);
        
        await AsyncStorage.setItem("user", JSON.stringify(refreshedProfile));
        console.log("💾 Updated AsyncStorage user data");
        
        Alert.alert(
          "Success",
          "Your profile has been updated successfully!",
          [
            { 
              text: "OK", 
              onPress: () => {
                navigation.navigate("SettingsScreen");
              }
            }
          ]
        );
      } else {
        const updatedProfile = formatProfileData(responseData?.user || responseData?.data || responseData || updateData);
        setProfile(updatedProfile);
        setOriginalProfile(updatedProfile);
        setHasChanges(false);
        await saveToLocalStorage(updatedProfile);
        await AsyncStorage.setItem("user", JSON.stringify(updatedProfile));
        
        Alert.alert(
          "Success",
          "Profile updated (using response data)",
          [{ text: "OK", onPress: () => navigation.goBack() }]
        );
      }
    } else {
      throw new Error(`Failed to update profile. Last status: ${responseStatus}`);
    }

  } catch (error: any) {
    console.error("❌ Update error:", error);
    
    Alert.alert(
      "Update Failed",
      error.message || "Failed to update profile. Please check your connection and try again.",
      [
        {
          text: "Try Again",
          onPress: () => updateProfile(),
        },
        {
          text: "Save Locally",
          onPress: async () => {
            await saveToLocalStorage(profile);
            await AsyncStorage.setItem("user", JSON.stringify(profile));
            Alert.alert(
              "Saved Locally",
              "Changes saved locally. They will sync when you're back online.",
              [{ text: "OK", onPress: () => navigation.goBack() }]
            );
          }
        }
      ]
    );
  } finally {
    setLoading(false);
  }
};

  const fetchUpdatedProfile = async (authToken: string): Promise<UserProfile | null> => {
    try {
      console.log("🔄 Fetching updated profile from server...");
      
      const endpoints = [
        `${API_BASE_URL}/users/profile`,
        `${API_BASE_URL}/user/profile`,
        `${API_BASE_URL}/auth/profile`,
        `${API_BASE_URL}/profile`,
      ];
      
      for (const endpoint of endpoints) {
        try {
          const response = await fetch(endpoint, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (response.ok) {
            const data = await response.json();
            console.log("✅ Fetched updated profile from:", endpoint);
            
            const userData = data.user || data.data || data.profile || data;
            return formatProfileData(userData);
          }
        } catch (error) {
          console.log(`❌ Endpoint ${endpoint} error:`, error.message);
        }
      }
      
      return null;
    } catch (error) {
      console.error("❌ Error fetching updated profile:", error);
      return null;
    }
  };

  const debugAsyncStorage = async () => {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      console.log("🔍 All AsyncStorage keys:", allKeys);
      
      let debugMessage = "=== ASYNC STORAGE DEBUG ===\n\n";
      
      for (const key of allKeys) {
        const value = await AsyncStorage.getItem(key);
        try {
          const parsed = JSON.parse(value || '');
          debugMessage += `🔑 ${key}: ${JSON.stringify(parsed, null, 2).substring(0, 100)}...\n\n`;
        } catch {
          debugMessage += `🔑 ${key}: ${value?.substring(0, 50)}...\n\n`;
        }
      }
      
      debugMessage += `\n=== CURRENT STATE ===\n`;
      debugMessage += `Token: ${token ? "Exists (" + token.substring(0, 20) + "...)" : "Missing"}\n`;
      debugMessage += `Profile: ${JSON.stringify(profile, null, 2)}\n`;
      debugMessage += `Has Changes: ${hasChanges}`;
      
      Alert.alert("Debug Info", debugMessage);
    } catch (error) {
      console.error("Debug error:", error);
    }
  };

  const handleBackPress = () => {
    if (hasChanges && !loading) {
      Alert.alert(
        "Unsaved Changes",
        "You have unsaved changes. Are you sure you want to leave?",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Leave", 
            style: "destructive", 
            onPress: () => navigation.goBack() 
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

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
        <TouchableOpacity 
          onPress={handleBackPress} 
          style={styles.backButton}
          disabled={loading}
        >
          <Ionicons name="arrow-back" size={24} color={loading ? "#ccc" : "#333"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={debugAsyncStorage} style={styles.debugButton}>
          <Ionicons name="bug-outline" size={20} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Authentication Status */}
      {!token && (
        <View style={styles.authWarning}>
          <Ionicons name="warning" size={20} color="#ff9800" />
          <Text style={styles.authWarningText}>
            Not authenticated. Changes will be saved locally only.
          </Text>
        </View>
      )}

      {/* Profile Image */}
      <View style={styles.avatarContainer}>
        <View style={styles.avatarWrapper}>
          {profile.avatar ? (
            <Image source={{ uri: profile.avatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {profile.full_name?.charAt(0)?.toUpperCase() || "U"}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity style={styles.changePhotoButton} disabled={loading}>
          <Ionicons name="camera" size={18} color="#ff4081" />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>
      </View>

      {/* Form */}
      <View style={styles.form}>
        {/* Full Name */}
        <View style={styles.inputContainer}>
          <Text style={[
            styles.inputLabel,
            focusedField === 'full_name' && styles.inputLabelFocused
          ]}>
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
                onChangeText={(text) => handleInputChange('full_name', text)}
                placeholder="Enter your full name"
                placeholderTextColor="#999"
                editable={!loading}
                onFocus={() => setFocusedField('full_name')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Email */}
        <View style={styles.inputContainer}>
          <Text style={[
            styles.inputLabel,
            focusedField === 'email' && styles.inputLabelFocused
          ]}>
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
                onChangeText={(text) => handleInputChange('email', text)}
                placeholder="Enter your email"
                placeholderTextColor="#999"
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Phone */}
        <View style={styles.inputContainer}>
          <Text style={[
            styles.inputLabel,
            focusedField === 'phone' && styles.inputLabelFocused
          ]}>
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
                onChangeText={(text) => handleInputChange('phone', text)}
                placeholder="Enter your phone number"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
                editable={!loading}
                onFocus={() => setFocusedField('phone')}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          </LinearGradient>
        </View>

        {/* Change Indicator */}
        {hasChanges && (
          <View style={styles.changeIndicator}>
            <Ionicons name="alert-circle" size={16} color="#ff9800" />
            <Text style={styles.changeIndicatorText}>
              {token ? "You have unsaved changes" : "Changes will be saved locally only"}
            </Text>
          </View>
        )}
      </View>

      {/* Save Button */}
      <TouchableOpacity
        style={[
          styles.saveButton,
          loading && styles.saveButtonDisabled,
          !hasChanges && styles.saveButtonInactive,
          !token && styles.saveButtonLocal,
        ]}
        onPress={updateProfile}
        disabled={loading || !hasChanges}
        activeOpacity={0.8}
      >
        {loading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.saveButtonText}>
            {token 
              ? (hasChanges ? "Save Changes" : "No Changes") 
              : (hasChanges ? "Save Locally" : "No Changes")
            }
          </Text>
        )}
      </TouchableOpacity>

      {/* Info Message */}
      <View style={styles.infoBox}>
        <Ionicons name="information-circle" size={18} color="#2196F3" />
        <Text style={styles.infoText}>
          {token 
            ? "Your changes will be saved permanently to the database" 
            : "You are not authenticated. Changes will be saved locally only."
          }
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: "#fff",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
  },
  debugButton: {
    padding: 8,
  },
  authWarning: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff3e0",
    marginHorizontal: 20,
    marginTop: 10,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#ffcc80",
  },
  authWarningText: {
    flex: 1,
    fontSize: 14,
    color: "#ef6c00",
    marginLeft: 10,
  },
  avatarContainer: {
    alignItems: "center",
    paddingVertical: 10,
    marginBottom: 20,
  },
  avatarWrapper: {
    marginBottom: 10,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 60,
    borderWidth: 3,
  },
  avatarPlaceholder: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#e0e0e0",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#333",
  },
  changePhotoButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  changePhotoText: {
    fontSize: 16,
    color: "#333",
    fontWeight: "500",
    marginLeft: 8,
  },
  form: {
    paddingHorizontal: 20,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
    marginBottom: 8,
    marginLeft: 4,
  },
  inputLabelFocused: {
    color: "#ff4081",
  },
  inputGradient: {
    borderRadius: 12,
    padding: 2,
  },
  inputWrapper: {
    backgroundColor: "#f8f8f8",
    borderRadius: 10,
  },
  input: {
    backgroundColor: "transparent",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#333",
  },
  inputDisabled: {
    backgroundColor: "transparent",
    color: "#999",
  },
  changeIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
    backgroundColor: "#fff8e1",
    borderRadius: 8,
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#ffecb3",
  },
  changeIndicatorText: {
    fontSize: 14,
    color: "#ff9800",
    fontWeight: "500",
    marginLeft: 8,
  },
  saveButton: {
    backgroundColor: "#ff4081",
    marginHorizontal: 20,
    marginTop: 10,
    paddingVertical: 16,
    borderRadius: 25,
    alignItems: "center",
    justifyContent: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  saveButtonLocal: {
    backgroundColor: "#4CAF50",
  },
  saveButtonDisabled: {
    backgroundColor: "#ff80ab",
    opacity: 0.7,
  },
  saveButtonInactive: {
    backgroundColor: "#cccccc",
  },
  saveButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e3f2fd",
    marginHorizontal: 20,
    marginTop: 20,
    marginBottom: 30,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#bbdefb",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#1976d2",
    marginLeft: 10,
  },
});