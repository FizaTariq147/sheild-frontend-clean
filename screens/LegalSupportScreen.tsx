import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  TextInput,
  Linking, 
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system/legacy";
import * as MediaLibrary from "expo-media-library";
import Navbar from "../components/LegalTopBar";
import BottomNavBar from "../components/BottomNavBar";
import ChatConsultationScreen from "./ChatConsultationScreen";  
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemeAlert } from "../components/ThemeAlert"; // ADDED

type LegalSupportScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "LegalSupportScreen"
>;

type Props = {
  navigation: LegalSupportScreenNavProp;
};

const LegalSupportScreen: React.FC<Props> = ({ navigation }) => {
  const [activeTab, setActiveTab] = useState("Experts");
  const insets = useSafeAreaInsets();

  // ADDED: Alert state
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: '',
    message: '',
    type: 'info' as 'info' | 'error' | 'warning' | 'success',
    buttons: [] as Array<{ text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>,
  });

  const experts = [
    {
      initials: "PS",
      name: "Adv. Priya Sharma",
      field: "Women's Rights & Family Law",
      experience: "12 years experience",
      consultations: "500+ consultations",
      status: "Available",
      languages: "Urdu, English",
      rating: 4.9,
      color: ["#ff7ba2", "#ff2d7a"] as const,
    },
    {
      initials: "MG",
      name: "Adv. Meera Gupta",
      field: "Domestic Violence & Criminal Law",
      experience: "8 years experience",
      consultations: "320+ consultations",
      status: "Busy",
      languages: "Urdu, English",
      rating: 4.8,
      color: ["#b593ff", "#7b3ef0"] as const,
    },
    {
      initials: "KR",
      name: "Adv. Kavita Reddy",
      field: "Workplace Harassment & Rights",
      experience: "15 years experience",
      consultations: "650+ consultations",
      status: "Available",
      languages: "English, Urdu",
      rating: 4.9,
      color: ["#ff8cb3", "#d13df5"] as const,
    },
  ];

  const resources = [
    {
      title: "Women's Safety Rights Handbook",
      type: "PDF",
      downloads: "1.2k downloads",
      tag: "Guide",
      fileUrl: "https://www.unwomen.org/sites/default/files/Headquarters/Attachments/Sections/Library/Publications/2012/12/UNW_Legislation-Handbook%20pdf.pdf",
    },
    {
      title: "How to File an FIR",
      type: "Article",
      downloads: "900 downloads",
      tag: "Awareness",
      fileUrl: "https://www.scribd.com/document/891561633/How-to-file-an-FIR",
    },
    {
      title: "Legal Aid Services Directory",
      type: "Document",
      downloads: "700 downloads",
      tag: "Support",
      fileUrl: "https://www.las.org.pk/media/pdfs/content/Directory-of-Support-Services-for-Women-and-Girls-Experiencing-Violence-and_FHAfycl.pdf",
    },
  ];

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

 const handleDownload = async (url: string, title: string) => {
  try {
    // Request permission
    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") {
      showAlert("Permission Required", "Please allow storage access.", [{ text: "OK" }], "warning");
      return;
    }

    showAlert("Downloading...", "Please wait while the file downloads.", [{ text: "OK" }], "info");

    const filename = `${title.replace(/[^\w\s-]/g, "").trim() || "LegalDocument"}.pdf`;
    // ✅ Use cacheDirectory (works in APK)
    const fileUri = `${FileSystem.cacheDirectory}${filename}`;

    const downloadResult = await FileSystem.downloadAsync(url, fileUri);

    if (downloadResult.status !== 200) {
      showAlert("Error", "Failed to download file.", [{ text: "OK" }], "error");
      return;
    }

    // ✅ Save to media library
    const asset = await MediaLibrary.createAssetAsync(downloadResult.uri);
    await MediaLibrary.createAlbumAsync("Downloads", asset, false);

    showAlert("Success", "File saved to Downloads folder.", [{ text: "OK" }], "success");

  } catch (error: any) {
    console.error("Download Error:", error);
    // ✅ Fallback: open in browser if download fails
    showAlert(
      "Download Failed",
      "Would you like to open the file in your browser instead?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Open in Browser", onPress: () => Linking.openURL(url) }
      ],
      "warning"
    );
  }
};

 const makeCall = (phoneNumber: string, serviceName?: string) => {
  navigation.navigate("InAppCallScreen", {
    serviceName: serviceName || "Emergency Helpline",
    phoneNumber,
  });
};

  const handleChatConsultation = () => {
    // CHANGED: console.log to showAlert
    showAlert(
      "Chat Consultation", 
      "Feature coming soon! You'll be able to chat with legal experts here.",
      [{ text: "OK" }],
      "info"
    );
  };

  const handleConsultExpert = (expertName: string) => {
    // CHANGED: Add consultation logic
    showAlert(
      "Consultation Request", 
      `Your consultation request has been sent to ${expertName}. They will contact you shortly.`,
      [{ text: "OK" }],
      "success"
    );
  };

  return (
    <>
      <View style={styles.container}>
        <Navbar
          title="Legal Support"
          onBack={() => navigation.goBack()}
          logoSource={require("../assets/logo.png")}
        />

        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {/* Legal Empowerment Hub */}
          <LinearGradient
            colors={["#ef6c97", "#e9237f", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hubCard}
          >
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 16 }}>
              <MaterialCommunityIcons
                name="scale-balance"
                size={40}
                color="#fff"
                style={{ marginRight: 12 }}
              />
              <View>
                <Text style={styles.hubTitle}>Legal Empowerment Hub</Text>
                <Text style={styles.hubSubtitle}>
                  Get expert legal guidance and know your rights
                </Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>500+</Text>
                <Text style={styles.statLabel}>Consultations</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>24/7</Text>
                <Text style={styles.statLabel}>Support</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statNumber}>98%</Text>
                <Text style={styles.statLabel}>Success Rate</Text>
              </View>
            </View>
          </LinearGradient>

          {/* Action Cards */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.cardWrap}
              activeOpacity={0.9}
              onPress={() => makeCall("1091", "Women's Helpline")}
            >
              <LinearGradient
                colors={["#fff0f4", "#ffd6e6", "#ff2d7a"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCard}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="call" size={24} color="#e9237f" />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.actionTitle}>Emergency Help</Text>
                  <Text style={styles.actionText}>Immediate legal assistance</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>Available 24/7</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

                   <TouchableOpacity
              style={styles.cardWrap}
              activeOpacity={0.9}
              onPress={() => navigation.navigate("ChatConsultationScreen")}
            >
              <LinearGradient
                colors={["#f3f3ff", "#e6e2ff", "#9d1af2"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.actionCard}
              >
                <View style={styles.iconBox}>
                  <Ionicons name="chatbubbles" size={24} color="#6b46ff" />
                </View>
                <View style={styles.textCol}>
                  <Text style={styles.actionTitle}>Chat Consultation</Text>
                  <Text style={styles.actionText}>Free legal chat support</Text>
                </View>
                <View style={styles.statusPill}>
                  <Text style={styles.statusText}>Free</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          {/* Tabs */}
          <View style={styles.tabContainer}>
            {["Experts", "Resources", "Emergency"].map((tab) => (
              <TouchableOpacity
                key={tab}
                style={activeTab === tab ? styles.activeTab : styles.tabBtn}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.7}
              >
                <Text style={activeTab === tab ? styles.activeTabText : styles.tabText}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Experts Tab */}
          {activeTab === "Experts" && (
            <>
              <View style={styles.headerRow}>
                <Text style={styles.sectionTitle}>Legal Experts</Text>
                <TouchableOpacity style={styles.filterBtn} activeOpacity={0.7}>
                  <Ionicons name="filter" size={18} color="#e9237f" />
                  <Text style={styles.filterText}>Filter</Text>
                </TouchableOpacity>
              </View>

              {experts.map((item, index) => (
                <View key={index} style={styles.expertCard}>
                  <LinearGradient
                    colors={item.color}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.initialCircle}
                  >
                    <Text style={styles.initialText}>{item.initials}</Text>
                  </LinearGradient>

                  <View style={{ flex: 1 }}>
                    <View style={styles.nameRow}>
                      <Text style={styles.expertName}>{item.name}</Text>
                      <Ionicons name="star" size={16} color="#f5c518" />
                      <Text style={styles.ratingText}>{item.rating}</Text>
                    </View>
                    <Text style={styles.expertField}>{item.field}</Text>
                    <Text style={styles.expertDetail}>
                      {item.experience} • {item.consultations}
                    </Text>
                    <View style={styles.rowBetween}>
                      <View style={styles.statusRow}>
                        <View
                          style={[
                            styles.statusDot,
                            {
                              backgroundColor:
                                item.status === "Available" ? "#4CAF50" : "#FFC107",
                            },
                          ]}
                        />
                        <Text style={styles.statusTexts}>{item.status}</Text>
                      </View>
                      <Text style={styles.languageText}>{item.languages}</Text>
                    </View>
                  </View>

                  <TouchableOpacity 
                    style={[
                      styles.consultBtn,
                      item.status !== "Available" && styles.consultBtnDisabled
                    ]} 
                    onPress={() => handleConsultExpert(item.name)}
                    activeOpacity={0.8}
                    disabled={item.status !== "Available"}
                  >
                    <Text style={styles.consultText}>
                      {item.status === "Available" ? "Consult" : "Busy"}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* Resources Tab */}
          {activeTab === "Resources" && (
            <>
              <TextInput
                placeholder="Search legal resources..."
                style={styles.searchBox}
                placeholderTextColor="#999"
              />
              {resources.map((item, index) => (
                <View key={index} style={styles.resourceCard}>
                  <LinearGradient
                    colors={["#9d1af2", "#e9237f"]}
                    style={styles.iconCircle}
                  >
                    <Ionicons name="document-text-outline" size={20} color="#fff" />
                  </LinearGradient>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.resourceTitle}>{item.title}</Text>
                    <Text style={styles.resourceSubtitle}>
                      {item.type} • {item.downloads}
                    </Text>
                  </View>

                  <View style={styles.tagBadge}>
                    <Text style={styles.tagText}>{item.tag}</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => handleDownload(item.fileUrl, item.title)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="download-outline" size={22} color="#9d1af2" />
                  </TouchableOpacity>
                </View>
              ))}
            </>
          )}

          {/* Emergency Tab */}
          {activeTab === "Emergency" && (
            <View style={{ marginTop: 2 }}>
              {/* Section Header */}
              <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <Ionicons
                  name="warning-outline"
                  size={20}
                  color="#e9237f"
                  style={{ marginRight: 8 }}
                />
                <View>
                  <Text style={[styles.sectionTitle, { color: "#000" }]}>
                    Emergency Legal Contacts
                  </Text>
                  <Text style={{ color: "#555", fontSize: 12 }}>
                    Immediate help when you need it most
                  </Text>
                </View>
              </View>

              {/* Women's Helpline */}
              <LinearGradient colors={["#fff", "#fff"]} style={styles.emergencyCard}>
                <View style={styles.emergencyRow}>
                  <View style={styles.emergencyLeft}>
                    <View
                      style={[
                        styles.emergencyIconCircle,
                        { backgroundColor: "#ff2d7a20" },
                      ]}
                    >
                      <Ionicons name="call" size={22} color="#ff2d7a" />
                    </View>
                    <View>
                      <Text style={styles.emergencyTitle}>Women's Helpline</Text>
                      <Text style={styles.emergencySub}>1091     24/7</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={[styles.callBtn, { backgroundColor: "#ff2d7a" }]}
                    onPress={() => makeCall("1091", "Women's Helpline")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.callBtnText}>Call Now</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Legal Aid Services */}
              <LinearGradient colors={["#fff", "#fff"]} style={styles.emergencyCard}>
                <View style={styles.emergencyRow}>
                  <View style={styles.emergencyLeft}>
                    <View
                      style={[
                        styles.emergencyIconCircle,
                        { backgroundColor: "#9d1af220" },
                      ]}
                    >
                      <Ionicons name="call" size={22} color="#9d1af2" />
                    </View>
                    <View>
                      <Text style={styles.emergencyTitle}>Legal Aid Services</Text>
                      <Text style={styles.emergencySub}>15100     9 AM - 6 PM</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.callBtn, { backgroundColor: "#9d1af2" }]}
                    onPress={() => makeCall("15100", "Legal Aid Services")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.callBtnText}>Call Now</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Domestic Violence Helpline */}
              <LinearGradient colors={["#fff", "#fff"]} style={styles.emergencyCard}>
                <View style={styles.emergencyRow}>
                  <View style={styles.emergencyLeft}>
                    <View
                      style={[
                        styles.emergencyIconCircle,
                        { backgroundColor: "#ff2d7a20" },
                      ]}
                    >
                      <Ionicons name="call" size={22} color="#ff2d7a" />
                    </View>
                    <View>
                      <Text style={styles.emergencyTitle}>Domestic Violence Helpline</Text>
                      <Text style={styles.emergencySub}>181     24/7</Text>
                    </View>
                  </View>
                  <TouchableOpacity 
                    style={[styles.callBtn, { backgroundColor: "#ff2d7a" }]}
                    onPress={() => makeCall("181", "Domestic Violence Helpline")}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.callBtnText}>Call Now</Text>
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              {/* Rights Box */}
              <View style={styles.rightsBox}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
                  <Ionicons
                    name="shield-checkmark-outline"
                    size={20}
                    color="#e9237f"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={[styles.sectionTitle, { fontSize: 14, color: "#e9237f" }]}>
                    Know Your Emergency Rights
                  </Text>
                </View>
                <Text style={styles.rightText}>• Right to immediate police protection</Text>
                <Text style={styles.rightText}>• Right to free legal aid</Text>
                <Text style={styles.rightText}>• Right to confidential support</Text>
                <Text style={styles.rightText}>• Right to medical assistance</Text>
              </View>
            </View>
          )}
        </ScrollView>

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

export default LegalSupportScreen;

// KEPT ALL YOUR EXISTING STYLES EXACTLY THE SAME
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff", position: "relative" },
  hubCard: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 20 },
      android: { elevation: 6 },
    }),
  },
  hubTitle: { fontSize: 18, fontWeight: "700", color: "#fff" },
  hubSubtitle: { fontSize: 11, color: "#f3f3f3", marginTop: 2 },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 10,
  },
  statBox: { alignItems: "center" },
  statNumber: { fontSize: 18, fontWeight: "bold", color: "#fff" },
  statLabel: { fontSize: 12, color: "#f3f3f3" },
  actionsRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 12, marginTop: 10 },
  cardWrap: { flex: 1, marginHorizontal: 6 },
  actionCard: { 
    borderRadius: 16, 
    padding: 16, 
    minHeight: 160, 
    justifyContent: "flex-start", 
    borderWidth: 1, 
    borderColor: "rgba(0,0,0,0.03)",
    ...Platform.select({ 
      ios: { 
        shadowColor: "#000", 
        shadowOpacity: 0.06, 
        shadowOffset: { width: 0, height: 8 }, 
        shadowRadius: 20 
      }, 
      android: { elevation: 4 } 
    })
  },
  iconBox: { 
    width: 52, 
    height: 52, 
    borderRadius: 12, 
    backgroundColor: "rgba(255,255,255,0.9)", 
    alignItems: "center", 
    justifyContent: "center", 
    marginBottom: 12 
  },
  textCol: { flex: 1 },
  actionTitle: { fontSize: 12, fontWeight: "900", color: "#0f1720", marginBottom: 6 },
  actionText: { fontSize: 12, color: "rgba(15,23,32,0.6)", marginBottom: 10 },
  statusPill: { 
    backgroundColor: "rgba(255,255,255,0.88)", 
    paddingHorizontal: 10, 
    paddingVertical: 6, 
    borderRadius: 12, 
    borderWidth: 0.5, 
    borderColor: "rgba(0,0,0,0.05)", 
    alignSelf: "flex-start" 
  },
  statusText: { fontSize: 12, fontWeight: "700", color: "#e9237f" },
  tabContainer: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    backgroundColor: "#f4e9fc", 
    padding: 6, 
    borderRadius: 20, 
    marginTop: 10, 
    marginBottom: 16 
  },
  tabBtn: { paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20 },
  activeTab: { 
    flex: 1, 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    alignItems: "center", 
    paddingVertical: 8, 
  }, 
  tabText: { color: "#555", fontSize: 13, fontWeight: "500" }, 
  activeTabText: { color: "#9d1af2", fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0f1720" },
  filterBtn: { flexDirection: "row", alignItems: "center" },
  filterText: { fontSize: 12, fontWeight: "600", color: "#e9237f", marginLeft: 4 },
  headerRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center", 
    marginBottom: 10 
  },
  expertCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 12, 
    ...Platform.select({ 
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 }, 
      android: { elevation: 3 } 
    }) 
  },
  initialCircle: { 
    width: 48, 
    height: 48, 
    borderRadius: 24, 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 12 
  },
  initialText: { color: "#fff", fontWeight: "700" },
  nameRow: { flexDirection: "row", alignItems: "center" },
  expertName: { fontSize: 14, fontWeight: "700", marginRight: 6 },
  ratingText: { fontSize: 12, color: "#555", marginLeft: 4 },
  expertField: { fontSize: 12, color: "#666", marginVertical: 2 },
  expertDetail: { fontSize: 12, color: "#999" },
  rowBetween: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    marginTop: 6, 
    alignItems: "center" 
  },
  statusRow: { flexDirection: "row", alignItems: "center" },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  statusTexts: { fontSize: 12, color: "#555" },
  languageText: { fontSize: 12, color: "#555" },
  consultBtn: { 
    backgroundColor: "#e9237f", 
    paddingHorizontal: 12, 
    paddingVertical: 6, 
    borderRadius: 12 
  },
  consultBtnDisabled: {
    backgroundColor: "#ccc",
    opacity: 0.7,
  },
  consultText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  searchBox: { 
    backgroundColor: "#fff", 
    borderRadius: 12, 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    marginBottom: 12, 
    fontSize: 12 
  },
  resourceCard: { 
    flexDirection: "row", 
    alignItems: "center", 
    backgroundColor: "#fff", 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 12 
  },
  iconCircle: { 
    width: 36, 
    height: 36, 
    borderRadius: 18, 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 12 
  },
  resourceTitle: { fontSize: 13, fontWeight: "700" },
  resourceSubtitle: { fontSize: 12, color: "#666", marginTop: 2 },
  tagBadge: { 
    backgroundColor: "#e0d7f7", 
    paddingHorizontal: 8, 
    paddingVertical: 4, 
    borderRadius: 12, 
    marginRight: 8 
  },
  tagText: { fontSize: 10, color: "#7b3ef0", fontWeight: "700" },
  emergencyCard: { 
    borderRadius: 16, 
    padding: 12, 
    marginBottom: 12, 
    backgroundColor: "#fff", 
    ...Platform.select({ 
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 }, 
      android: { elevation: 3 } 
    }) 
  },
  emergencyRow: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  emergencyLeft: { flexDirection: "row", alignItems: "center" },
  emergencyIconCircle: { 
    width: 42, 
    height: 42, 
    borderRadius: 21, 
    alignItems: "center", 
    justifyContent: "center", 
    marginRight: 10 
  },
  emergencyTitle: { fontSize: 13, fontWeight: "700" },
  emergencySub: { fontSize: 11, color: "#555", marginTop: 2 },
  callBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12 },
  callBtnText: { fontSize: 12, color: "#fff", fontWeight: "700" },
  rightsBox: { backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 20 },
  rightText: { fontSize: 12, color: "#555", marginBottom: 2 },
  fixedBottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    zIndex: 999,
    elevation: 20,
  },
});