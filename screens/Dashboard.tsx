import React from "react";
import {Text, View, StyleSheet, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import DashboardTopBar from "../components/DashboardTopBar";
import SafetyTipsCard from "../components/SafetyTipsCard";
import AIModuleCards from "../components/AIModuleCards";
import SupportNetworkCard from "../components/SupportNetworkCard";
import BottomNavBar from "../components/BottomNavBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";

type DashboardScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "Dashboard"
>;

type Props = {
  navigation: DashboardScreenNavProp;
};

export default function DashboardScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomNavReserved = 10;
  

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
          onPressCard={(key) => {
            console.log("pressed", key);
            // later: navigation.navigate("SomeScreen", { key });
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
