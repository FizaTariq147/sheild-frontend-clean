import { Platform } from "react-native";
import Constants from "expo-constants";

// Check if we're running in Expo Go
const isExpoGo = Constants.appOwnership === "expo";

export const sendSafeZoneNotification = async (distanceKm: number) => {
  // Skip silently in Expo Go — won't crash
  if (isExpoGo) {
    console.log("[Notifications] Skipped in Expo Go:", distanceKm);
    return;
  }

  try {
    const Notifications = await import("expo-notifications");

    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      const { status: s } = await Notifications.requestPermissionsAsync();
      if (s !== "granted") return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "⚠️ Safe Zone Alert",
        body: `You are ${distanceKm.toFixed(1)} km away from your safe zone.`,
        sound: true,
        data: { type: "safe_zone_alert", distanceKm },
      },
      trigger: null,
    });
  } catch (e) {
    console.warn("[Notifications] Failed:", e);
  }
};

export const setupNotificationCategories = async () => {
  if (isExpoGo) return;

  try {
    const Notifications = await import("expo-notifications");
    await Notifications.setNotificationCategoryAsync("SAFE_ZONE_ALERT", [
      {
        identifier: "IM_SAFE",
        buttonTitle: "I'm Safe",
        options: { isDestructive: false, opensAppToForeground: true },
      },
      {
        identifier: "TRIGGER_SOS",
        buttonTitle: "Trigger SOS",
        options: { isDestructive: true, opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.warn("[Notifications] Category setup failed:", e);
  }
};