import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
} from "react-native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RouteProp } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import io from "socket.io-client";
import { Ionicons } from "@expo/vector-icons";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeAlert } from "../components/ThemeAlert"; // ADDED

type ChatScreenNavProp = StackNavigationProp<RootStackParamList, "ChatScreen">;
type ChatScreenRouteProp = RouteProp<RootStackParamList, "ChatScreen">;

type Props = { navigation: ChatScreenNavProp; route: ChatScreenRouteProp };

type Message = {
  id: string;
  senderId: string;
  receiverId: string;
  text: string;
  timestamp: string;
  status?: 'sending' | 'sent' | 'delivered' | 'read';
};

const API_BASE_URL = "http://192.168.100.12:5050";
const SOCKET_URL = API_BASE_URL;

const ChatScreen: React.FC<Props> = ({ navigation, route }) => {
  const { contactId, contactName } = route.params;
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  // ADDED: Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

  const socketRef = useRef<any>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ADDED: Show alert function
  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    type: 'info' | 'error' | 'warning' | 'success' = 'info'
  ) => {
    setAlertConfig({
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK' }],
    });
    setAlertVisible(true);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  // Handle keyboard events
  useEffect(() => {
    const keyboardWillShow = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
        scrollToBottom();
      }
    );

    const keyboardWillHide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );

    return () => {
      keyboardWillShow.remove();
      keyboardWillHide.remove();
    };
  }, []);

  // Load token + user details
  useEffect(() => {
    const loadUser = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        const userRaw = await AsyncStorage.getItem("user");
        const user = userRaw ? JSON.parse(userRaw) : null;

        if (!accessToken || !user?.id) {
          // CHANGED: Alert.alert to showAlert
          showAlert("Error", "User not authenticated", [{ text: "OK" }], "error");
          setLoading(false);
          return;
        }

        setToken(accessToken);
        setCurrentUserId(user.id);
      } catch (err) {
        console.error("Token load error:", err);
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  // Fetch messages
  useEffect(() => {
    if (!token || !currentUserId) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/chat/${contactId}/messages`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!res.ok) {
          const errorText = await res.text();
          console.error("Fetch messages error:", errorText);
          throw new Error("Failed to load messages");
        }

        const msgs = await res.json();
        setMessages(Array.isArray(msgs) ? msgs : []);
        scrollToBottom();
      } catch (err) {
        console.error("Fetch messages error:", err);
        // CHANGED: Alert.alert to showAlert
        showAlert("Error", "Failed to load messages", [{ text: "OK" }], "error");
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [token, currentUserId, contactId]);

  // SOCKET SETUP
  useEffect(() => {
    if (!currentUserId) return;

    socketRef.current = io(SOCKET_URL, {
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected");
      socketRef.current.emit("join", currentUserId);
    });

    socketRef.current.on("new_message", (msg: Message) => {
      if (
        (msg.senderId === contactId && msg.receiverId === currentUserId) ||
        (msg.senderId === currentUserId && msg.receiverId === contactId)
      ) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id);
          if (exists) return prev;
          return [...prev, msg];
        });
        scrollToBottom();
      }
    });

    socketRef.current.on("user_typing", (data: { userId: string; isTyping: boolean }) => {
      if (data.userId === contactId) {
        setIsTyping(data.isTyping);
      }
    });

    socketRef.current.on("user_online", (data: { userId: string; online: boolean }) => {
      if (data.userId === contactId) {
        setIsOnline(data.online);
      }
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [currentUserId, contactId]);

  // Handle typing indicator
  const handleTyping = (text: string) => {
    setNewMessage(text);
    
    if (socketRef.current && text.trim()) {
      socketRef.current.emit("typing", {
        userId: currentUserId,
        receiverId: contactId,
        isTyping: true,
      });

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socketRef.current.emit("typing", {
          userId: currentUserId,
          receiverId: contactId,
          isTyping: false,
        });
      }, 1000);
    }
  };

  // SEND MESSAGE
  const handleSendMessage = async () => {
    const trimmedMessage = newMessage.trim();
    if (!trimmedMessage) return;

    setSending(true);
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      senderId: currentUserId!,
      receiverId: contactId,
      text: trimmedMessage,
      timestamp: new Date().toISOString(),
      status: 'sending',
    };

    setMessages((prev) => [...prev, tempMessage]);
    setNewMessage("");
    scrollToBottom();

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/${contactId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: trimmedMessage }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("Send message error:", errorText);
        throw new Error("Failed to send message");
      }

      const json = await res.json();

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempMessage.id
            ? {
                id: json._id,
                senderId: json.senderId,
                receiverId: json.receiverId,
                text: json.text,
                timestamp: json.timestamp,
                status: 'sent',
              }
            : msg
        )
      );

      if (socketRef.current) {
        socketRef.current.emit("send_message", {
          senderId: currentUserId,
          receiverId: contactId,
          text: trimmedMessage,
          timestamp: json.timestamp,
        });
      }
    } catch (err) {
      console.error("Send msg error:", err);
      setMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id));
      setNewMessage(trimmedMessage);
      // CHANGED: Alert.alert to showAlert
      showAlert("Error", "Message sending failed. Please try again.", [{ text: "OK" }], "error");
    } finally {
      setSending(false);
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString([], { month: "short", day: "numeric" });
    }
  };

  const renderDateSeparator = (currentMsg: Message, prevMsg: Message | null) => {
    if (!prevMsg) return null;

    const currentDate = new Date(currentMsg.timestamp).toDateString();
    const prevDate = new Date(prevMsg.timestamp).toDateString();

    if (currentDate !== prevDate) {
      return (
        <View style={styles.dateSeparator}>
          <View style={styles.dateLine} />
          <Text style={styles.dateText}>{currentDate}</Text>
          <View style={styles.dateLine} />
        </View>
      );
    }
    return null;
  };

  const renderItem = ({ item, index }: { item: Message; index: number }) => {
    const isSender = item.senderId === currentUserId;
    const prevMsg = index > 0 ? messages[index - 1] : null;
    const nextMsg = index < messages.length - 1 ? messages[index + 1] : null;
    
    const isFirstInGroup = !prevMsg || prevMsg.senderId !== item.senderId;
    const isLastInGroup = !nextMsg || nextMsg.senderId !== item.senderId;

    return (
      <>
        {renderDateSeparator(item, prevMsg)}
        <View
          style={[
            styles.messageContainer,
            isSender ? styles.senderContainer : styles.receiverContainer,
          ]}
        >
          <View
            style={[
              styles.messageBubble,
              isSender ? styles.sender : styles.receiver,
              isFirstInGroup && (isSender ? styles.senderFirstInGroup : styles.receiverFirstInGroup),
              isLastInGroup && (isSender ? styles.senderLastInGroup : styles.receiverLastInGroup),
            ]}
          >
            <Text style={[styles.messageText, { color: isSender ? "#fff" : "#1a1a1a" }]}>
              {item.text}
            </Text>
            <View style={styles.messageFooter}>
              <Text style={[styles.timestamp, { color: isSender ? "#ffd4e8" : "#666" }]}>
                {formatTime(item.timestamp)}
              </Text>
              {isSender && (
                <Ionicons
                  name={
                    item.status === 'read'
                      ? 'checkmark-done'
                      : item.status === 'delivered'
                      ? 'checkmark-done'
                      : 'checkmark'
                  }
                  size={14}
                  color={item.status === 'read' ? '#4FC3F7' : '#ffd4e8'}
                  style={styles.statusIcon}
                />
              )}
            </View>
          </View>
        </View>
      </>
    );
  };

  return (
    <>
      <View style={styles.container}>
        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
        >
          {/* Modern Header */}
          <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
            <View style={styles.headerLeft}>
              <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={24} color="#fff" />
              </TouchableOpacity>
              
              <View style={styles.contactInfo}>
                <View style={styles.avatarContainer}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {contactName.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  {isOnline && <View style={styles.onlineIndicator} />}
                </View>
                
                <View style={styles.contactDetails}>
                  <Text style={styles.contactName}>{contactName}</Text>
                  <Text style={styles.statusText}>
                    {isTyping ? "typing..." : isOnline ? "online" : "offline"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name="videocam-outline" size={24} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
                <Ionicons name="call-outline" size={22} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages List */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e9237f" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={[
                styles.messageList,
                { 
                  paddingBottom: keyboardHeight > 0 
                    ? keyboardHeight + 100  // When keyboard is open
                    : 100  // When keyboard is closed
                }
              ]}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="chatbubbles-outline" size={64} color="#e9237f40" />
                  </View>
                  <Text style={styles.emptyTitle}>No messages yet</Text>
                  <Text style={styles.emptyText}>
                    Start the conversation with {contactName}
                  </Text>
                </View>
              }
              onContentSizeChange={scrollToBottom}
              showsVerticalScrollIndicator={false}
              onLayout={scrollToBottom}
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
            />
          )}

          {/* Modern Input Container */}
          <View
            style={[
              styles.inputContainer,
              {
                bottom: keyboardHeight,
                paddingBottom:
                  Platform.OS === "ios"
                    ? insets.bottom > 0
                      ? insets.bottom
                      : 45
                    : 45,
              },
            ]}
          >
            <View style={styles.inputWrapper}>
              <TouchableOpacity style={styles.attachButton} activeOpacity={0.7}>
                <Ionicons name="add-circle" size={28} color="#e9237f" />
              </TouchableOpacity>

              <TextInput
                style={styles.input}
                placeholder="Message..."
                placeholderTextColor="#999"
                value={newMessage}
                onChangeText={handleTyping}
                multiline
                maxLength={500}
              />

              {newMessage.trim() ? (
                <TouchableOpacity
                  onPress={handleSendMessage}
                  disabled={sending}
                  style={[styles.sendButton, sending && styles.sendButtonDisabled]}
                  activeOpacity={0.8}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Ionicons name="send" size={20} color="#fff" />
                  )}
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.micButton} activeOpacity={0.7}>
                  <Ionicons name="mic" size={24} color="#e9237f" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>

      {/* ADDED: Theme Alert Component */}
      <ThemeAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        buttons={alertConfig.buttons}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
};

export default ChatScreen;

// KEPT ALL YOUR EXISTING STYLES EXACTLY THE SAME
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  keyboardAvoid: {
    flex: 1,
  },
  topBar: {
    backgroundColor: "#e9237f",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  contactInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  avatarContainer: {
    position: "relative",
    marginRight: 12,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#e9237f",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#4CAF50",
    borderWidth: 2,
    borderColor: "#e9237f",
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  statusText: {
    color: "#ffd4e8",
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
  messageList: {
    padding: 16,
    flexGrow: 1,
    paddingTop: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
  },
  emptyIconContainer: {
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  emptyText: {
    color: "#999",
    fontSize: 15,
    textAlign: "center",
  },
  dateSeparator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 16,
  },
  dateLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dateText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#999",
    fontWeight: "500",
  },
  messageContainer: {
    marginVertical: 2,
  },
  senderContainer: {
    alignItems: "flex-end",
  },
  receiverContainer: {
    alignItems: "flex-start",
  },
  messageBubble: {
    padding: 12,
    paddingHorizontal: 14,
    borderRadius: 18,
    maxWidth: "75%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sender: {
    backgroundColor: "#e9237f",
  },
  receiver: {
    backgroundColor: "#f5f5f5",
  },
  senderFirstInGroup: {
    borderTopRightRadius: 18,
  },
  senderLastInGroup: {
    borderBottomRightRadius: 4,
  },
  receiverFirstInGroup: {
    borderTopLeftRadius: 18,
  },
  receiverLastInGroup: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  messageFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    gap: 4,
  },
  timestamp: {
    fontSize: 11,
  },
  statusIcon: {
    marginLeft: 2,
  },
  inputContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: "#f5f5f5",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  attachButton: {
    padding: 6,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxHeight: 100,
    color: "#1a1a1a",
  },
  sendButton: {
    backgroundColor: "#e9237f",
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
  },
  sendButtonDisabled: {
    opacity: 0.6,
  },
  micButton: {
    padding: 6,
    marginLeft: 4,
  },
});