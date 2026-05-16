import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import SplashScreen from "../screens/SplashScreen";
import LoginScreen from "../screens/LoginScreen";
import SignupScreen from "../screens/SignupScreen";
import OtpVerificationScreen from "../screens/OtpVerificationScreen";
import DashboardScreen  from "../screens/Dashboard"
import SScreen from "../screens/SScreen";
import HScreen from "../screens/HScreen";
import EScreen from "../screens/EScreen";
import IScreen from "../screens/IScreen";
import LocationScreen from "../screens/LocationScreen";
import DScreen from "../screens/DScreen";
import ContactsScreen from '../screens/ContactsScreen';
import SettingsScreen from "../screens/SettingsScreen";
import LegalSupportScreen from "../screens/LegalSupportScreen";
import SafeSpacesScreen from '../screens/SafeSpacesScreen';
import EditProfile from "../screens/EditProfile";
import SOSScreen from "../screens/SOSScreen";
import ChatsScreen from "../screens/ChatsScreen";
import ChatScreen from "../screens/ChatScreen";
import SafetyTipsScreen from "../screens/SafetyTipsScreen";
import ChatConsultationScreen from "../screens/ChatConsultationScreen";
import InAppCallScreen from "../screens/InAppCallScreen";
export type RootStackParamList = {
  Splash: undefined;
  Login: undefined;
  Signup: undefined;
  S: undefined;
  H: undefined;
  E: undefined;
  I: undefined;
  Location: undefined;
  D: undefined;
   OtpVerificationScreen: {
    pendingId: string | null; // OTP pending ID from backend
    email: string;
    phone: string;
  };
   ForgotPassword: undefined; // Example if you have a forgot password screen
  ResetPassword: { token: string }; // Example if you pass a token
 Dashboard: undefined;
 ContactsScreen: undefined;
   SettingsScreen: undefined;
     LegalSupportScreen: undefined;
        SafeSpacesScreen: undefined;
           SOSScreen: undefined;

            EditProfile: undefined;
             ChatsScreen: undefined;
  ChatScreen: { contactId: string;
  contactName: string;
  currentUserId: string;
 chatId?: string; 
 };
  SafetyTipsScreen: undefined;
  ChatConsultationScreen: { consultationId: string };
InAppCallScreen: {
  serviceName: string;
  phoneNumber: string;
  mode?: "outgoing" | "incoming";
  callerId?: string;
  receiverId?: string;
  callType?: "audio" | "video";
};
};

type AuthNavigatorProps = {
  onLogin: (token: string) => void;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
export default function AuthNavigator({ onLogin }: AuthNavigatorProps) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="OtpVerificationScreen" component={OtpVerificationScreen} />
        <Stack.Screen name="S" component={SScreen} />
      <Stack.Screen name="H" component={HScreen} />
      <Stack.Screen name="E" component={EScreen} />
      <Stack.Screen name="I" component={IScreen} />
      <Stack.Screen name="Location" component={LocationScreen} />
      <Stack.Screen name="D" component={DScreen} />
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="ContactsScreen" component={ContactsScreen} />
       <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
          <Stack.Screen name="LegalSupportScreen" component={LegalSupportScreen} />
           <Stack.Screen name="SafeSpacesScreen" component={SafeSpacesScreen} />
           <Stack.Screen name="SOSScreen" component={SOSScreen} />
           <Stack.Screen name="EditProfile" component={EditProfile} />
                 <Stack.Screen name="ChatsScreen" component={ChatsScreen} />
                 <Stack.Screen name="ChatScreen" component={ChatScreen} />
                  <Stack.Screen name="SafetyTipsScreen" component={SafetyTipsScreen} />
                    <Stack.Screen name="ChatConsultationScreen" component={ChatConsultationScreen} />
                    <Stack.Screen
  name="InAppCallScreen"
  component={InAppCallScreen}
  options={{ headerShown: false, presentation: "fullScreenModal" }}
/>
    </Stack.Navigator>
  );
}