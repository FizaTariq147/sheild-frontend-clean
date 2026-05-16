// hooks/useCallSocket.ts
import { useEffect, useRef, useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import io, { Socket } from "socket.io-client";
import AsyncStorage from "@react-native-async-storage/async-storage";

const SOCKET_URL = "http://192.168.10.4:5050";
type NavProp = StackNavigationProp<RootStackParamList>;

let globalSocket: Socket | null = null;

export const getCallSocket = () => globalSocket;

export const useCallSocket = () => {
  const navigation = useNavigation<NavProp>();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const setup = async () => {
      const userRaw = await AsyncStorage.getItem("user");
      const user = userRaw ? JSON.parse(userRaw) : null;
      if (!user?.id) return;

      if (!globalSocket) {
        globalSocket = io(SOCKET_URL, {
          transports: ["websocket", "polling"],
          reconnection: true,
        });
      }

      socketRef.current = globalSocket;

      globalSocket.emit("join", user.id);

      // ── Listen for incoming calls ──────────────────────────
      globalSocket.off("call:incoming"); // prevent duplicate listeners
      globalSocket.on("call:incoming", ({ callerId, callerName, callType }) => {
        // Navigate to incoming call screen
        navigation.navigate("InAppCallScreen", {
          serviceName: callerName,
          phoneNumber: callerId,
          mode: "incoming",
          callerId,
          callType: callType ?? "audio",
        });
      });

      globalSocket.on("call:failed", ({ reason }) => {
        console.log("Call failed:", reason);
      });
    };

    setup();

    return () => {
      socketRef.current?.off("call:incoming");
      socketRef.current?.off("call:failed");
    };
  }, []);

  // Initiate a call to another user
  const initiateCall = useCallback(
    async (receiverId: string, receiverName: string, callType: "audio" | "video" = "audio") => {
      const userRaw = await AsyncStorage.getItem("user");
      const user = userRaw ? JSON.parse(userRaw) : null;
      if (!user?.id || !globalSocket) return;

      globalSocket.emit("call:initiate", {
        callerId: user.id,
        callerName: user.name || user.full_name || "Unknown",
        receiverId,
        callType,
      });

      navigation.navigate("InAppCallScreen", {
        serviceName: receiverName,
        phoneNumber: receiverId,
        mode: "outgoing",
        callerId: user.id,
        receiverId,
        callType,
      });
    },
    []
  );

  return { initiateCall };
};