// src/screens/ChatsScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import getAuthHeaders from "../helpers/authHeaders";
import Navbar from "../components/ChatTopBar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { StackNavigationProp } from "@react-navigation/stack";
import { useFocusEffect } from "@react-navigation/native";
import { RootStackParamList } from "../navigation/AppNavigator";
import { ThemeAlert } from "../components/ThemeAlert"; // ADDED

const API_BASE_URL = "http://192.168.100.12:5050"; // backend base

type ChatsScreenNavProp = StackNavigationProp<RootStackParamList, "ChatsScreen">;
type Props = { navigation: ChatsScreenNavProp };

type Contact = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  initials: string;
};

// ADDED: Alert state
type AlertState = {
  visible: boolean;
  title: string;
  message: string;
  type: 'info' | 'error' | 'warning' | 'success';
  buttons: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>;
};

// Map backend response → UI-safe Contact
const mapBackendToUI = (c: any): Contact => {
  const name = c.full_name ?? c.name ?? c.fullName ?? "";
  const initials = (name || "")
    .split(" ")
    .map((w: string) => (w ? w[0] : ""))
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // backend might use id or _id
  const id = c.id ?? c._id ?? String(Math.random()).slice(2);

  return {
    id,
    name,
    phone: c.phone ?? "",
    relation: c.relation ?? null,
    initials: initials || "??",
  };
};

const ChatsScreen: React.FC<Props> = ({ navigation }) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [relation, setRelation] = useState("");
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ADDED: Alert state
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: '',
    message: '',
    type: 'info',
    buttons: [{ text: 'OK' }],
  });

  // ADDED: Show alert function
  const showAlert = (
    title: string,
    message: string,
    buttons?: Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
    type: 'info' | 'error' | 'warning' | 'success' = 'info'
  ) => {
    setAlertState({
      visible: true,
      title,
      message,
      type,
      buttons: buttons || [{ text: 'OK' }],
    });
  };

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        // CHANGED: Alert.alert to showAlert
        showAlert("Error", "Auth headers missing", [{ text: "OK" }], "error");
        setLoading(false);
        return;
      }
      
      const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: "GET",
        headers,
      });

      const text = await res.text();
      let data: any = [];
      try {
        data = JSON.parse(text);
      } catch {
        // in case server returns { contacts: [...] } or direct array
        console.warn("Contacts response not pure JSON array:", text);
      }

      // support common shapes
      const listRaw = Array.isArray(data) ? data : data?.contacts ?? data?.data ?? [];
      const list = Array.isArray(listRaw) ? listRaw.map(mapBackendToUI) : [];
      setContacts(list);
    } catch (err: any) {
      console.error("fetchContacts error:", err);
      // CHANGED: Alert.alert to showAlert
      showAlert("Error", err?.message ?? "Failed to load contacts", [{ text: "OK" }], "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // refresh when screen focused
  useFocusEffect(
    useCallback(() => {
      fetchContacts();
    }, [fetchContacts])
  );

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
  };

  const handleAddContact = async () => {
    if (!fullName.trim() || !phone.trim()) {
      // CHANGED: Alert.alert to showAlert
      showAlert("Validation", "Please provide name and phone", [{ text: "OK" }], "warning");
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      if (!headers) {
        // CHANGED: Alert.alert to showAlert
        showAlert("Error", "Auth headers missing", [{ text: "OK" }], "error");
        setSaving(false);
        return;
      }

      const body = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        relation: relation?.trim() || null,
      };

      const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });

      const text = await res.text();
      let resp: any = {};
      try {
        resp = JSON.parse(text);
      } catch {
        resp = {};
      }

      if (!res.ok) {
        throw new Error(resp?.error || resp?.message || "Failed to save contact");
      }

      const createdRaw = resp.contact ?? resp;
      const created = mapBackendToUI(createdRaw);
      setContacts((prev) => [created, ...prev]);
      setFullName("");
      setPhone("");
      setRelation("");
      setShowForm(false);
      Keyboard.dismiss();
      // CHANGED: Alert.alert to showAlert
      showAlert("Success", "Contact added successfully", [{ text: "OK" }], "success");
    } catch (err: any) {
      console.error("Add contact error:", err);
      // CHANGED: Alert.alert to showAlert
      showAlert("Error", err?.message || "Failed to add contact", [{ text: "OK" }], "error");
    } finally {
      setSaving(false);
    }
  };

  const openChat = async (item: Contact) => {
    try {
      const userStr = await AsyncStorage.getItem("user");
      if (!userStr) {
        // CHANGED: Alert.alert to showAlert
        showAlert("Error", "User not found. Please login again.", [{ text: "OK" }], "error");
        return;
      }
      const currentUser = JSON.parse(userStr);

      // navigate and let ChatScreen create chatId if needed
      navigation.navigate("ChatScreen", {
        contactId: item.id,
        contactName: item.name,
        currentUserId: currentUser.id,
        chatId: null,
      });
    } catch (err) {
      console.error("Navigation error:", err);
      // CHANGED: Alert.alert to showAlert
      showAlert("Error", "Failed to navigate to chat.", [{ text: "OK" }], "error");
    }
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity 
      style={styles.contactRow} 
      onPress={() => openChat(item)}
      activeOpacity={0.7}
    >
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.initials}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.name}>{item.name}</Text>
        <Text style={styles.phone}>{item.phone}</Text>
      </View>
      <Ionicons name="chatbox" size={22} color="#e9237f" />
    </TouchableOpacity>
  );

  return (
    <>
      <View style={styles.container}>
        <Navbar
          title="Chats"
          onBack={() => navigation.goBack()}
          logoSource={require("../assets/logo.png")}
        />

        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Ionicons name="chatbubbles-outline" size={24} color="#e9237f" />
            <View>
              <Text style={styles.headerTitle}>Start Chatting</Text>
              <Text style={styles.headerSubtitle}>
                Connect with your trusted contacts
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            onPress={() => {
              if (showForm) {
                setFullName("");
                setPhone("");
                setRelation("");
              }
              setShowForm((prev) => !prev);
            }}
            activeOpacity={0.8}
          >
            <Ionicons name={showForm ? "close" : "add"} size={22} color="#fff" />
            <Text style={styles.addButtonText}>
              {showForm ? "Cancel" : "Add"}
            </Text>
          </TouchableOpacity>
        </View>

        {showForm && (
          <View style={styles.formContainer}>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              placeholderTextColor="#999"
              value={fullName}
              onChangeText={setFullName}
            />
            <TextInput
              style={styles.input}
              placeholder="Phone Number"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
            <TextInput
              style={styles.input}
              placeholder="Relation (Optional)"
              placeholderTextColor="#999"
              value={relation}
              onChangeText={setRelation}
            />

            <TouchableOpacity
              style={[
                styles.saveButton,
                { alignSelf: "flex-end", marginRight: 16, opacity: saving ? 0.8 : 1 },
              ]}
              onPress={handleAddContact}
              disabled={saving}
              activeOpacity={0.8}
            >
              {saving ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveText}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {loading && contacts.length === 0 ? (
          <View style={{ marginTop: 24 }}>
            <ActivityIndicator color="#e9237f" />
          </View>
        ) : (
          <FlatList
            data={contacts}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 10 }}
            ListEmptyComponent={
              <View style={{ paddingTop: 50, alignItems: "center" }}>
                <Text style={{ color: "#999" }}>No contacts found.</Text>
              </View>
            }
            refreshControl={
              <RefreshControl 
                refreshing={refreshing} 
                onRefresh={onRefresh}
                colors={["#e9237f"]}
                tintColor="#e9237f"
              />
            }
          />
        )}
      </View>

      {/* ADDED: Theme Alert Component */}
      <ThemeAlert
        visible={alertState.visible}
        title={alertState.title}
        message={alertState.message}
        type={alertState.type}
        buttons={alertState.buttons}
        onClose={() => setAlertState(prev => ({ ...prev, visible: false }))}
      />
    </>
  );
};

export default ChatsScreen;

// KEPT ALL YOUR EXISTING STYLES EXACTLY THE SAME
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
    padding: 12,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
  },
  headerSubtitle: {
    fontSize: 12,
    color: "#6b7280",
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e9237f",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
    shadowColor: "#f08fb1",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  formContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 14,
    color: "#111827",
  },
  saveButton: {
    backgroundColor: "#e9237f",
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  saveText: {
    color: "#fff",
    fontWeight: "500",
  },
  contactRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#fff",
    borderBottomColor: "#e5e7eb",
    borderBottomWidth: 1,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff7a2f",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  name: { fontSize: 16, fontWeight: "600", color: "#111" },
  phone: { fontSize: 13, color: "#555", marginTop: 2 },
});