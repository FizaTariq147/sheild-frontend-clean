import React, { useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AuthNavigator";
   
import LocationIcon from "../assets/icons/location.svg";
import Dots from "./Dots";

type LocationScreenNavProp = StackNavigationProp<RootStackParamList, "Location">;

type Props = {
  navigation: LocationScreenNavProp;
};
const { width } = Dimensions.get("window");

export default function LocationScreen({ navigation }: Props) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate("D");
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
        onPress={() => navigation.navigate("D")}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Illustration */}
      <LocationIcon width={300} height={300} style={styles.icon} />

      {/* Title */}
      <Text style={styles.title}>Location</Text>

      {/* Description */}
      <Text style={styles.description}>
        Location awareness is crucial for effective emergency response. Our
        system pinpoints your location, ensuring help arrives swiftly. Stay safe
        and informed with real-time location tracking.
      </Text>

      {/* Bottom Pink Ellipse */}
      <View style={styles.bottomEllipse} />

      {/* Bottom Navigation Row */}
      <View style={styles.bottomRow}>
        <Dots total={6} current={4} />
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
    top: 40, // Better positioning for tap target
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