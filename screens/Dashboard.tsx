import React, { useState, useRef , useEffect } from "react";
import {Text, View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DashboardTopBar from "../components/DashboardTopBar";
import SafetyTipsCard from "../components/SafetyTipsCard";
import AIModuleCards from "../components/AIModuleCards";
import SupportNetworkCard from "../components/SupportNetworkCard";
// import { startRecording, stopRecording } from "../services/voiceRecorder";
import { analyzeAudio } from "../services/voiceApi";
import { startShakeDetection, stopShakeDetection } from "../services/MotionDetection";
import BottomNavBar from "../components/BottomNavBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { Audio } from 'expo-av';
type DashboardScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "Dashboard"
>;

type Props = {
  navigation: DashboardScreenNavProp;
};



export default function DashboardScreen({ navigation }: Props) {
    const recordingRef = useRef<Audio.Recording | null>(null);
  const insets = useSafeAreaInsets();
  const bottomNavReserved = 10;
  const [voiceStatus, setVoiceStatus] = useState<
  "IDLE" | "LISTENING" | "SAFE" | "DISTRESS"
>("IDLE");
const [motionStatus, setMotionStatus] = useState<
  "IDLE" | "ACTIVE" | "TRIGGERED"
>("IDLE");

useEffect(() => {
    return () => {
      stopShakeDetection();
    };
  }, []);

const startRecording = async () => {
  if (recordingRef.current) {
    console.log("Already recording, skipping...");
    return;
  }

  await Audio.requestPermissionsAsync();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync(
    Audio.RecordingOptionsPresets.HIGH_QUALITY
  );

  await recording.startAsync();
  recordingRef.current = recording;
};

const stopRecording = async () => {
  if (!recordingRef.current) return null;

  await recordingRef.current.stopAndUnloadAsync();
  const uri = recordingRef.current.getURI();

  recordingRef.current = null;

  return uri;
};

const handleVoiceDetection = async () => {
  try {
    if (voiceStatus === "LISTENING") return;

    setVoiceStatus("LISTENING");

    await startRecording();
    await new Promise((resolve) => setTimeout(resolve, 3000));

    const uri = await stopRecording();
    if (!uri) {
      setVoiceStatus("IDLE");
      return;
    }

    const result = await analyzeAudio(uri);

    const isDistress = result.final_decision === "DISTRESS";

    setVoiceStatus(isDistress ? "DISTRESS" : "SAFE");

    if (isDistress) {
      navigation.navigate("SOSScreen");
    }

  } catch (err) {
    console.error(err);
    setVoiceStatus("IDLE");
  }
};

const handleMotionDetection = () => {
  if (motionStatus === "ACTIVE") {
    stopShakeDetection();
    setMotionStatus("IDLE");
    return;
  }

  setMotionStatus("ACTIVE");

  startShakeDetection(
    () => {
      setMotionStatus("TRIGGERED");

      // Show ALERT first, then navigate
      setTimeout(() => {
        navigation.navigate("SOSScreen");

        // After navigation reset back to active
        setTimeout(() => {
          setMotionStatus("ACTIVE");
        }, 2000);
      }, 1000);
    },
    "MEDIUM" // LOW / MEDIUM / HIGH
  );
};

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <DashboardTopBar logoSource={require("../assets/logo.png")} />

      {/* Scrollable content */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomNavReserved + (insets.bottom || 12) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <SafetyTipsCard onPress={() => navigation.navigate("SafetyTipsScreen")}/>

    <AIModuleCards
  voiceStatus={voiceStatus}
  motionStatus={motionStatus}
  onPressCard={(key) => {
    if (key === "voice") handleVoiceDetection();
    if (key === "motion") handleMotionDetection();
 }}
/>
        <SupportNetworkCard
          onManage={() => navigation.navigate("ContactsScreen")}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navbar */}
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", position: "relative" },
  scrollContent: {
    paddingHorizontal: 0,
    paddingTop: 4,
  },
  fixedBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 999,
    elevation: 20,
  },
});
