// SignupScreen.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AuthNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { ThemeAlert } from "../components/ThemeAlert";

export default function SignupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "Signup">>();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNo, setPhoneNo] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const logoScale = useRef(new Animated.Value(0)).current;
  const logoRotate = useRef(new Animated.Value(0)).current;

  // Show alert function
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

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    // Continuous logo rotation
    Animated.loop(
      Animated.timing(logoRotate, {
        toValue: 1,
        duration: 10000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleSignup = async () => {
    if (!name || !email || !phoneNo || !password || !confirmPassword) {
      showAlert("Error", "Please fill in all fields", [{ text: "OK" }], "error");
      return;
    }
    if (password !== confirmPassword) {
      showAlert("Error", "Passwords do not match", [{ text: "OK" }], "error");
      return;
    }

    setLoading(true);
    try {
      console.log("🔍 Signup attempt for:", email);
      
      const res = await fetch("http://192.168.100.12:5050/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: name,
          email,
          phone: phoneNo,
          password,
        }),
      });

      const text = await res.text();
      console.log("🔍 Signup response status:", res.status);
      console.log("🔍 Signup response:", text);
      
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("Signup response is not JSON:", text);
        showAlert("Error", "Server returned unexpected response", [{ text: "OK" }], "error");
        setLoading(false);
        return;
      }

      if (res.ok || res.status === 201) {
        const pendingId = data.pendingId || data.pending_id || null;

        // ✅ DO NOT STORE PASSWORD - Just navigate to OTP screen
        console.log("✅ Registration successful, navigating to OTP");
        
        showAlert(
          "Success",
          "OTP sent to your email. Please verify to continue.",
          [
            {
              text: "Continue",
              onPress: () => {
                navigation.navigate("OtpVerificationScreen", {
                  pendingId,
                  email,
                  phone: phoneNo,
                });
              }
            }
          ],
          "success"
        );
      } else {
        const err = data?.error || data?.message || "Registration failed";
        console.log("❌ Signup error:", err);
        showAlert("Error", String(err), [{ text: "OK" }], "error");
      }
    } catch (error: any) {
      console.error("Signup error:", error);
      showAlert("Error", error.message || "Something went wrong", [{ text: "OK" }], "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.container}>
            {/* Decorative circles */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />

            <Animated.View
              style={[
                styles.content,
                {
                  opacity: fadeAnim,
                },
              ]}
            >
              {/* Logo Section */}
              <Animated.View
                style={[
                  styles.logoContainer,
                  {
                    transform: [{ scale: logoScale }, { rotate: spin }],
                  },
                ]}
              >
                <View style={styles.logoCircle}>
                  <Image
                    source={require("../assets/logo.png")}
                    style={styles.logo}
                    resizeMode="contain"
                  />
                </View>
              </Animated.View>

              {/* Title */}
              <Text style={styles.title}>Sign Up</Text>
              <Text style={styles.subtitle}>
                Create your SHEILD account
              </Text>

              {/* Form Card */}
              <Animated.View
                style={[
                  styles.formCard,
                  {
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                {/* Full Name Input */}
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="person-outline"
                    size={20}
                    color="#e9237f"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor="#999"
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                  />
                </View>

                {/* Email Input */}
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#e9237f"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Email"
                    placeholderTextColor="#999"
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                {/* Phone Input */}
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="call-outline"
                    size={20}
                    color="#e9237f"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Phone Number"
                    placeholderTextColor="#999"
                    style={styles.input}
                    value={phoneNo}
                    onChangeText={setPhoneNo}
                    keyboardType="phone-pad"
                  />
                </View>

                {/* Password Input */}
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#e9237f"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Password"
                    placeholderTextColor="#999"
                    secureTextEntry
                    style={styles.input}
                    value={password}
                    onChangeText={setPassword}
                  />
                </View>

                {/* Confirm Password Input */}
                <View style={styles.inputWrapper}>
                  <Ionicons
                    name="lock-closed-outline"
                    size={20}
                    color="#e9237f"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    placeholder="Confirm Password"
                    placeholderTextColor="#999"
                    secureTextEntry
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                {/* Sign Up Button */}
                <TouchableOpacity
                  style={[styles.signUpButton, loading && styles.signUpButtonDisabled]}
                  onPress={handleSignup}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.signUpButtonText}>Sign Up</Text>
                  )}
                </TouchableOpacity>

                {/* Login Link */}
                <View style={styles.loginContainer}>
                  <Text style={styles.loginPrompt}>Already have an account? </Text>
                  <TouchableOpacity onPress={() => navigation.navigate("Login")}>
                    <Text style={styles.loginText}>Log In</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </Animated.View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Theme Alert Component */}
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

// Styles remain exactly the same
const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    minHeight: "100%",
    backgroundColor: "#FFEFF2",
    padding: 20,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  },
  content: {
    alignItems: "center" as const,
    zIndex: 10,
  },
  // Decorative circles
  circle1: {
    position: "absolute" as const,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(233, 35, 127, 0.1)",
    top: -100,
    left: -50,
  },
  circle2: {
    position: "absolute" as const,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(181, 73, 250, 0.1)",
    bottom: -50,
    right: -30,
  },
  circle3: {
    position: "absolute" as const,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(61, 36, 108, 0.05)",
    top: "50%",
    right: -20,
  },
  logoContainer: {
    marginBottom: 2,
    marginTop: 20,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 60,
    backgroundColor: "#e9237f",
    borderWidth: 3,
    borderColor: "#fff",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    shadowColor: "#e9237f",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  logo: {
    width: 70,
    height: 70,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold" as const,
    color: "#3D246C",
    marginBottom: 5,
    textAlign: "center" as const,
  },
  subtitle: {
    fontSize: 15,
    color: "#5D5D5D",
    textAlign: "center" as const,
    marginBottom: 20,
    lineHeight: 20,
  },
  formCard: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 20,
  },
  inputWrapper: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    marginBottom: 16,
    paddingHorizontal: 16,
    height: 40,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },
  signUpButton: {
    borderRadius: 12,
    overflow: "hidden" as const,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: "#e9237f",
    shadowColor: "#e9237f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    paddingVertical: 10,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  signUpButtonDisabled: {
    opacity: 0.6,
  },
  signUpButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold" as const,
    letterSpacing: 0.5,
  },
  loginContainer: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  loginPrompt: {
    color: "#666",
    fontSize: 14,
  },
  loginText: {
    color: "#3D246C",
    fontSize: 14,
    fontWeight: "bold" as const,
  },
});