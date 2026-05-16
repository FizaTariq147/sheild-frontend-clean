import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Alert, Platform } from "react-native";
import { Audio } from "expo-av";
import * as Location from "expo-location";
import axios from "axios";

const API_URL = "http://192.168.10.8/predict"; // replace with your backend IP

export default function VoiceDetection() {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [status, setStatus] = useState<string>("Ready");

  useEffect(() => {
    requestPermissions();
  }, []);

  async function requestPermissions() {
    const mic = await Audio.requestPermissionsAsync();
    if (mic.status !== "granted") {
      Alert.alert("Permission needed", "Microphone permission is required.");
    }
  }

  async function startRecording() {
    try {
      setStatus("Listening...");
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);
      await rec.startAsync();

      setRecording(rec);
    } catch (e) {
      console.warn("startRecording:", e);
    }
  }

  async function stopRecordingAndAnalyze() {
    try {
      await recording?.stopAndUnloadAsync();
      const uri = recording?.getURI();
      setRecording(null);
      setStatus("Analyzing...");

      if (!uri) {
        setStatus("Error: file not found");
        return;
      }

      const form = new FormData();
      form.append("file", {
        uri,
        name: "voice.wav",
        type: "audio/wav",
      } as any);

      const resp = await axios.post(API_URL, form, {
        headers: { "Content-Type": "multipart/form-data" as string },
      });

      const result = resp.data.results?.[0]?.prediction;
      setStatus("Result: " + result);

      if (result === "Distress") {
        handleSOS();
      } else {
        Alert.alert("Info", "No distress detected.");
      }
    } catch (e) {
      console.warn("analyze error:", e);
      setStatus("Error");
    }
  }

  async function handleSOS() {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission", "Location permission needed for SOS.");
        return;
      }

      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const msg = `SOS! Distress detected. My location:\nhttps://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
      // You can trigger SMS/WhatsApp/call here — placeholder:
      Alert.alert("SOS!", msg);
      // TODO: send to trusted contact(s)
    } catch (e) {
      console.warn("SOS error:", e);
    }
  }

  return (
    <View style={{ padding: 20 }}>
      <Text>Status: {status}</Text>
      {recording ? (
        <TouchableOpacity onPress={stopRecordingAndAnalyze} style={{ marginTop: 20, padding: 15, backgroundColor: "#e9237f", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Stop & Analyze</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={startRecording} style={{ marginTop: 20, padding: 15, backgroundColor: "#e9237f", borderRadius: 8 }}>
          <Text style={{ color: "#fff" }}>Start Detection</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
