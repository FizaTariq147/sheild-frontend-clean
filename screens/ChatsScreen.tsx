// src/screens/ChatsScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Keyboard,
  RefreshControl,
  Animated,
  StatusBar,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import getAuthHeaders from "../helpers/authHeaders";
import Navbar from "../components/ChatTopBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { ThemeAlert } from "../components/ThemeAlert";
import { useNotifications } from "../hooks/useNotifications";

const API_BASE_URL = "https://fiza-tariq-shield-backend.hf.space";

type ChatsScreenNavProp = StackNavigationProp<RootStackParamList, "ChatsScreen">;
type Props = { navigation: ChatsScreenNavProp };

type Contact = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  initials: string;
  avatarColor: string;
  lastMessage?: string;
  lastTime?: string;
  unreadCount?: number;
  isOnline?: boolean;
};

type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  type: "info" | "error" | "warning" | "success";
  buttons: Array<{
    text: string;
    onPress?: () => void;
    style?: "default" | "cancel" | "destructive";
  }>;
};

// ─── Avatar color — single brand accent kept from original ─────────────────
const AVATAR_COLORS = [
  "#FF9800", "#FF9800", "#FF9800", "#FF9800",
  "#FF9800", "#FF9800", "#FF9800", "#FF9800",
];
const getAvatarColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const mapBackendToUI = (c: any): Contact => {
  const name = c.full_name ?? c.name ?? c.fullName ?? "";
  const initials = name
    .split(" ")
    .map((w: string) => (w ? w[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const id = c.id ?? c._id ?? String(Math.random()).slice(2);
  return {
    id,
    name,
    phone: c.phone ?? "",
    relation: c.relation ?? null,
    initials: initials || "??",
    avatarColor: getAvatarColor(name),
    lastMessage: c.lastMessage ?? null,
    lastTime: c.lastTime ?? null,
    unreadCount: c.unreadCount ?? 0,
    isOnline: c.isOnline ?? false,
  };
};

const formatTime = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return d.toLocaleDateString([], { weekday: "short" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit" });
};

// ─── Swipe-to-reveal delete row ────────────────────────────────────────────
const SwipeableContactRow: React.FC<{
  item: Contact;
  onPress: () => void;
  onDelete: () => void;
}> = ({ item, onPress, onDelete }) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const deleteOpacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;
  const [swiped, setSwiped] = useState(false);

  const handleLongPress = () => {
    Animated.parallel([
      Animated.spring(translateX, { toValue: -72, useNativeDriver: true, tension: 80, friction: 10 }),
      Animated.timing(deleteOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
    ]).start();
    setSwiped(true);
  };

  const handlePress = () => {
    if (swiped) {
      Animated.parallel([
        Animated.spring(translateX, { toValue: 0, useNativeDriver: true }),
        Animated.timing(deleteOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]).start();
      setSwiped(false);
    } else {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.97, duration: 80, useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 80, useNativeDriver: true }),
      ]).start();
      onPress();
    }
  };

  return (
    <View style={styles.swipeWrapper}>
      {/* Delete action behind the row */}
      <Animated.View style={[styles.deleteAction, { opacity: deleteOpacity }]}>
        <TouchableOpacity onPress={onDelete} style={styles.deleteActionBtn}>
          <Ionicons name="trash-outline" size={22} color="#fff" />
          <Text style={styles.deleteActionText}>Delete</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={{ transform: [{ translateX }, { scale }] }}>
        <TouchableOpacity
          activeOpacity={0.75}
          onPress={handlePress}
          onLongPress={handleLongPress}
          style={styles.contactRow}
        >
          {/* Avatar */}
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatar, { backgroundColor: item.avatarColor }]}>
              <Text style={styles.avatarText}>{item.initials}</Text>
            </View>
            {item.isOnline && <View style={styles.onlineDot} />}
          </View>

          {/* Content */}
          <View style={styles.contactInfo}>
            <View style={styles.contactTopRow}>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              <Text style={[styles.timeText, item.unreadCount ? styles.timeUnread : null]}>
                {formatTime(item.lastTime)}
              </Text>
            </View>
            <View style={styles.contactBottomRow}>
              <Text
                style={[styles.lastMessage, item.unreadCount ? styles.lastMessageUnread : null]}
                numberOfLines={1}
              >
                {item.lastMessage ?? "Tap to start chatting"}
              </Text>
              {item.unreadCount ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>
                    {item.unreadCount > 99 ? "99+" : item.unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

// ─── Main screen ────────────────────────────────────────────────────────────
const ChatsScreen: React.FC<Props> = ({ navigation }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filtered, setFiltered] = useState<Contact[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fabScale = useRef(new Animated.Value(1)).current;
  const fabRotate = useRef(new Animated.Value(0)).current;
  const formAnim = useRef(new Animated.Value(0)).current;

  useNotifications();

  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: "",
    message: "",
    type: "info",
    buttons: [{ text: "OK" }],
  });

  const showAlert = (
    title: string,
    message: string,
    buttons?: AlertState["buttons"],
    type: AlertState["type"] = "info"
  ) => {
    setAlertState({ visible: true, title, message, type, buttons: buttons || [{ text: "OK" }] });
  };

  // Search filter
  useEffect(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setFiltered(contacts);
    } else {
      setFiltered(
        contacts.filter(
          (c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)
        )
      );
    }
  }, [searchQuery, contacts]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        showAlert("Error", "Auth headers missing", [{ text: "OK" }], "error");
        return;
      }
      const res = await fetch(`${API_BASE_URL}/api/contacts`, { method: "GET", headers });
      const text = await res.text();
      let data: any = [];
      try { data = JSON.parse(text); } catch { console.warn("Response parse failed:", text); }
      const listRaw = Array.isArray(data) ? data : data?.contacts ?? data?.data ?? [];
      setContacts(Array.isArray(listRaw) ? listRaw.map(mapBackendToUI) : []);
    } catch (err: any) {
      showAlert("Error", err?.message ?? "Failed to load contacts", [{ text: "OK" }], "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { fetchContacts(); }, [fetchContacts]));
  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const onRefresh = () => { setRefreshing(true); fetchContacts(); };

  const handleAddContact = async () => {
    if (!fullName.trim() || !phone.trim()) {
      showAlert("Validation", "Please provide name and phone", [{ text: "OK" }], "warning");
      return;
    }
    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) { showAlert("Error", "Auth headers missing", [{ text: "OK" }], "error"); return; }
      const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify({ full_name: fullName.trim(), phone: phone.trim(), relation: relation?.trim() || null }),
      });
      const text = await res.text();
      let resp: any = {};
      try { resp = JSON.parse(text); } catch { resp = {}; }
      if (!res.ok) throw new Error(resp?.error || resp?.message || "Failed to save contact");
      const created = mapBackendToUI(resp.contact ?? resp);
      setContacts((prev) => [created, ...prev]);
      setFullName(""); setPhone(""); setRelation("");
      toggleForm(false);
      Keyboard.dismiss();
      showAlert("Success", "Contact added successfully", [{ text: "OK" }], "success");
    } catch (err: any) {
      showAlert("Error", err?.message || "Failed to add contact", [{ text: "OK" }], "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteContact = (item: Contact) => {
    showAlert(
      "Delete Contact",
      `Remove ${item.name} from your contacts?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              if (!headers) return;
              await fetch(`${API_BASE_URL}/api/contacts/${item.id}`, { method: "DELETE", headers });
              setContacts((prev) => prev.filter((c) => c.id !== item.id));
            } catch {
              showAlert("Error", "Failed to delete contact", [{ text: "OK" }], "error");
            }
          },
        },
      ],
      "warning"
    );
  };

  const openChat = async (item: Contact) => {
    try {
      const userStr = await AsyncStorage.getItem("user");
      if (!userStr) { showAlert("Error", "Please login again.", [{ text: "OK" }], "error"); return; }
      const currentUser = JSON.parse(userStr);
      navigation.navigate("ChatScreen", {
        contactId: item.id,
        contactName: item.name,
        currentUserId: currentUser.id,
        contactPhone: item.phone,
        chatId: null,
      });
    } catch {
      showAlert("Error", "Failed to navigate to chat.", [{ text: "OK" }], "error");
    }
  };

  const toggleForm = (open?: boolean) => {
    const next = open !== undefined ? open : !showForm;
    setShowForm(next);

    // FAB icon rotate
    Animated.parallel([
      Animated.spring(fabRotate, {
        toValue: next ? 1 : 0,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      }),
      Animated.timing(formAnim, {
        toValue: next ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();

    if (!next) {
      setFullName(""); setPhone(""); setRelation("");
      Keyboard.dismiss();
    }
  };

  const pulseFab = () => {
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.88, duration: 90, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true, tension: 200, friction: 6 }),
    ]).start();
  };

  const fabIconRotation = fabRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "45deg"],
  });

  const formTranslateY = formAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-16, 0],
  });

  const renderItem = ({ item }: { item: Contact }) => (
    <SwipeableContactRow
      item={item}
      onPress={() => openChat(item)}
      onDelete={() => handleDeleteContact(item)}
    />
  );

  const renderSectionHeader = () => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>
        {searchQuery ? `Results for "${searchQuery}"` : "Recent Chats"}
      </Text>
      <Text style={styles.sectionCount}>{filtered.length}</Text>
    </View>
  );

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#fff" />
      <View style={styles.container}>

        {/* ── Top bar from existing Navbar component ── */}
        <Navbar
          title="Chats"
          onBack={() => navigation.goBack()}
          logoSource={require("../assets/logo.png")}
        />

        {/* ── Gradient-bordered search bar ── */}
        <View style={styles.searchContainer}>
          <LinearGradient
            colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchGradientBorder}
          >
            <View style={styles.searchBox}>
              <Ionicons name="search" size={16} color="#aaa" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search contacts..."
                placeholderTextColor="#bbb"
                value={searchQuery}
                onChangeText={setSearchQuery}
                clearButtonMode="while-editing"
                returnKeyType="search"
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={17} color="#ccc" />
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* ── Add Contact Form (animated) ── */}
        {showForm && (
          <Animated.View
            style={[
              styles.formCard,
              {
                opacity: formAnim,
                transform: [{ translateY: formTranslateY }],
              },
            ]}
          >
            <Text style={styles.formTitle}>New Contact</Text>

            <View style={styles.inputWrapper}>
              <Ionicons name="person-outline" size={16} color="#e9237f" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#bbb"
                value={fullName}
                onChangeText={setFullName}
                autoFocus
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="call-outline" size={16} color="#e9237f" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#bbb"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={setPhone}
              />
            </View>

            <View style={styles.inputWrapper}>
              <Ionicons name="people-outline" size={16} color="#e9237f" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Relation (optional)"
                placeholderTextColor="#bbb"
                value={relation}
                onChangeText={setRelation}
              />
            </View>

            <View style={styles.formActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => toggleForm(false)}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.saveBtn, saving && { opacity: 0.65 }]}
                onPress={handleAddContact}
                disabled={saving}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={["#e9237f", "#9d1af2"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveBtnGradient}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={styles.saveBtnText}>Save Contact</Text>}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ── Contact List ── */}
        {loading && contacts.length === 0 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#e9237f" size="large" />
            <Text style={styles.loadingText}>Loading conversations…</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            ListHeaderComponent={filtered.length > 0 ? renderSectionHeader : null}
            contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <LinearGradient
                  colors={["#fce4ef", "#f3e8ff"]}
                  style={styles.emptyIconCircle}
                >
                  <Ionicons name="chatbubbles-outline" size={48} color="#e9237f" />
                </LinearGradient>
                <Text style={styles.emptyTitle}>
                  {searchQuery ? "No results found" : "No conversations yet"}
                </Text>
                <Text style={styles.emptySubtitle}>
                  {searchQuery
                    ? `Try searching for a different name or number`
                    : "Tap the + button below to add your first contact and start chatting"}
                </Text>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={["#e9237f"]}
                tintColor="#e9237f"
                progressBackgroundColor="#fff"
              />
            }
          />
        )}

        {/* ── Floating Action Button ── */}
        <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            onPress={() => { pulseFab(); toggleForm(); }}
            activeOpacity={0.9}
            style={styles.fabInner}
          >
            <LinearGradient
              colors={["#e9237f", "#9d1af2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.fabGradient}
            >
              <Animated.View style={{ transform: [{ rotate: fabIconRotation }] }}>
                <Ionicons name="add" size={28} color="#fff" />
              </Animated.View>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

      </View>

      <ThemeAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={() => setAlertState((prev) => ({ ...prev, visible: false }))}
      />
    </>
  );
};

export default ChatsScreen;

// ─── Styles ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },

  // ── Search ──────────────────────────────────────────────────────────────
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  searchGradientBorder: {
    borderRadius: 28,
    padding: 1.5,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F8FA",
    borderRadius: 27,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 9 : 5,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#222",
    fontWeight: "400",
  },

  // ── Section header ───────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 6,
  },
  sectionHeaderText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#aaa",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  sectionCount: {
    fontSize: 11,
    color: "#ccc",
    fontWeight: "500",
  },

  // ── Add Contact Form ─────────────────────────────────────────────────────
  formCard: {
    backgroundColor: "#fff",
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f0f0f4",
    shadowColor: "#e9237f",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  formTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111",
    marginBottom: 14,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 10,
    backgroundColor: "#FAFAFA",
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 9,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#111",
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    justifyContent: "center",
  },
  cancelBtnText: {
    color: "#888",
    fontWeight: "500",
    fontSize: 13,
  },
  saveBtn: {
    borderRadius: 10,
    overflow: "hidden",
  },
  saveBtnGradient: {
    paddingVertical: 10,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  saveBtnText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 13,
  },

  // ── Contact row ──────────────────────────────────────────────────────────
  swipeWrapper: {
    position: "relative",
    overflow: "hidden",
  },
  deleteAction: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: 72,
    backgroundColor: "#ff3b30",
    justifyContent: "center",
    alignItems: "center",
  },
  deleteActionBtn: {
    alignItems: "center",
    gap: 3,
  },
  deleteActionText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "600",
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F0F0F4",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 13,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 17,
    letterSpacing: 0.3,
  },
  onlineDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 13,
    height: 13,
    backgroundColor: "#25d366",
    borderRadius: 7,
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  contactInfo: {
    flex: 1,
    minWidth: 0,
  },
  contactTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 3,
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f0f0f",
    flex: 1,
    marginRight: 8,
  },
  timeText: {
    fontSize: 11.5,
    color: "#b0b0b8",
    flexShrink: 0,
  },
  timeUnread: {
    color: "#e9237f",
    fontWeight: "600",
  },
  contactBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lastMessage: {
    fontSize: 13,
    color: "#9ca3af",
    flex: 1,
    marginRight: 8,
    fontWeight: "400",
  },
  lastMessageUnread: {
    color: "#4b4b4b",
    fontWeight: "500",
  },
  badge: {
    backgroundColor: "#e9237f",
    borderRadius: 12,
    minWidth: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 5,
  },
  badgeText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },

  // ── FAB ──────────────────────────────────────────────────────────────────
  fab: {
    position: "absolute",
    bottom: 28,
    right: 20,
    width: 58,
    height: 58,
    borderRadius: 29,
    shadowColor: "#e9237f",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 8,
  },
  fabInner: {
    flex: 1,
    borderRadius: 29,
    overflow: "hidden",
  },
  fabGradient: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 29,
  },

  // ── States ───────────────────────────────────────────────────────────────
  listContent: {
    paddingBottom: 100,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  loadingText: {
    color: "#b0b0b8",
    fontSize: 14,
    fontWeight: "400",
  },
  emptyContainer: {
    flex: 1,
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 10,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1a1a1a",
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 13.5,
    color: "#aaa",
    textAlign: "center",
    lineHeight: 20,
  },
});