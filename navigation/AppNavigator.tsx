import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from 'react-native-safe-area-context';
// Screens
import DashboardScreen from "../screens/Dashboard";
import SettingsScreen from "../screens/SettingsScreen";
import ContactsScreen from "../screens/ContactsScreen";
import LegalSupportScreen from "../screens/LegalSupportScreen";
import SafeSpacesScreen from '../screens/SafeSpacesScreen';
import SOSScreen from "../screens/SOSScreen";
import EditProfile from "../screens/EditProfile";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import OtpVerificationScreen from "../screens/OtpVerificationScreen";
import ChatsScreen from "../screens/ChatsScreen";
import ChatScreen from "../screens/ChatScreen";
import SafetyTipsScreen from "../screens/SafetyTipsScreen";
export type RootStackParamList = {
  Dashboard: undefined;
  SettingsScreen: undefined;
  ContactsScreen: undefined;
  LegalSupportScreen: undefined;
   SafeSpacesScreen: undefined;
   SOSScreen: undefined;
    Login: undefined;
    EditProfile: undefined;
    Signup: undefined;
      OtpVerificationScreen: {
    pendingId: string | null; // OTP pending ID from backend
    email: string;
    phone: string;
  };
  ChatsScreen: undefined;
ChatScreen: {
  contactId: string;
  contactName: string;
  currentUserId?: string; 
  chatId?: string | null;
};

  SafetyTipsScreen: undefined;
  // Location: undefined;
  // SOS: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function AppNavigator() {
  return (
    <SafeAreaProvider>
    <Stack.Navigator
      initialRouteName="Dashboard"
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
    
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
       <Stack.Screen name="OtpVerificationScreen" component={OtpVerificationScreen} />
      <Stack.Screen name="ContactsScreen" component={ContactsScreen} />
      <Stack.Screen name="LegalSupportScreen" component={LegalSupportScreen} />
     <Stack.Screen name="SafeSpacesScreen" component={SafeSpacesScreen} />
<Stack.Screen name="SOSScreen" component={SOSScreen} />
<Stack.Screen name="EditProfile" component={EditProfile} />
      <Stack.Screen name="ChatsScreen" component={ChatsScreen} />
      <Stack.Screen name="ChatScreen" component={ChatScreen} />
      <Stack.Screen name="SafetyTipsScreen" component={SafetyTipsScreen} />
    </Stack.Navigator>
    </SafeAreaProvider>
  );
}
