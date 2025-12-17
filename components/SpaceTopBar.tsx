import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Platform,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

type SpaceTopBarProps = {
  title: string;
  subtitle?: string;
  onBack: () => void;
  logoSource?: any;
};

export default function SpaceTopBar({
  title,
  subtitle,
  onBack,
  logoSource,
}: SpaceTopBarProps) {
  return (
    <View style={styles.container}>
      {/* Left Section (Back + Titles) */}
      <View style={styles.left}>
        <TouchableOpacity onPress={onBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>

        <View style={{ marginLeft: 10 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {/* Right Section (Logo bubble same as LegalTopBar) */}
      <View style={styles.iconWrapOuter}>
        <View style={styles.iconWrapInner}>
          {logoSource ? (
            <Image source={logoSource} style={styles.logoImage} />
          ) : (
            <Text style={styles.logoFallback}>❤</Text>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: Platform.OS === "ios" ? 50 : 40,
    height: 72,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#EFEFF2",
    backgroundColor: "#FFFFFF",
  },

  left: {
    flexDirection: "row",
    alignItems: "center",
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },

  subtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },

  iconWrapOuter: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: "#ffd7e7",
    alignItems: "center",
    justifyContent: "center",
  },

  iconWrapInner: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#e9237f",
    shadowColor: "#f08fb1",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },

  logoImage: {
    width: 40,
    height: 40,
    resizeMode: "contain",
    tintColor: "#fff",
  },

  logoFallback: {
    fontSize: 18,
    color: "#fff",
    lineHeight: Platform.OS === "android" ? 24 : 18,
  },
});
