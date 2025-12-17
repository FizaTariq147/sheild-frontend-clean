// OtpVerificationScreen.tsx (Fixed Design)
import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Animated,
  Dimensions,
  SafeAreaView,
} from "react-native";
import { ThemeAlert } from "../components/ThemeAlert";

export default function OtpVerificationScreen({ route, navigation }: any) {
  const { pendingId, email, phone } = route.params || {};
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputsRef = useRef<Array<TextInput | null>>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const { width } = Dimensions.get("window");

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

  const BASE_URL = "http://192.168.100.12:5050/api/users";

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

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

  const handleOtpChange = (value: string, index: number) => {
    if (value.length > 1) {
      // Handle paste
      const pastedDigits = value.split("").slice(0, 6);
      const newOtp = [...otp];
      pastedDigits.forEach((digit, idx) => {
        if (idx < 6) newOtp[idx] = digit;
      });
      setOtp(newOtp);
      
      // Focus last filled input
      const lastFilledIndex = Math.min(pastedDigits.length - 1, 5);
      inputsRef.current[lastFilledIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next input
    if (value && index < 5) {
      inputsRef.current[index + 1]?.focus();
    }

    // Auto verify when all digits are filled
    if (newOtp.every(digit => digit !== "") && index === 5) {
      Keyboard.dismiss();
      setTimeout(() => handleVerify(), 300);
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
  };

  const getOtpString = () => otp.join("");

  const handleVerify = async () => {
    const otpString = getOtpString();
    if (!otpString || otpString.length !== 6) {
      showAlert("Error", "Please enter 6-digit OTP", [{ text: "OK" }], "error");
      return;
    }

    setLoading(true);
    try {
      console.log("🔍 Verifying OTP:", otpString);
      
      const res = await fetch(`${BASE_URL}/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otpString }),
      });

      const text = await res.text();
      console.log("🔍 OTP Verification Response:", text);
      
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("Server returned non-JSON response:", text);
        showAlert("Error", "Server returned unexpected response", [{ text: "OK" }], "error");
        setLoading(false);
        return;
      }

      if (res.ok) {
        console.log("✅ OTP Verification successful");
        
        showAlert(
          "Success!",
          "Your account has been verified! Please login with your credentials.",
          [
            {
              text: "Go to Login",
              onPress: () => {
                navigation.replace("Login", { 
                  prefillEmail: email,
                  verifiedMessage: "Account verified successfully! Please login."
                });
              }
            }
          ],
          "success"
        );
      } else {
        showAlert("Error", data?.error || data?.message || "Invalid OTP", [{ text: "OK" }], "error");
      }
    } catch (error: any) {
      console.error("OTP Verify Error:", error);
      showAlert("Error", error.message || "Something went wrong", [{ text: "OK" }], "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (timer > 0) return;
    
    if (!email && !phone) {
      showAlert("Error", "No email or phone available to resend OTP", [{ text: "OK" }], "error");
      return;
    }

    setResending(true);
    try {
      const res = await fetch(`${BASE_URL}/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, phone, type: "email_verif" }),
      });

      const data = await res.json();
      if (res.ok) {
        showAlert("Success", "OTP resent successfully!", [{ text: "OK" }], "success");
        setTimer(60); // Reset timer
      } else {
        showAlert("Error", data?.message || "Failed to resend OTP", [{ text: "OK" }], "error");
      }
    } catch (error) {
      console.error("Resend OTP Error:", error);
      showAlert("Error", "Something went wrong", [{ text: "OK" }], "error");
    } finally {
      setResending(false);
    }
  };

  // Format timer to match image (0:47)
  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <>
      <SafeAreaView style={styles.container}>
        <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
          
          {/* App Name WITHOUT divider line */}
          <View style={styles.appHeader}>
            <Text style={styles.appName}>SHEILD</Text>
          </View>

          {/* Main Content */}
          <View style={styles.mainSection}>
            <Text style={styles.title}>Enter Verification Code</Text>
            
            <Text style={styles.instruction}>
              We've sent an OTP to your email:
            </Text>
            
            <Text style={styles.emailDisplay}>{email || "your email"}</Text>

            {/* OTP Boxes - 6 digits */}
            <View style={styles.otpContainer}>
              {otp.map((digit, index) => (
                <View key={index} style={styles.otpItem}>
                  <View style={styles.otpPlaceholder}>
                    <Text style={styles.placeholderDot}>●</Text>
                  </View>
                  <TextInput
                    ref={ref => inputsRef.current[index] = ref}
                    style={styles.otpInput}
                    value={digit}
                    onChangeText={(value) => handleOtpChange(value, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    maxLength={index === 0 ? 6 : 1}
                    autoFocus={index === 0}
                    selectTextOnFocus
                  />
                  <Text style={styles.otpDigitDisplay}>
                    {digit || "0"}
                  </Text>
                </View>
              ))}
            </View>

            {/* Timer Display */}
            <View style={styles.timerSection}>
              <Text style={styles.timerText}>
                Resend OTP in {formatTimer(timer)}
              </Text>
            </View>

            {/* Buttons Container */}
            <View style={styles.buttonsContainer}>
              {/* Submit Button - Full width like OTP boxes */}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.submitButton,
                  loading && styles.buttonDisabled
                ]}
                onPress={handleVerify}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text style={styles.submitButtonText}>Submit</Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.buttonDivider} />

              {/* Resend Button - Same width as Submit button */}
              <TouchableOpacity
                style={[
                  styles.button,
                  styles.resendButton,
                  (resending || timer > 0) && styles.buttonDisabled
                ]}
                onPress={handleResendOtp}
                disabled={resending || timer > 0}
                activeOpacity={0.7}
              >
                <Text style={styles.resendButtonText}>
                  {resending ? "Sending..." : "Resend OTP"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <Text style={styles.helpText}>
              Didn't receive the code? Check your spam folder or try resending.
            </Text>
          </View>

          {/* Back Link */}
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => navigation.goBack()}
            activeOpacity={0.6}
          >
            <Text style={styles.backLinkText}>Back to sign up</Text>
          </TouchableOpacity>
        </Animated.View>
      </SafeAreaView>

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
  container: {
    flex: 1,
    backgroundColor: "#FFEFF2",
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
  },
  // Removed divider line under SHEILD
  appHeader: {
    alignItems: "center",
    marginTop: 50,  
    marginBottom: 10,
  },
  appName: {
    fontSize: 32,
    fontWeight: "800",
    color: "#e9237f",
    letterSpacing: 1.5,
  },
  mainSection: {
    flex: 1,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
    marginBottom: 16,
    textAlign: "center",
  },
  instruction: {
    fontSize: 15,
    color: "#666",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 20,
  },
  emailDisplay: {
    fontSize: 16,
    fontWeight: "600",
    color: "#e9237f",
    marginBottom: 25,
    textAlign: "center",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 32,
    gap: 10,
    width: "100%",
    maxWidth: 330, // Width of 6 boxes with gaps
  },
  otpItem: {
    alignItems: "center",
    position: "relative",
  },
  otpPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12, // More rounded corners
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFF",
    justifyContent: "center",
    alignItems: "center",
    
  },
  placeholderDot: {
    fontSize: 8,
    color: "#CCC",
  },
  otpInput: {
    position: "absolute",
    width: 44,
    height: 44,
    fontSize: 1,
    color: "transparent",
    backgroundColor: "transparent",
  },
  otpDigitDisplay: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    position: "absolute",
    top: 12,
  },
  timerSection: {
    marginBottom: 32,
  },
  timerText: {
    fontSize: 15,
    color: "#888",
    fontWeight: "500",
  },
  // Buttons Container
  buttonsContainer: {
    width: "100%",
    maxWidth: 330, // Same width as OTP boxes container
    alignItems: "center",
    marginBottom: 24,
  },
  // Base button style - same width for both
  button: {
    width: "100%",
    paddingVertical: 10,
    borderRadius: 25, 
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  submitButton: {
    backgroundColor: "#e9237f",
    borderColor: "#e9237f",
    marginBottom: 16,
    shadowColor: "#e9237f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  resendButton: {
    backgroundColor: "transparent",
    borderColor: "#e9237f",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
    letterSpacing: 0.5,
  },
  resendButtonText: {
    color: "#e9237f",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonDivider: {
    height: 1,
    width: "100%",
    backgroundColor: "#E8E8E8",
    marginBottom: 16,
  },
  helpText: {
    fontSize: 13,
    color: "#999",
    textAlign: "center",
    lineHeight: 18,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  backLink: {
    paddingVertical: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  backLinkText: {
    color: "#e9237f",
    fontSize: 14,
    fontWeight: "500",
    opacity: 0.8,
  },
});