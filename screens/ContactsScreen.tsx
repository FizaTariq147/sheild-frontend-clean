// src/screens/ContactsScreen.tsx (With Gradient Border Search Bar)
import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  Keyboard,
  RefreshControl,
  SafeAreaView,
  Modal,
  TouchableWithoutFeedback,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient'; 
import Navbar from "../components/ContactTopBar";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import getAuthHeaders from "../helpers/authHeaders";
import BottomNavBar from "../components/BottomNavBar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeAlert } from "../components/ThemeAlert";

type ContactsScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "ContactsScreen"
>;

type Props = {
  navigation: ContactsScreenNavProp;
};

type Contact = {
  id: string;
  name: string;
  phone: string;
  relation: string | null;
  initials: string;
};

const API_BASE_URL = "http://192.168.100.12:5050";

const ContactsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [filteredContacts, setFilteredContacts] = useState<Contact[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newRelation, setNewRelation] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const menuPosition = useRef({ x: 0, y: 0 }).current;

  // Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

  // Filter contacts when search query changes
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredContacts(contacts);
    } else {
      const filtered = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact.phone.includes(searchQuery)
      );
      setFilteredContacts(filtered);
    }
  }, [contacts, searchQuery]);

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

  useEffect(() => {
    fetchContacts();
  }, []);

  const mapBackendToUI = (c: any): Contact => {
    const name = c.full_name ?? c.name ?? "";
    const initials = name
      .split(" ")
      .map((w: string) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return {
      id: c.id,
      name,
      phone: c.phone ?? "",
      relation: c.relation ?? null,
      initials: initials || "??",
    };
  };

  const fetchContacts = async () => {
    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: "GET",
        headers,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const data = await res.json();
      const list = Array.isArray(data) ? data.map(mapBackendToUI) : [];
      setContacts(list);
      setFilteredContacts(list);
    } catch (err: any) {
      console.error("fetchContacts error:", err);
      showAlert("Error", err.message || "Failed to load contacts", [{ text: "OK" }], "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddContact = async () => {
    if (!newName || !newPhone) {
      showAlert("Validation", "Please provide name and phone", [{ text: "OK" }], "warning");
      return;
    }

    setSaving(true);
    try {
      const headers = await getAuthHeaders();
      const body = {
        full_name: newName,
        phone: newPhone,
        relation: newRelation || null,
      };

      if (editingId) {
        const res = await fetch(`${API_BASE_URL}/api/contacts/${editingId}`, {
          method: "PUT",
          headers,
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `HTTP ${res.status}`);
        }
        const resp = await res.json();
        const updated = mapBackendToUI(resp.contact ?? resp);
        setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setEditingId(null);
        setShowForm(false);
        setNewName("");
        setNewPhone("");
        setNewRelation("");
        Keyboard.dismiss();
        showAlert("Success", "Contact updated successfully", [{ text: "OK" }], "success");
        return;
      }

      const res = await fetch(`${API_BASE_URL}/api/contacts`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }
      const resp = await res.json();
      const created = mapBackendToUI(resp.contact ?? resp);
      setContacts((prev) => [created, ...prev]);
      setNewName("");
      setNewPhone("");
      setNewRelation("");
      setShowForm(false);
      Keyboard.dismiss();
      showAlert("Success", "Contact added successfully", [{ text: "OK" }], "success");
    } catch (err: any) {
      console.error("save contact error:", err);
      showAlert("Error", err.message || "Failed to save contact", [{ text: "OK" }], "error");
      if ((err.message || "").includes("duplicate")) {
        showAlert("Duplicate", "A contact with this phone already exists.", [{ text: "OK" }], "warning");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setMenuVisible(false);
    showAlert(
      "Confirm",
      "Delete this contact?",
      [
        {
          text: "Cancel",
          style: "cancel",
          onPress: () => {
            // Do nothing on cancel
          }
        },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const headers = await getAuthHeaders();
              const res = await fetch(`${API_BASE_URL}/api/contacts/${id}`, {
                method: "DELETE",
                headers,
              });
              if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || `HTTP ${res.status}`);
              }
              setContacts((prev) => prev.filter((c) => c.id !== id));
              showAlert("Success", "Contact deleted successfully", [{ text: "OK" }], "success");
            } catch (err: any) {
              console.error("delete contact error:", err);
              showAlert("Error", err.message || "Failed to delete contact", [{ text: "OK" }], "error");
            }
          },
        },
      ],
      "warning"
    );
  };

  const handleEdit = (item: Contact) => {
    setMenuVisible(false);
    setEditingId(item.id);
    setNewName(item.name);
    setNewPhone(item.phone);
    setNewRelation(item.relation ?? "");
    setShowForm(true);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchContacts();
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "#e9237f", // Your pink color
      "#4285F4", // Blue
      "#34A853", // Green
      "#FBBC05", // Yellow
      "#EA4335", // Red
      "#7B1FA2", // Purple
      "#00BCD4", // Cyan
      "#FF9800", // Orange
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const showMenu = (item: Contact, event: any) => {
    const { pageX, pageY } = event.nativeEvent;
    menuPosition.x = pageX - 100; // Adjust for menu width
    menuPosition.y = pageY - 40;  // Adjust for menu height
    setSelectedContact(item);
    setMenuVisible(true);
  };

  const renderItem = ({ item }: { item: Contact }) => (
    <TouchableOpacity
      style={styles.contactItem}
      activeOpacity={0.7}
      onLongPress={() => handleDelete(item.id)}
    >
      <View style={[styles.avatar, { backgroundColor: getAvatarColor(item.name) }]}>
        <Text style={styles.avatarText}>{item.initials}</Text>
      </View>

      <View style={styles.contactDetails}>
        <View style={styles.contactHeader}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>

        </View>
        <Text style={styles.contactPhone} numberOfLines={1}>{item.phone}</Text>
        {item.relation && (
          <Text style={styles.contactRelation} numberOfLines={1}>{item.relation}</Text>
        )}
      </View>

      {/* 3-dot Menu Button */}
      <TouchableOpacity 
        onPress={(e) => showMenu(item, e)}
        style={styles.menuButton}
        activeOpacity={0.6}
      >
        <Ionicons name="ellipsis-vertical" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const handleFloatingButtonPress = () => {
    if (showForm) {
      // Close form and reset
      setShowForm(false);
      setEditingId(null);
      setNewName("");
      setNewPhone("");
      setNewRelation("");
      Keyboard.dismiss();
    } else {
      // Open form
      setShowForm(true);
      setEditingId(null);
      setNewName("");
      setNewPhone("");
      setNewRelation("");
    }
  };

  return (
    <>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container}>
          <Navbar
            title="Support Circle"
            onBack={() => navigation.goBack()}
            logoSource={require("../assets/logo.png")}
          />
          
          {/* WhatsApp-style Header */}
          <View style={styles.whatsappHeader}>
            <View style={styles.headerContent}>
              <View style={styles.headerInfo}>
                <Ionicons name="people" size={26} color="#e9237f" />
                <View style={styles.headerTexts}>
                  <Text style={styles.mainTitle}>Trusted Contacts</Text>
                  <Text style={styles.subTitle}>
                    {contacts.length} {contacts.length === 1 ? 'contact' : 'contacts'} • Emergency alerts
                  </Text>
                </View>
              </View>

              {/* Original add button in header - kept for layout */}
              <TouchableOpacity
                style={[styles.addButton, { opacity: 0 }]}
                activeOpacity={0.8}
                disabled={true}
              >
                <Ionicons name="add" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            {/* Search Bar with Gradient Border */}
            <View style={styles.searchContainer}>
              <LinearGradient
                colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.searchBoxGradient}
              >
                <View style={styles.searchBox}>
                  <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
                  <TextInput
                    style={styles.searchInput}
                    placeholder="Search contacts..."
                    placeholderTextColor="#999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    clearButtonMode="while-editing"
                  />
                  {searchQuery.length > 0 && (
                    <TouchableOpacity onPress={() => setSearchQuery("")}>
                      <Ionicons name="close-circle" size={18} color="#999" />
                    </TouchableOpacity>
                  )}
                </View>
              </LinearGradient>
            </View>
          </View>

          {/* YOUR EXISTING FORM - UNCHANGED */}
          {showForm && (
            <View style={styles.formContainer}>
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor="#999"
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#999"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <TextInput
                style={styles.input}
                placeholder="Relation"
                placeholderTextColor="#999"
                value={newRelation}
                onChangeText={setNewRelation}
              />

              <TouchableOpacity
                style={[styles.saveButton, { alignSelf: "flex-end", marginRight: 16, opacity: saving ? 0.8 : 1 }]}
                onPress={handleAddContact}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.saveText}>{editingId ? "Update" : "Save"}</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#e9237f" />
              <Text style={styles.loadingText}>Loading contacts...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              refreshControl={
                <RefreshControl 
                  refreshing={refreshing} 
                  onRefresh={onRefresh}
                  colors={["#e9237f"]}
                  tintColor="#e9237f"
                  progressBackgroundColor="#FFF"
                />
              }
              ListEmptyComponent={() => (
                <View style={styles.emptyContainer}>
                  <Ionicons name="people-outline" size={64} color="#D1D5DB" />
                  <Text style={styles.emptyTitle}>No contacts yet</Text>
                  <Text style={styles.emptyText}>
                    {searchQuery ? "No matches found" : "Add your emergency contacts"}
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyButton}
                    onPress={() => {
                      setShowForm(true);
                      setEditingId(null);
                      setNewName("");
                      setNewPhone("");
                      setNewRelation("");
                    }}
                  >
                    <Ionicons name="person-add" size={18} color="#FFF" />
                    <Text style={styles.emptyButtonText}>Add First Contact</Text>
                  </TouchableOpacity>
                </View>
              )}
              contentContainerStyle={styles.listContainer}
            />
          )}

          {/* Floating Action Button - Changes between + and × */}
          <TouchableOpacity
            style={[
              styles.floatingButton,
              { 
                bottom: insets.bottom + 80,
                backgroundColor: showForm ? "#FFF" : "#e9237f", // White background when cross
              }
            ]}
            onPress={handleFloatingButtonPress}
            activeOpacity={0.9}
          >
            <View style={[styles.fab, showForm && styles.fabCross]}>
              <Ionicons 
                name={showForm ? "close" : "add"} 
                size={28} 
                color={showForm ? "#e9237f" : "#FFF"} 
              />
            </View>
          </TouchableOpacity>

          <View
            style={[
              styles.fixedBottom,
              { paddingBottom: insets.bottom ? insets.bottom : 12 },
            ]}
            pointerEvents="box-none"
          >
            <BottomNavBar
              onHome={() => navigation.navigate("Dashboard")}
              onLocation={() => navigation.navigate("SafeSpacesScreen")}
              onSOS={() => navigation.navigate("SOSScreen")}
              onLegal={() => navigation.navigate("LegalSupportScreen")}
              onContacts={() => navigation.navigate("ContactsScreen")}
            />
          </View>
        </View>
      </SafeAreaView>

      {/* Context Menu Modal */}
      <Modal
        visible={menuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.menuBackdrop}>
            <View 
              style={[
                styles.menuContainer,
                {
                  position: 'absolute',
                  top: menuPosition.y,
                  left: menuPosition.x,
                }
              ]}
              onStartShouldSetResponder={() => true}
            >
              {selectedContact && (
                <>
                  <TouchableOpacity 
                    style={styles.menuItem}
                    onPress={() => handleEdit(selectedContact)}
                  >
                    <Ionicons name="pencil-outline" size={18} color="#4B5563" />
                    <Text style={styles.menuItemText}>Update</Text>
                  </TouchableOpacity>
                  
                  <View style={styles.menuDivider} />
                  
                  <TouchableOpacity 
                    style={[styles.menuItem, styles.deleteMenuItem]}
                    onPress={() => handleDelete(selectedContact.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    <Text style={[styles.menuItemText, styles.deleteMenuText]}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

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

export default ContactsScreen;

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF",
  },
  container: { 
    flex: 1, 
    backgroundColor: "#fff",
    position: "relative" 
  },
  // WhatsApp-style Header
  whatsappHeader: {
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  headerInfo: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerTexts: {
    marginLeft: 12,
  },
  mainTitle: {
    fontSize: 18,
    fontWeight: "500",
    color: "#3d3b3bff",
    letterSpacing: -0.5,
  },
  subTitle: {
    fontSize: 13,
    color: "rgba(119, 112, 112, 0.9)",
    marginTop: 2,
  },
  // Search with Gradient Border
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  searchBoxGradient: {
    borderRadius: 26, // Slightly larger than searchBox for border effect
    padding: 2, // This creates the border thickness
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 3,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#333",
  },
  // YOUR EXISTING FORM STYLES - KEPT EXACTLY THE SAME
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e9237f",
    shadowColor: "#f08fb1",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 14,
  },
  formContainer: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: 16,
    marginVertical: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 1,
    borderWidth: 1,
    borderColor: "#f3f4f6",
  },
  input: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 14,
    color: "#111827",
  },
  saveButton: {
    backgroundColor: "#e9237f",
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  saveText: {
    color: "#fff",
    fontWeight: "500",
    fontSize: 14,
  },
  // WhatsApp-style Contact Items
  listContainer: {
    paddingBottom: 100,
  },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  avatarText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  contactDetails: {
    flex: 1,
    marginLeft: 16,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  contactName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  contactTime: {
    fontSize: 12,
    color: "#9CA3AF",
    marginLeft: 6,
  },
  contactPhone: {
    fontSize: 14,
    color: "#4B5563",
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: 13,
    color: "#6B7280",
    fontStyle: "italic",
  },
  // 3-dot Menu Button
  menuButton: {
    padding: 8,
  },
  fixedBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 999,
    elevation: 20,
  },
  // Floating Action Button - Updated styles
  floatingButton: {
    position: "absolute",
    right: 24,
    zIndex: 1000,
    backgroundColor: "#e9237f",
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 2,
    borderColor: "#e9237f",
  },
  fab: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  fabCross: {
    // No additional styles needed, just for reference
  },
  // Context Menu Styles
  menuBackdrop: {
    flex: 1,
    // backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  menuContainer: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 110,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 120,
  },
  deleteMenuItem: {
    backgroundColor: '#FEF2F2',
  },
  menuItemText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#4B5563',
    marginLeft: 10,
  },
  deleteMenuText: {
    color: '#DC2626',
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 8,
    marginVertical: 4,
  },
  // Loading & Empty States
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingBottom: 100,
  },
  loadingText: {
    marginTop: 12,
    color: "#6B7280",
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#e9237f",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  emptyButtonText: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 15,
  },
});