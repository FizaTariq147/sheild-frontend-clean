import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AuthNavigator";
// import { LinearGradient } from 'expo-linear-gradient';
import HelpIcon from "../assets/icons/help.svg";
import Dots from "./Dots";

type HScreenNavProp = StackNavigationProp<RootStackParamList, "H">;

type Props = {
  navigation: HScreenNavProp;
};
const { width } = Dimensions.get("window");

export default function HScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate("E");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Top Pink Ellipse */}
      <View style={styles.topEllipse} />

      {/* Skip Button (replaced arrow) */}
      <TouchableOpacity
        style={styles.skipButton}
        onPress={() => navigation.navigate("E")}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Illustration */}
      <HelpIcon width={300} height={300} style={styles.icon} />

      {/* Title */}
      <Text style={styles.title}>Help</Text>

      {/* Description */}
      <Text style={styles.description}>
        Help is always within reach, offering support in times of need. Whether
        it's guidance or quick response, assistance is never far away. You are
        never alone when help is built into your system.
      </Text>

      {/* Bottom Pink Ellipse */}
      <View style={styles.bottomEllipse} />

      {/* Bottom Navigation Row */}
      <View style={styles.bottomRow}>
        <Dots total={6} current={1} />
      </View>
    </View>
  );
}

const CIRCLE_SIZE = width * 1.5; // large enough to create a perfect half-circle

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 90,
    backgroundColor: "#fff",
  },

  // top circle positioned so only the bottom half is visible
  topEllipse: {
    position: "absolute",
    top: -(CIRCLE_SIZE / 2) - 210, // push up so only half shows
    left: (width - CIRCLE_SIZE) / 2, // center horizontally
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#e9237fff",
    zIndex: 0,
  },

  // bottom circle positioned so only the top half is visible
  bottomEllipse: {
    position: "absolute",
    bottom: -(CIRCLE_SIZE / 2) - 210, // push down so only half shows
    left: (width - CIRCLE_SIZE) / 2, // center horizontally
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    backgroundColor: "#e9237fff",
    zIndex: 0,
  },

  icon: {
    marginBottom: 30,
    zIndex: 2, // ensure icon is above the circular backgrounds
    alignSelf: "center",
  },

  title: {
    fontSize: 36,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 15,
    textAlign: "left",
    zIndex: 2,
  },

  description: {
    fontSize: 16,
    color: "#555",
    lineHeight: 22,
    textAlign: "left",
    paddingHorizontal: 5,
    zIndex: 2,
  },

  bottomRow: {
    position: "absolute",
    bottom: 40,
    width: "100%",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
    zIndex: 2,
    marginLeft: 20,
  },

  // Skip Button Styles (replaced nextButton)
  skipButton: {
    position: "absolute",
    top: 40, // Slightly lower than the arrow was
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(233, 35, 127, 0.1)", // Light pink background
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e9237f", // Pink border
    zIndex: 3,
  },

  skipText: {
    fontSize: 14,
    color: "#e9237f", // Pink text
    fontWeight: "600",
  },
});