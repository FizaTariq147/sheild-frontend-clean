// LoginScreen.tsx (Updated with verification message)
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Animated,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AuthNavigator";
import { Ionicons } from "@expo/vector-icons";
import { ThemeAlert } from "../components/ThemeAlert";

type LoginScreenNavProp = NativeStackNavigationProp<RootStackParamList, "Login">;

export default function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavProp>();
  const route = useRoute();
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false); // ADDED
  
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

  // Cleanup effect
  useEffect(() => {
    return () => {
      setAlertVisible(false);
    };
  }, []);

  useEffect(() => {
    // Check if email was pre-filled from OTP screen
    const params = route.params as any;
    if (params?.prefillEmail) {
      console.log("📧 Pre-filling email from OTP screen:", params.prefillEmail);
      setEmail(params.prefillEmail);
      
      // Show verification message if coming from OTP verification
      if (params?.verifiedMessage) {
        setShowVerificationMessage(true);
        // Auto-hide message after 5 seconds
        setTimeout(() => {
          setShowVerificationMessage(false);
        }, 5000);
      }
    }

    // Check token
    (async () => {
      try {
        const token = await AsyncStorage.getItem("accessToken");
        if (token) {
          console.debug("User already logged in");
        }
      } catch (e) {
        console.debug("LoginScreen: error checking stored token", e);
      }
    })();

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
  }, [route.params]);

  const spin = logoRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  const handleLogin = async () => {
    if (!email || !password) {
      showAlert(
        "Missing fields",
        "Please enter both email and password.",
        [{ text: "OK" }],
        "warning"
      );
      return;
    }

    setLoading(true);
    const url = "http://192.168.100.12:5050/api/users/login";

    try {
      console.log("🔍 Login attempt for:", email);
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const raw = await res.text();
      console.log("🔍 Login Response Status:", res.status);
      console.log("🔍 Login Response:", raw);
      
      let body: any = null;
      try {
        body = raw ? JSON.parse(raw) : null;
      } catch {
        body = null;
      }

      if (!res.ok) {
        const serverMsg = (body && (body.error || body.message)) || raw || `HTTP ${res.status}`;
        
        console.log("❌ Login failed:", serverMsg);
        
        // Try lowercase email
        if (serverMsg.includes("Invalid email or password")) {
          console.log("🔄 Trying with lowercase email...");
          
          const lowerRes = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              email: email.toLowerCase(), 
              password 
            }),
          });
          
          const lowerText = await lowerRes.text();
          console.log("🔄 Lowercase attempt status:", lowerRes.status);
          console.log("🔄 Lowercase response:", lowerText);
          
          if (lowerRes.ok) {
            console.log("✅ Login succeeded with lowercase email!");
            
            let lowerBody: any = null;
            try {
              lowerBody = lowerText ? JSON.parse(lowerText) : null;
            } catch {
              lowerBody = null;
            }
            
            // Save tokens/user from lowercase attempt
            try {
              const accessToken = lowerBody?.accessToken || lowerBody?.access_token || lowerBody?.token || null;
              const refreshToken = lowerBody?.refreshToken || lowerBody?.refresh_token || null;
              const user = lowerBody?.user || lowerBody?.data || null;

              if (accessToken) {
                await AsyncStorage.setItem("accessToken", accessToken);
                console.log("✅ Access token saved");
              }
              if (refreshToken) {
                await AsyncStorage.setItem("refreshToken", refreshToken);
                console.log("✅ Refresh token saved");
              }
              if (user) {
                await AsyncStorage.setItem("user", JSON.stringify(user));
                console.log("✅ User data saved");
              }
            } catch (e) {
              console.warn("Failed to persist tokens/user", e);
            }

            // Show success and navigate
            showAlert(
              "Welcome",
              "Signed in successfully!",
              [
                {
                  text: "Continue",
                  onPress: () => {
                    if (isNavigating) return;
                    setIsNavigating(true);
                    
                    setAlertVisible(false);
                    
                    setTimeout(() => {
                      navigation.reset({
                        index: 0,
                        routes: [{ name: "Dashboard" }],
                      });
                      console.log("✅ Navigation to Dashboard complete");
                      setIsNavigating(false);
                    }, 200);
                  }
                }
              ],
              "success"
            );
            setLoading(false);
            return;
          }
        }
        
        // Show error
        let errorMessage = serverMsg.toString();
        
        // Special handling for verification errors
        if (errorMessage.includes("verify") || errorMessage.includes("verified")) {
          errorMessage = "Your account needs verification. Please check your email for OTP.";
        } else if (errorMessage.includes("password") || errorMessage.includes("credentials")) {
          errorMessage = "Invalid email or password. Please check your credentials.";
        } else if (errorMessage.includes("user") || errorMessage.includes("found")) {
          errorMessage = "No account found. Please sign up first.";
        }
        
        showAlert(
          "Login failed",
          errorMessage,
          [{ text: "OK" }],
          "error"
        );
        setLoading(false);
        return;
      }

      // Login successful
      console.log("✅ LOGIN SUCCESSFUL!");
      
      // Save tokens/user
      try {
        const accessToken = body?.accessToken || body?.access_token || body?.token || null;
        const refreshToken = body?.refreshToken || body?.refresh_token || null;
        const user = body?.user || body?.data || null;

        if (accessToken) {
          await AsyncStorage.setItem("accessToken", accessToken);
          console.log("✅ Access token saved");
        }
        if (refreshToken) {
          await AsyncStorage.setItem("refreshToken", refreshToken);
          console.log("✅ Refresh token saved");
        }
        if (user) {
          await AsyncStorage.setItem("user", JSON.stringify(user));
          console.log("✅ User data saved");
        }
      } catch (e) {
        console.warn("LoginScreen: failed to persist tokens/user", e);
      }

      // Show success alert
      showAlert(
        "Welcome",
        "Signed in successfully!",
        [
          {
            text: "Continue",
            onPress: () => {
              if (isNavigating) return;
              setIsNavigating(true);
              
              setAlertVisible(false);
              
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: "Dashboard" }],
                });
                console.log("✅ Navigation to Dashboard complete");
                setIsNavigating(false);
              }, 200);
            }
          }
        ],
        "success"
      );
    } catch (err) {
      console.error("Login network error:", err);
      showAlert(
        "Error",
        "Unable to contact server. Check API URL & network.",
        [{ text: "OK" }],
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCloseAlert = () => {
    setAlertVisible(false);
  };

  return (
    <>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
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
            <Text style={styles.title}>Login</Text>
            <Text style={styles.subtitle}>
              Empower yourself with SHEILD
            </Text>

            {/* Verification Success Message */}
            {showVerificationMessage && (
              <View style={styles.successMessage}>
                <Text style={styles.successText}>
                  ✅ Account verified! Please login with your credentials.
                </Text>
              </View>
            )}

            {/* Form Card */}
            <Animated.View
              style={[
                styles.formCard,
                {
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              {/* Email Input */}
              <View style={styles.inputWrapper}>
                <Ionicons
                  name="person-outline"
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

              {/* Log In Button */}
              <TouchableOpacity
                style={[styles.signInButton, loading && styles.signInButtonDisabled]}
                onPress={handleLogin}
                disabled={loading || isNavigating}
                activeOpacity={0.8}
              >
                <Text style={styles.signInButtonText}>
                  {loading ? "Logging In..." : "Log In"}
                </Text>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={styles.signUpContainer}>
                <Text style={styles.signUpPrompt}>Don't have an account? </Text>
                <TouchableOpacity 
                  onPress={() => navigation.navigate("Signup")}
                  disabled={isNavigating}
                >
                  <Text style={styles.signUpText}>Sign Up</Text>
                </TouchableOpacity>
              </View>
            </Animated.View>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>

      {/* Theme Alert */}
      <ThemeAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={handleCloseAlert}
      />
    </>
  );
}

// Updated Styles
const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  container: {
    flex: 1,
    height: "100%",
    backgroundColor: "#FFEFF2",
    padding: 20,
    justifyContent: "center" as const,
  },
  content: {
    alignItems: "center" as const,
    zIndex: 10,
  },
  // Success message
  successMessage: {
    backgroundColor: "rgba(46, 204, 113, 0.1)",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "rgba(46, 204, 113, 0.3)",
    width: "100%",
  },
  successText: {
    color: "#27ae60",
    fontSize: 14,
    textAlign: "center",
    fontWeight: "500",
  },
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
  signInButton: {
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
  signInButtonDisabled: {
    opacity: 0.6,
  },
  signInButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold" as const,
    letterSpacing: 0.5,
  },
  signUpContainer: {
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  signUpPrompt: {
    color: "#666",
    fontSize: 14,
  },
  signUpText: {
    color: "#3D246C",
    fontSize: 14,
    fontWeight: "bold" as const,
  },
});