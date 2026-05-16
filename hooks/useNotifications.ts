// hooks/useNotifications.ts
//
// ─── PHASE GUIDE ─────────────────────────────────────────────────────────────
//
//  NOW  (Expo Go / development)
//    • Uses expo-notifications
//    • Works in Expo Go without any native build
//    • Registers an Expo Push Token with your backend
//    • Handles foreground notifications as in-app banners
//    • Background / killed state handled by Expo's built-in handler
//
//  LATER  (Production / EAS build / bare workflow)
//    • Replace the body of this hook with the Firebase version below
//    • Install:  @react-native-firebase/messaging  +  @notifee/react-native
//    • Only THIS file changes — nothing else in your app needs to update
//
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef }                   from "react";
import { Platform, AppState, AppStateStatus }  from "react-native";
import * as Notifications                       from "expo-notifications";
import * as Device                              from "expo-device";
import AsyncStorage                             from "@react-native-async-storage/async-storage";
import { useNavigation }                        from "@react-navigation/native";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "https://fiza-tariq-shield-backend.hf.space";

// ── How foreground notifications behave (banner + sound + badge) ──────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
});

// ── Navigate to the correct chat from a notification ─────────────────────────
const navigateFromNotification = (
  navigation: any,
  data?: Record<string, any>
) => {
  if (!data?.contactId && !data?.senderId) return;

  navigation.navigate("ChatScreen", {
    contactId:     data.contactId    ?? data.senderId,
    contactName:   data.senderName   ?? "Contact",
    contactPhone:  data.phone        ?? "",
    currentUserId: null,   // ChatScreen loads this itself from AsyncStorage
    chatId:        null,
  });
};

// ── Register the Expo push token with your backend ────────────────────────────
const registerExpoPushToken = async (): Promise<string | null> => {
  // Physical device only — simulators cannot receive push
  if (!Device.isDevice) {
    console.warn("[notifications] Push tokens only work on physical devices");
    return null;
  }

  // Ask / check permission
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("[notifications] Permission not granted");
    return null;
  }

  // Android needs a channel before any notification can appear
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("shield_chat", {
      name:               "SHIELD Chat Messages",
      importance:         Notifications.AndroidImportance.HIGH,
      vibrationPattern:   [0, 300, 200, 300],
      lightColor:         "#e9237f",
      sound:              "default",
      enableVibrate:      true,
    });

    await Notifications.setNotificationChannelAsync("shield_calls", {
      name:       "SHIELD Calls",
      importance: Notifications.AndroidImportance.MAX,
      sound:      "default",
      enableVibrate: true,
    });
  }

  // Get the Expo push token
  // projectId comes from app.json › extra › eas › projectId
  const tokenData = await Notifications.getExpoPushTokenAsync({
    projectId: process.env.EXPO_PUBLIC_PROJECT_ID,
  });

  const token = tokenData.data;
  console.info("[notifications] Expo push token:", token);

  // Save locally so we can deregister on logout
  await AsyncStorage.setItem("expoPushToken", token);

  // Send to backend
  try {
    const accessToken = await AsyncStorage.getItem("accessToken");
    if (accessToken) {
      await fetch(`${API_BASE_URL}/api/users/expo-push-token`, {
        method:  "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization:  `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ token }),
      });
    }
  } catch (err) {
    console.error("[notifications] Token registration failed:", err);
  }

  return token;
};

// ── Deregister token on logout ────────────────────────────────────────────────
export const deregisterPushToken = async () => {
  try {
    const [accessToken, token] = await Promise.all([
      AsyncStorage.getItem("accessToken"),
      AsyncStorage.getItem("expoPushToken"),
    ]);
    if (!accessToken || !token) return;

    await fetch(`${API_BASE_URL}/api/users/expo-push-token`, {
      method:  "DELETE",
      headers: {
        "Content-Type": "application/json",
        Authorization:  `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ token }),
    });

    await AsyncStorage.removeItem("expoPushToken");
    console.info("[notifications] Token deregistered");
  } catch (err) {
    console.error("[notifications] Deregister failed:", err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Main hook — call once in your root App component or a persistent screen
// ─────────────────────────────────────────────────────────────────────────────
export const useNotifications = () => {
  const navigation   = useNavigation<any>();
  const navRef       = useRef(navigation);
  navRef.current     = navigation;

  const appStateRef  = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    // 1. Register token
    registerExpoPushToken();

    // 2. FOREGROUND: notification received while app is open
    //    expo-notifications shows it automatically (via setNotificationHandler above)
    //    We additionally listen so we can update unread badges in real time
    const foregroundSub = Notifications.addNotificationReceivedListener((notification) => {
      console.info("[notifications] foreground:", notification.request.content.title);
      // You can dispatch to a global state / context here if needed
      // e.g. incrementUnreadCount(notification.request.content.data?.senderId)
    });

    // 3. BACKGROUND or TERMINATED: user tapped the notification
    //    This fires when the app opens from a notification tap
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, any>;
      console.info("[notifications] tapped:", data);
      navigateFromNotification(navRef.current, data);
    });

    // 4. AppState: when app returns to foreground, refresh unread count
    //    (socket may have missed messages while backgrounded)
    const appStateSub = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (
          appStateRef.current.match(/inactive|background/) &&
          nextState === "active"
        ) {
          // App came to foreground — good place to refresh badge count
          Notifications.getBadgeCountAsync().then((count) => {
            console.info("[notifications] badge on resume:", count);
          });
        }
        appStateRef.current = nextState;
      }
    );

    return () => {
      foregroundSub.remove();
      responseSub.remove();
      appStateSub.remove();
    };
  }, []);
};

// ─────────────────────────────────────────────────────────────────────────────
// HOW TO SWAP TO FIREBASE LATER (production)
// ─────────────────────────────────────────────────────────────────────────────
//
// 1. Run:
//      npx expo prebuild          ← ejects to bare workflow
//      npx expo install @react-native-firebase/app @react-native-firebase/messaging
//      npx expo install @notifee/react-native
//
// 2. Add google-services.json (Android) and GoogleService-Info.plist (iOS)
//
// 3. Replace the entire body of useNotifications() with:
//
//   import messaging from "@react-native-firebase/messaging";
//   import notifee, { AndroidImportance, EventType } from "@notifee/react-native";
//
//   export const useNotifications = () => {
//     const navigation = useNavigation();
//     useEffect(() => {
//       // Create Android channel
//       notifee.createChannel({ id: "shield_chat", name: "SHIELD Chat", importance: AndroidImportance.HIGH });
//
//       // Request permission
//       messaging().requestPermission();
//
//       // Get + register FCM token
//       messaging().getToken().then(registerFCMToken);
//       messaging().onTokenRefresh(registerFCMToken);
//
//       // Foreground
//       const unsubFCM = messaging().onMessage(async ({ notification, data }) => {
//         await notifee.displayNotification({ title: notification.title, body: notification.body, android: { channelId: "shield_chat" }, data });
//       });
//
//       // Background tap
//       messaging().onNotificationOpenedApp((msg) => navigateFromNotification(navigation, msg.data));
//
//       // Terminated tap
//       messaging().getInitialNotification().then((msg) => {
//         if (msg) setTimeout(() => navigateFromNotification(navigation, msg.data), 500);
//       });
//
//       return () => unsubFCM();
//     }, []);
//   };
//
// 4. In index.js (outside React), add:
//      messaging().setBackgroundMessageHandler(async ({ notification, data }) => {
//        await notifee.displayNotification({ title: notification.title, body: notification.body,
//          android: { channelId: "shield_chat" }, data });
//      });
//
// 5. Update backend to use FCM tokens instead of Expo tokens (NotificationService.js)
//    Everything else (socket, controllers, screens) stays exactly the same.
//
// ─────────────────────────────────────────────────────────────────────────────