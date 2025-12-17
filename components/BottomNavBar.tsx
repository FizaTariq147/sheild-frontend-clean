// components/BottomNavBar.tsx
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Dimensions,
  GestureResponderEvent,
  Animated,
  Easing,
} from "react-native";

import { Ionicons, MaterialIcons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "../navigation/AppNavigator";

const { width } = Dimensions.get("window");
const NAV_HEIGHT = 82;
const CENTER_SIZE = 72;
const HORIZONTAL_MARGIN = 12; // outer margin (same on left & right)
const SIDE_ITEM_WIDTH = 64; // compact width for each side item

type Props = {
  onHome?: (e: GestureResponderEvent) => void;
  onLocation?: (e: GestureResponderEvent) => void;
  onSOS?: (e: GestureResponderEvent) => void;
  onLegal?: (e: GestureResponderEvent) => void;
  onContacts?: (e: GestureResponderEvent) => void;
  onLegalSupportScreen?: (e: GestureResponderEvent) => void;
  /** optional override for active route name (if your navigator uses different names) */
  activeRoute?: string;
};

export default function BottomNavBar({
  onHome,
  onLocation,
  onSOS,
  onLegal,
  onContacts,
  activeRoute: activeRouteProp,
}: Props) {
  const barWidth = width - HORIZONTAL_MARGIN * 2;
  const sideWidth = (barWidth - CENTER_SIZE) / 2;

  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute();

  // active route name (either passed or from navigator)
  const activeKey = (activeRouteProp ?? (route && (route as any).name) ?? "").toString();

  // Animated values for the five keys (match your screen names)
  const anim = useRef({
  Dashboard: new Animated.Value(activeKey === "Dashboard" ? 1 : 0),
  SafeSpacesScreen: new Animated.Value(activeKey === "SafeSpacesScreen" ? 1 : 0),
  SOSScreen: new Animated.Value(activeKey === "SOSScreen" ? 1 : 0),
  ContactsScreen: new Animated.Value(activeKey === "ContactsScreen" ? 1 : 0),
  LegalSupportScreen: new Animated.Value(activeKey === "LegalSupportScreen" ? 1 : 0),
}).current;


useEffect(() => {
  const keys: (keyof typeof anim)[] = [
    "Dashboard",
    "SafeSpacesScreen", 
    "SOSScreen",
    "ContactsScreen",
    "LegalSupportScreen",
  ];

  keys.forEach((k) => {
    Animated.timing(anim[k], {
      toValue: activeKey === k ? 1 : 0,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  });
}, [activeKey, anim]);


  // transform for icon circle (scale + lift)
  const iconCircleStyle = (key: keyof typeof anim) => {
    const v = anim[key];
    return {
      transform: [
        { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
        { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) as any },
      ],
    };
  };

  // underline animated style (scaleX + opacity) - native-driver-safe
  const underlineStyle = (key: keyof typeof anim) => {
    const v = anim[key];
    return {
      height: 3,
      width: 28,
      borderRadius: 2,
      backgroundColor: "#ffffff",
      transform: [{ scaleX: v }],
      opacity: v,
      alignSelf: "center",
      marginTop: 6,
    } as any;
  };

  // whether key is active (used for instant styles if necessary)
  const isActive = (k: string) => activeKey === k;

  // Side item renderer: keeps label as plain Text below the icon (unchanged)
  const SideItem = ({
    label,
    Icon,
    iconName,
    keyName,
    onPress,
    iconSize = 22,
  }: {
    label: string;
    Icon: any;
    iconName: string;
    keyName: keyof typeof anim;
    onPress?: (e?: any) => void;
    iconSize?: number;
  }) => {
    const v = anim[keyName];
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={onPress as any} style={styles.sideItem}>
        <Animated.View style={[styles.iconWrap, iconCircleStyle(keyName)] as any}>
          {/* keep icon color & circle color unchanged as requested */}
          <Icon name={iconName as any} size={iconSize} style={styles.icon} />
        </Animated.View>

        {/* keep label as plain Text under the icon */}
        <View style={{ alignItems: "center" }}>
          <Text style={styles.label}>{label}</Text>
          <Animated.View style={underlineStyle(keyName)} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={[styles.bar, { width: barWidth }]}>
        {/* LEFT group (Home, Location) */}
        <View style={[styles.sideGroup, { width: sideWidth }]}>
          <SideItem
            label="Home"
            Icon={Ionicons}
            iconName="home-outline"
            keyName="Dashboard"
            onPress={onHome ?? (() => navigation.navigate("Dashboard" as any))}
          />

          <SideItem
            label="Location"
            Icon={Ionicons}
            iconName="navigate-outline"
          keyName="SafeSpacesScreen"
onPress={onLocation ?? (() => navigation.navigate("SafeSpacesScreen" as any))}


          />
        </View>

        {/* CENTER (SOS) */}
        <View style={styles.centerWrap}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={onSOS ?? (() => navigation.navigate("SOSScreen" as any))}
            style={styles.centerButton}
          >
            <Animated.View
              style={[
                styles.centerInner,
                {
                  transform: [
                    { scale: anim.SOSScreen.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) },
                    { translateY: anim.SOSScreen.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) as any },
                  ],
                },
              ] as any}
            >
              <MaterialIcons name="sos" size={30} style={styles.centerIcon} />
            </Animated.View>
          </TouchableOpacity>
        </View>

        {/* RIGHT group (Contacts, Legal) */}
        <View style={[styles.sideGroup, { width: sideWidth }]}>
          <SideItem
            label="Contacts"
            Icon={Ionicons}
            iconName="person-add-outline"
            keyName="ContactsScreen"
            onPress={onContacts ?? (() => navigation.navigate("ContactsScreen" as any))}
          />

      <SideItem
  label="Legal"
  Icon={MaterialCommunityIcons}
  iconName="scale-balance"
  keyName="LegalSupportScreen"
  iconSize={24}
  onPress={onLegal ?? (() => navigation.navigate("LegalSupportScreen"))}
/>


        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    position: "relative",
    bottom: -50,
    alignItems: "center",
    paddingBottom: Platform.OS === "ios" ? -10 : 10,
    backgroundColor: "white",
    height: 110,
  },

  bar: {
    height: NAV_HEIGHT,
    marginHorizontal: HORIZONTAL_MARGIN,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 0, // removed internal padding to avoid asymmetry
    backgroundColor: "#e9237fff",
    shadowColor: "#E9237F",
    ...Platform.select({
      ios: {
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 18,
      },
      android: {
        elevation: 8,
      },
    }),
  },

  sideGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 6,
  },

  sideItem: {
    alignItems: "center",
    width: SIDE_ITEM_WIDTH,
  },

  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "rgba(233,35,127,0.12)",
    marginBottom: 6,
  },

  icon: {
    color: "#e9237f",
  },

  label: {
    fontSize: 11,
    color: "#fff",
    marginTop: -2,
    opacity: 0.95,
    textAlign: "center",
  },

  centerWrap: {
    width: CENTER_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },

  centerButton: {
    width: CENTER_SIZE,
    height: CENTER_SIZE,
    borderRadius: CENTER_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    borderWidth: 4,
    borderColor: "#ff9f1c",
    marginTop: -CENTER_SIZE / 2 - 6,
    ...Platform.select({
      ios: {
        shadowColor: "#ff9f1c",
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 12,
      },
      android: {
        elevation: 10,
      },
    }),
  },

  centerInner: {
    width: CENTER_SIZE - 14,
    height: CENTER_SIZE - 14,
    borderRadius: (CENTER_SIZE - 14) / 2,
    backgroundColor: "#e9237fff",
    alignItems: "center",
    justifyContent: "center",
  },

  centerIcon: {
    color: "#fff",
  },
});
