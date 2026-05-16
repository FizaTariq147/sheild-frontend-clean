// components/SupportNetworkCard.tsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";

type NavProp = StackNavigationProp<RootStackParamList>;

type Contact = {
  id: string;
  label: string; // display name e.g. "Rescue 1122"
  number: string; // dialable
  subtitle?: string; // small description
  priority?: "emergency" | "rescue" | "police" | "fire" | "other";
  color?: string; // status color for dot (optional)
};

const DEFAULT_CONTACTS: Contact[] = [
  { id: "c2", label: "Police (15)", number: "15", subtitle: "Police Emergency", priority: "police", color: "#3498db" },
  { id: "c5", label: "National Emergency (112)", number: "112", subtitle: "Unified Emergency", priority: "other", color: "#9b59b6" },
];

const VISIBLE_LIMIT = 5;

export default function SupportNetworkCard({
  contacts = DEFAULT_CONTACTS,
  onManage,
  apiBase = "https://fiza-tariq-shield-backend.hf.space",
}: {
  contacts?: Contact[];
  onManage?: () => void;
  apiBase?: string;
}) {
  const navigation = useNavigation<NavProp>();
  const [userContacts, setUserContacts] = useState<Contact[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

const callNumber = (phone: string, name: string) => {
  navigation.navigate("InAppCallScreen", {
    serviceName: name,
    phoneNumber: phone,
  });
};

  // fetch saved contacts for the logged-in user
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const fetchContacts = async () => {
      setLoading(true);
      setError(null);

      try {
        const token = await AsyncStorage.getItem("accessToken");
        if (!token) {
          if (mounted) {
            setUserContacts([]);
            setLoading(false);
          }
          return;
        }

        const res = await fetch(`${apiBase}/api/contacts`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          let body;
          try {
            body = txt ? JSON.parse(txt) : null;
          } catch {
            body = null;
          }
          throw new Error((body?.error || body?.message) || txt || `HTTP ${res.status}`);
        }

        const data = await res.json();
        const list: Contact[] = Array.isArray(data)
          ? data
              .filter((c: any) => c?.phone)
              .map((c: any) => ({
                id: c.id,
                label: c.full_name || c.name || c.id,
                number: c.phone,
                subtitle: c.relation || undefined,
                priority: "other",
                color: undefined,
              }))
          : [];

        if (mounted) setUserContacts(list);
      } catch (err: any) {
        console.error("SupportNetworkCard fetch error:", err);
        if (mounted) setError(err.message || "Failed to load contacts");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchContacts();

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [apiBase]);

  // merge static contacts and user contacts
  const mergedContacts = (() => {
    const staticFiltered = (contacts || DEFAULT_CONTACTS).filter(
      (c) => !(c.priority === "rescue" || c.priority === "fire")
    );

    if (!userContacts) return staticFiltered;
    return [...userContacts, ...staticFiltered];
  })();

  const visibleList = showAll ? mergedContacts : mergedContacts.slice(0, VISIBLE_LIMIT);

  return (
    <View style={styles.wrapper}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.iconCircle}>
            <Ionicons name="heart" size={20} color="#fff" />
          </View>
          <View style={{ marginLeft: 12 }}>
            <Text style={styles.title}>Support Network</Text>
            <Text style={styles.subtitle}>Your caring circle</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.countPill}>
            <Text style={styles.countText}>{mergedContacts.length} contacts</Text>
          </View>
        </View>
      </View>

      {/* Contact List */}
      <View style={styles.list}>
        {loading ? (
          <View style={{ paddingVertical: 16, alignItems: "center" }}>
            <ActivityIndicator />
          </View>
        ) : error ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#c53030" }}>{error}</Text>
          </View>
        ) : mergedContacts.length === 0 ? (
          <View style={{ paddingVertical: 12, alignItems: "center" }}>
            <Text style={{ color: "#6b7280" }}>No support contacts saved.</Text>
          </View>
        ) : (
          visibleList.map((c) => (
            <View key={c.id} style={styles.contactRow}>
              <View style={styles.contactLeft}>
                <View style={[styles.statusDot, { backgroundColor: c.color ?? "#2ecc71" }]} />
                <View style={styles.contactTextWrap}>
                  <Text style={styles.contactLabel}>{c.label}</Text>
                  {c.subtitle ? <Text style={styles.contactMeta}>{c.subtitle}</Text> : null}
                </View>
              </View>

              <TouchableOpacity
                style={styles.callButton}
                onPress={() => callNumber(c.number, c.label)}
                activeOpacity={0.85}
              >
                <Text style={styles.callText}>Call</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </View>

      {/* Show more / Show less */}
      {mergedContacts.length > VISIBLE_LIMIT && (
        <View style={{ alignItems: "flex-end", marginTop: 6, marginRight: 4 }}>
          <TouchableOpacity onPress={() => setShowAll((s) => !s)} activeOpacity={0.8}>
            <Text style={{ color: "#ff7a2f", fontWeight: "700" }}>
              {showAll ? "Show less" : "Show more"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Manage Button */}
      <TouchableOpacity style={styles.manageBtn} activeOpacity={0.85} onPress={onManage}>
        <Text style={styles.manageIcon}>
          <Ionicons name="person-add-outline" size={18} />
        </Text>
        <Text style={styles.manageText}>Manage Support Circle</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 14,
    backgroundColor: "#FFF8F1",
    padding: 14,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowOffset: { width: 0, height: 8 }, shadowRadius: 18 },
      android: { elevation: 2 },
    }),
  },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  iconCircle: { width: 44, height: 44, borderRadius: 12, backgroundColor: "#ff7a2f", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 16, fontWeight: "800", color: "#21303A" },
  subtitle: { fontSize: 12, color: "#f9a270ff", marginTop: 4 },
  headerRight: { alignItems: "flex-end" },
  countPill: { backgroundColor: "#FFE8D9", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16 },
  countText: { color: "#ff7a2f", fontWeight: "700" },
  list: { marginTop: 14 },
  contactRow: { backgroundColor: "#fff", borderRadius: 10, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  contactLeft: { flexDirection: "row", alignItems: "center", flex: 1 },
  statusDot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  contactTextWrap: { flex: 1 },
  contactLabel: { fontSize: 15, fontWeight: "700", color: "#21303A" },
  contactMeta: { fontSize: 12, color: "#8aa0a6", marginTop: 4 },
  callButton: { backgroundColor: "#e9fff4", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginLeft: 10 },
  callText: { color: "#0ea66e", fontWeight: "700" },
  manageBtn: { marginTop: 8, backgroundColor: "transparent", borderColor: "#ffd6c0", borderWidth: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  manageIcon: { marginRight: 8, fontSize: 16, color: "#ff7a2f" },
  manageText: { color: "#ff7a2f", fontWeight: "700" },
});
