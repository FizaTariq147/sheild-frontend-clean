import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AuthNavigator";

import DIcon from "../assets/icons/defense.svg";
import Dots from "./Dots";

type DScreenNavProp = StackNavigationProp<RootStackParamList, "D">;

type Props = {
  navigation: DScreenNavProp;
};
const { width } = Dimensions.get("window");

export default function DScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate("Login");
    }, 3000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      {/* Top Pink Ellipse */}
      <View style={styles.topEllipse} />

      {/* Get Started Button (replaced arrow) - Last screen so better CTA */}
      <TouchableOpacity
        style={styles.getStartedButton}
        onPress={() => navigation.navigate("Login")}
      >
        <Text style={styles.getStartedText}>Get Started</Text>
      </TouchableOpacity>

      {/* Illustration */}
      <DIcon width={300} height={300} style={styles.icon} />

      {/* Title */}
      <Text style={styles.title}>Defense</Text>

      {/* Description */}
      <Text style={styles.description}>
        Defense mechanisms are vital for protecting against threats. Our system
        employs advanced strategies to safeguard your environment. Stay secure
        with proactive defense measures.
      </Text>

      {/* Bottom Pink Ellipse */}
      <View style={styles.bottomEllipse} />

      {/* Bottom Navigation Row */}
      <View style={styles.bottomRow}>
        <Dots total={6} current={5} />
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

  // Get Started Button Styles (replaced nextButton)
  getStartedButton: {
    position: "absolute",
    top: 60, // Consistent with other screens
    right: 20,
    paddingVertical: 10,
    paddingHorizontal: 24,
     
    backgroundColor: "rgba(233, 35, 127, 0.1)",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#e9237f",
    zIndex: 3,
  },

  getStartedText: {
 fontSize: 14,
    color: "#e9237f", // Pink text matching the theme
    fontWeight: "600",
  },
});