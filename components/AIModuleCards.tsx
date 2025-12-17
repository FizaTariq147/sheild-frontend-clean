// components/AIModuleCards.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient"; // or 'react-native-linear-gradient'
import { MaterialCommunityIcons, FontAwesome5 } from "@expo/vector-icons";

const { width } = Dimensions.get("window");

type CardData = {
  key: string;
  title: string;
  subtitle: string;
  statusLabel?: string;
  // gradient colors for the card outer bg
  colors: string[];
  // icon render — choose from available icons
  iconName: string;
  iconLib: "MaterialCommunity" | "FontAwesome5";
};

const DEFAULT_DATA: CardData[] = [
  {
    key: "voice",
    title: "Voice Detection",
    subtitle: "Listening for sounds…",
    statusLabel: "Advance",
    colors: ["#fff0f4", "#ffd6e6", "#ff2d7a"], // pink gradient
    iconName: "microphone",
    iconLib: "FontAwesome5",
  },
  {
    key: "motion",
    title: "Motion Detection",
    subtitle: "Detecting movement…",
    statusLabel: "Advance",
    colors: ["#f3f3ff", "#e6e2ff", "#9d1af2"], // purple gradient
    iconName: "motion-sensor", // MaterialCommunityIcons
    iconLib: "MaterialCommunity",
  },
];

export default function AIModuleCards({
  data = DEFAULT_DATA,
  onPressCard,
}: {
  data?: CardData[];
  onPressCard?: (key: string) => void;
}) {
  return (
    <View style={styles.row}>
      {data.map((c) => (
        <TouchableOpacity
          key={c.key}
          style={styles.cardWrap}
          activeOpacity={0.9}
          onPress={() => onPressCard?.(c.key)}
        >
          {/* outer gradient */}
          <LinearGradient
            colors={c.colors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.card}
          >
            {/* inner rounded square icon */}
            <View style={styles.iconBox}>
              <LinearGradient
                colors={["rgba(255,255,255,0.95)", "rgba(255,255,255,0.9)"]}
                style={styles.iconInner}
              >
                {c.iconLib === "MaterialCommunity" ? (
                  <MaterialCommunityIcons
                    name={c.iconName}
                    size={28}
                    color={c.key === "voice" ? "#e9237f" : "#6b46ff"}
                  />
                ) : (
                  <FontAwesome5
                    name={c.iconName}
                    size={20}
                    color={c.key === "voice" ? "#e9237f" : "#6b46ff"}
                    solid
                  />
                )}
              </LinearGradient>
            </View>

            {/* Title & subtitle */}
            <View style={styles.textCol}>
              <Text style={styles.title}>{c.title}</Text>
              <Text style={styles.subtitle}>{c.subtitle}</Text>
            </View>

            {/* status pill */}
            {c.statusLabel ? (
              <View style={styles.statusWrap}>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>{c.statusLabel}</Text>
                </View>
              </View>
            ) : null}
          </LinearGradient>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const CARD_WIDTH = Math.round((width - 48) / 2); // 16px outer padding + 16 gap
const IS_ANDROID = Platform.OS === "android";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    gap: 16,
    flexWrap: "wrap",
  },

  cardWrap: {
    width: CARD_WIDTH,
    minHeight: 160,
    marginVertical: 8,
  },

  card: {
    borderRadius: 16,
    padding: 18,
    minHeight: 160,
    justifyContent: "flex-start",
    // subtle border like screenshot
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.03)",
    // shadow
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.06,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
      },
      android: {
        elevation: 4,
      },
    }),
  },

  iconBox: {
    width: 56,
    height: 56,
    borderRadius: 12,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    // inner subtle shadow
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.04, shadowOffset: { width: 0, height: 6 }, shadowRadius: 10 },
      android: { elevation: 2 },
    }),
  },

  iconInner: {
    width: 52,
    height: 52,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
  },

  textCol: {
    flex: 1,
  },

  title: {
    fontSize: 14,
    fontWeight: "700",
    color: "#0f1720",
    marginBottom: 6,
  },

  subtitle: {
    fontSize: 11,
    color: "rgba(15,23,32,0.6)",
    marginBottom: 10,
  },

  statusWrap: {
    marginTop: 6,
    alignItems: "flex-start",
  },

  statusPill: {
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 0.5,
    borderColor: "rgba(0,0,0,0.05)",
  },

  statusText: {
    color: "#e9237f", // pink for left; for right you can override if needed
    fontWeight: "700",
    fontSize: 12,
  },
});
