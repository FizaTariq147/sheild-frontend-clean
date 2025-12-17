import React, { useEffect, useState } from "react";
import { NavigationContainer } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import AppNavigator from "./navigation/AppNavigator";
import AuthNavigator from "./navigation/AuthNavigator";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    const checkLoginStatus = async () => {
      const token = await AsyncStorage.getItem("accessToken");
      setIsLoggedIn(!!token);
    };
    checkLoginStatus();
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
