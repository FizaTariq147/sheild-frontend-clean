import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppNavigator from "./navigation/AppNavigator";
import AuthNavigator from "./navigation/AuthNavigator";
import * as Notifications from 'expo-notifications';

// ADDED: Set notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await AsyncStorage.getItem("accessToken");
      setIsLoggedIn(!!token);
    };
    checkLoginStatus();

    // ADDED: Request notification permissions on app start
    const requestNotificationPermissions = async () => {
      const { status } = await Notifications.requestPermissionsAsync();
      if (status !== 'granted') {
        console.log('Notification permissions not granted');
      }
    };
    requestNotificationPermissions();

    // ADDED: Set up notification listeners
    const notificationListener = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification received:', notification);
    });

    const responseListener = Notifications.addNotificationResponseReceivedListener(response => {
      console.log('Notification response:', response);
      // Handle notification tap here if needed
    });

    return () => {
      Notifications.removeNotificationSubscription(notificationListener);
      Notifications.removeNotificationSubscription(responseListener);
    };
  }, []);

  // Function to handle login
  const handleLogin = async (token: string) => {
    await AsyncStorage.setItem("accessToken", token);
    setIsLoggedIn(true);
  };

  // Function to handle logout
  const handleLogout = async () => {
    await AsyncStorage.removeItem("accessToken");
    setIsLoggedIn(false);
  };

  if (isLoggedIn === null) return null; // could be replaced with <SplashScreen />

  return (
    <NavigationContainer>
      {isLoggedIn ? (
        <AppNavigator onLogout={handleLogout} />
      ) : (
        <AuthNavigator onLogin={handleLogin} />
      )}
    </NavigationContainer>
  );
}