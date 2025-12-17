// screens/SafetyTipsScreen.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  RefreshControl,
  TextInput,
  Switch,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { Ionicons, MaterialIcons, Feather } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

const ALL_TIPS = [
  {
    id: 1,
    sender: "Safety Team",
    subject: "Share your location",
    preview: "Share your location with someone you trust whenever you go somewhere unfamiliar.",
    time: "2:30 PM",
    read: true,
    category: "travel",
    pinned: true,
    priority: "high",
  },
  {
    id: 2,
    sender: "Security Expert",
    subject: "Trust your instincts",
    preview: "If something feels wrong, move to a safe place immediately.",
    time: "Yesterday",
    read: true,
    category: "general",
    pinned: false,
    priority: "medium",
  },
  {
    id: 3,
    sender: "Tech Safety",
    subject: "Digital Privacy",
    preview: "Avoid sharing exact real-time locations on public social media posts.",
    time: "Apr 28",
    read: false,
    category: "digital",
    pinned: true,
    priority: "high",
  },
  {
    id: 4,
    sender: "Travel Safety",
    subject: "Plan exit routes",
    preview: "Always plan exit routes when entering crowded places like concerts or festivals.",
    time: "Apr 27",
    read: true,
    category: "travel",
    pinned: false,
    priority: "medium",
  },
  {
    id: 5,
    sender: "Home Security",
    subject: "Keys in hand",
    preview: "Keep your keys in your hand when approaching your car or home at night.",
    time: "Apr 26",
    read: false,
    category: "home",
    pinned: false,
    priority: "high",
  },
  {
    id: 6,
    sender: "Public Safety",
    subject: "Well-lit areas",
    preview: "Stay in well-lit, populated areas whenever possible, especially at night.",
    time: "Apr 25",
    read: true,
    category: "general",
    pinned: false,
    priority: "medium",
  },
  {
    id: 7,
    sender: "Emergency Prep",
    subject: "Emergency contacts",
    preview: "Keep emergency contacts at the top of your phone for quick access.",
    time: "Apr 24",
    read: true,
    category: "emergency",
    pinned: true,
    priority: "critical",
  },
  {
    id: 8,
    sender: "Transport Safety",
    subject: "Verified transport",
    preview: "Use cab services with driver and plate verification features.",
    time: "Apr 23",
    read: false,
    category: "travel",
    pinned: false,
    priority: "medium",
  },
];

const CATEGORIES = [
  { id: "all", label: "All Tips", icon: "mail", count: 8, color: "#21303A" },
  { id: "travel", label: "Travel", icon: "car", count: 3, color: "#21303A" },
  { id: "digital", label: "Digital", icon: "phone-portrait", count: 1, color: "#21303A" },
  { id: "home", label: "Home", icon: "home", count: 1, color: "#21303A" },
  { id: "emergency", label: "Emergency", icon: "alert-circle", count: 1, color: "#21303A" },
  { id: "general", label: "General", icon: "bulb", count: 2, color: "#21303A" },
];

export default function SafetyTipsScreen() {
  const navigation = useNavigation();
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("all");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedTips, setSelectedTips] = useState<number[]>([]);
  const [isSelecting, setIsSelecting] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
    }, 1500);
  }, []);

  useFocusEffect(
    useCallback(() => {
      StatusBar.setBarStyle("dark-content");
      return () => {};
    }, [])
  );

  const filteredTips = ALL_TIPS.filter(tip => {
    const matchesSearch = searchQuery === "" || 
      tip.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tip.preview.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tip.sender.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = activeCategory === "all" || tip.category === activeCategory;
    const matchesUnread = !showUnreadOnly || !tip.read;
    
    return matchesSearch && matchesCategory && matchesUnread;
  });

  const handleTipPress = (tipId: number) => {
    if (isSelecting) {
      setSelectedTips(prev =>
        prev.includes(tipId)
          ? prev.filter(id => id !== tipId)
          : [...prev, tipId]
      );
    } else {
      // Navigate to tip detail
      // navigation.navigate("TipDetail", { tipId });
    }
  };

  const handleLongPress = (tipId: number) => {
    setIsSelecting(true);
    setSelectedTips([tipId]);
  };

  const handleSelectAll = () => {
    if (selectedTips.length === filteredTips.length) {
      setSelectedTips([]);
    } else {
      setSelectedTips(filteredTips.map(tip => tip.id));
    }
  };

  const handleMarkAsRead = () => {
    // Logic to mark selected tips as read
    setSelectedTips([]);
    setIsSelecting(false);
  };

  const handlePinTips = () => {
    // Logic to pin/unpin selected tips
    setSelectedTips([]);
    setIsSelecting(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "#F44336";
      case "high": return "#FF9800";
      case "medium": return "#2196F3";
      default: return "#9E9E9E";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "critical": return "Critical";
      case "high": return "High";
      case "medium": return "Medium";
      default: return "Low";
    }
  };

  const renderTipItem = (tip: typeof ALL_TIPS[0]) => {
    const isSelected = selectedTips.includes(tip.id);
    
    return (
      <TouchableOpacity
        key={tip.id}
        style={[
          styles.tipItem,
          isSelected && styles.tipItemSelected,
          !tip.read && styles.tipItemUnread,
        ]}
        activeOpacity={0.7}
        onPress={() => handleTipPress(tip.id)}
        onLongPress={() => handleLongPress(tip.id)}
        delayLongPress={500}
      >
        {isSelecting ? (
          <View style={styles.checkbox}>
            {isSelected ? (
              <Ionicons name="checkmark-circle" size={22} color="#9d1af2" />
            ) : (
              <Ionicons name="ellipse-outline" size={22} color="#999" />
            )}
          </View>
        ) : (
          <View style={[
            styles.senderIcon,
            { backgroundColor: getPriorityColor(tip.priority) }
          ]}>
            <Text style={styles.senderIconText}>
              {tip.sender.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        
        <View style={styles.tipContent}>
          <View style={styles.tipHeader}>
            <View style={styles.senderContainer}>
              <Text style={[styles.sender, !tip.read && styles.senderUnread]}>
                {tip.sender}
              </Text>
              {tip.pinned && !isSelecting && (
                <MaterialIcons name="bookmark" size={14} color="#e91e7a" style={styles.pinIcon} />
              )}
            </View>
            <View style={styles.timeContainer}>
              {!tip.read && (
                <View style={styles.unreadDot} />
              )}
              <Text style={styles.time}>{tip.time}</Text>
            </View>
          </View>
          
          <Text style={[styles.subject, !tip.read && styles.subjectUnread]}>
            {tip.subject}
          </Text>
          
          <Text style={styles.preview} numberOfLines={2}>
            {tip.preview}
          </Text>
          
          <View style={styles.tipFooter}>
            <View style={styles.footerLeft}>
              <View style={[styles.priorityTag, { backgroundColor: getPriorityColor(tip.priority) + '20' }]}>
                <Text style={[styles.priorityText, { color: getPriorityColor(tip.priority) }]}>
                  {getPriorityLabel(tip.priority)}
                </Text>
              </View>
              <View style={[styles.categoryTag, { backgroundColor: getCategoryColor(tip.category) + '20' }]}>
                <Ionicons 
                  name={CATEGORIES.find(c => c.id === tip.category)?.icon as any || "help-circle"} 
                  size={12} 
                  color={getCategoryColor(tip.category)} 
                />
                <Text style={[styles.categoryText, { color: getCategoryColor(tip.category) }]}>
                  {getCategoryLabel(tip.category)}
                </Text>
              </View>
            </View>
            
            {isSelecting ? null : (
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="ellipsis-horizontal" size={20} color="#999" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const getCategoryColor = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.color || "#9d1af2";
  };

  const getCategoryLabel = (category: string) => {
    const cat = CATEGORIES.find(c => c.id === category);
    return cat?.label || "General";
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => {
              if (isSelecting) {
                setIsSelecting(false);
                setSelectedTips([]);
              } else {
                navigation.goBack();
              }
            }}
          >
            <Ionicons 
              name={isSelecting ? "close" : "arrow-back"} 
              size={24} 
              color="#21303A" 
            />
          </TouchableOpacity>
          
          {isSelecting ? (
            <View style={styles.selectionHeader}>
              <Text style={styles.selectionCount}>
                {selectedTips.length} selected
              </Text>
              <View style={styles.selectionActions}>
                <TouchableOpacity onPress={handleSelectAll} style={styles.actionButton}>
                  <Ionicons 
                    name={selectedTips.length === filteredTips.length ? "checkbox" : "square-outline"} 
                    size={20} 
                    color="#21303A" 
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleMarkAsRead} style={styles.actionButton}>
                  <Feather name="check-circle" size={20} color="#21303A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePinTips} style={styles.actionButton}>
                  <MaterialIcons name="bookmark" size={20} color="#21303A" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <>
              <View style={styles.headerTitleContainer}>
                <Text style={styles.headerTitle}>Safety Tips</Text>
                <Text style={styles.headerSubtitle}>
                  {filteredTips.length} messages • {filteredTips.filter(t => !t.read).length} unread
                </Text>
              </View>
              <View style={styles.headerActions}>
                <TouchableOpacity style={styles.headerActionButton}>
                  <Ionicons name="search" size={22} color="#21303A" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.headerActionButton}>
                  <Ionicons name="ellipsis-vertical" size={22} color="#21303A" />
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Main Content */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor="#9d1af2"
            colors={["#9d1af2"]}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Hero Section */}
        <View style={styles.heroSection}>
          <LinearGradient
            colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroContent}>
              <View style={styles.heroIconContainer}>
                <Ionicons name="shield-checkmark" size={32} color="#fff" />
              </View>
              <View style={styles.heroTextContainer}>
                <Text style={styles.heroTitle}>Your Safety Inbox</Text>
                <Text style={styles.heroSubtitle}>
                  Important safety advice and alerts
                </Text>
              </View>
              <TouchableOpacity style={styles.composeButton}>
                <Feather name="plus" size={20} color="#9d1af2" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>

        {/* Search Bar with ALWAYS VISIBLE LinearGradient Border */}
        <View style={styles.searchWrapper}>
          <LinearGradient
            colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.searchGradientBorder}
          >
            <View style={[
              styles.searchContainer,
              searchFocused && styles.searchContainerFocused
            ]}>
              <Ionicons 
                name="search" 
                size={20} 
                color={searchFocused ? "#9d1af2" : "#999"} 
                style={styles.searchIcon} 
              />
              <TextInput
                style={styles.searchInput}
                placeholder="Search safety tips..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholderTextColor="#999"
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setSearchFocused(false)}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery("")}>
                  <Ionicons name="close-circle" size={20} color="#999" />
                </TouchableOpacity>
              )}
            </View>
          </LinearGradient>
        </View>

        {/* Quick Filters */}
        <View style={styles.filtersSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filtersScroll}
            contentContainerStyle={styles.filtersContent}
          >
            {CATEGORIES.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.filterChip,
                  activeCategory === category.id && styles.filterChipActive,
                ]}
                onPress={() => setActiveCategory(category.id)}
              >
                <Ionicons
                  name={category.icon as any}
                  size={16}
                  color={activeCategory === category.id ? "#fff" : category.color}
                  style={styles.filterIcon}
                />
                <Text
                  style={[
                    styles.filterText,
                    activeCategory === category.id && styles.filterTextActive,
                  ]}
                >
                  {category.label}
                </Text>
                <View style={[
                  styles.countBadge,
                  activeCategory === category.id && styles.countBadgeActive
                ]}>
                  <Text style={[
                    styles.countText,
                    activeCategory === category.id && styles.countTextActive
                  ]}>
                    {category.count}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          <View style={styles.filterToggle}>
            <Ionicons name="eye-outline" size={16} color="#666" />
            <Text style={styles.filterToggleText}>Unread only</Text>
            <Switch
              value={showUnreadOnly}
              onValueChange={setShowUnreadOnly}
              trackColor={{ false: "#e0e0e0", true: "#e9237fff" }}
              thumbColor="#fff"
              ios_backgroundColor="#e0e0e0"
              style={styles.switch}
            />
          </View>
        </View>

        {/* Selection Bar */}
        {isSelecting && (
          <View style={styles.selectionBar}>
            <View style={styles.selectionContent}>
              <TouchableOpacity onPress={() => setIsSelecting(false)} style={styles.cancelButton}>
                <Ionicons name="close" size={20} color="#21303A" />
              </TouchableOpacity>
              <Text style={styles.selectionCount}>
                {selectedTips.length} selected
              </Text>
              <View style={styles.selectionActions}>
                <TouchableOpacity onPress={handleSelectAll} style={styles.selectionAction}>
                  <Ionicons 
                    name={selectedTips.length === filteredTips.length ? "checkbox" : "square-outline"} 
                    size={20} 
                    color="#21303A" 
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleMarkAsRead} style={styles.selectionAction}>
                  <Feather name="check-circle" size={20} color="#21303A" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handlePinTips} style={styles.selectionAction}>
                  <MaterialIcons name="bookmark" size={20} color="#21303A" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.selectionAction}>
                  <Feather name="trash-2" size={20} color="#F44336" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Tips List */}
        {filteredTips.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="mail-open-outline" size={72} color="#e0e0e0" />
            <Text style={styles.emptyStateTitle}>No safety tips found</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery 
                ? "Try a different search term" 
                : showUnreadOnly 
                  ? "All tips are read" 
                  : "No tips match the selected filter"}
            </Text>
            <TouchableOpacity 
              style={styles.emptyStateButton}
              onPress={() => {
                setSearchQuery("");
                setActiveCategory("all");
                setShowUnreadOnly(false);
              }}
            >
              <Text style={styles.emptyStateButtonText}>View All Tips</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Today Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Today</Text>
              <TouchableOpacity>
                <Text style={styles.sectionAction}>See all</Text>
              </TouchableOpacity>
            </View>
            {filteredTips.filter(tip => tip.time.includes("PM") || tip.time.includes("AM")).map(renderTipItem)}
            
            {/* Yesterday Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Yesterday</Text>
              <TouchableOpacity>
                <Text style={styles.sectionAction}>See all</Text>
              </TouchableOpacity>
            </View>
            {filteredTips.filter(tip => tip.time === "Yesterday").map(renderTipItem)}
            
            {/* This Week Section */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>This Week</Text>
              <TouchableOpacity>
                <Text style={styles.sectionAction}>See all</Text>
              </TouchableOpacity>
            </View>
            {filteredTips.filter(tip => tip.time.includes("Apr") && 
              !tip.time.includes("Yesterday") && 
              !(tip.time.includes("PM") || tip.time.includes("AM"))).map(renderTipItem)}
            
            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        activeOpacity={0.8}
        onPress={() => {
          // Navigate to add custom tip or emergency contacts
        }}
      >
        <View style={styles.fabContent}>
          <Ionicons name="add" size={24} color="#fff" />
        </View>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
        marginTop: 30,
    paddingTop: Platform.OS === "ios" ? 0 : StatusBar.currentHeight,
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    padding: 8,
    marginRight: 12,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#21303A",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#666",
    marginTop: 2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerActionButton: {
    padding: 8,
    marginLeft: 4,
  },
  selectionHeader: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#21303A",
  },
  scrollView: {
    flex: 1,
    padding: 20,
  },
  heroSection: {
    marginBottom: 16,
  },
  heroGradient: {
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    paddingTop: Platform.OS === "ios" ? 60 : 20,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  heroContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  heroIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  heroTextContainer: {
    flex: 1,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    marginBottom: 4,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.9)",
  },
  composeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrapper: {
    paddingHorizontal: 10,
    marginBottom: 16,
  },
  // LinearGradient border 
  searchGradientBorder: {
    borderRadius: 25,
    padding: 2, 
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
backgroundColor: "#F9FAFB",
    borderRadius: 24,
    paddingHorizontal: 20,
    height: 44,
  },
  searchContainerFocused: {
    backgroundColor: "#fff",
  },
  searchIcon: {
    marginRight: 12,
 
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#21303A",
    height: 44,
  },
  filtersSection: {
    marginBottom: 20,
  },
  filtersScroll: {
    paddingLeft: 20,
  },
  filtersContent: {
    paddingRight: 20,
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 12,
    borderWidth: 1.5,
    borderColor: "#f0f0f0",
  },
  filterChipActive: {
    backgroundColor: "#e9237fff",
    borderColor: "#e9237fff",
  },
  filterIcon: {
    marginRight: 8,
  },
  filterText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginRight: 8,
  },
  filterTextActive: {
    color: "#fff",
  },
  countBadge: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: "center",
  },
  countBadgeActive: {
    backgroundColor: "rgba(255,255,255,0.3)",
  },
  countText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  countTextActive: {
    color: "#fff",
  },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
    paddingHorizontal: 20,
  },
  filterToggleText: {
    fontSize: 14,
    color: "#666",
    marginLeft: 8,
    marginRight: 12,
    flex: 1,
  },
  switch: {
    transform: Platform.OS === "ios" ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [],
  },
  selectionBar: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    paddingVertical: 12,
    marginBottom: 16,
  },
  selectionContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  cancelButton: {
    padding: 8,
    marginRight: 12,
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#21303A",
    flex: 1,
  },
  selectionActions: {
    flexDirection: "row",
    alignItems: "center",
  },
  selectionAction: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginLeft: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#fafafa",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#21303A",
  },
  sectionAction: {
    fontSize: 14,
    fontWeight: "600",
    color: "#9d1af2",
  },
  tipItem: {
    flexDirection: "row",
    backgroundColor: "#fff",
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#f8f8f8",
    alignItems: "flex-start",
  },
  tipItemSelected: {
    backgroundColor: "#f9f0ff",
  },
  tipItemUnread: {
    backgroundColor: "#f8fbff",
  },
  checkbox: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  senderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  senderIconText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  tipContent: {
    flex: 1,
  },
  tipHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  senderContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  sender: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
    marginRight: 8,
  },
  senderUnread: {
    color: "#21303A",
    fontWeight: "700",
  },
  pinIcon: {
    marginTop: 2,
  },
  timeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  time: {
    fontSize: 13,
    color: "#999",
  },
  subject: {
    fontSize: 17,
    fontWeight: "600",
    color: "#21303A",
    marginBottom: 6,
    lineHeight: 22,
  },
  subjectUnread: {
    fontWeight: "700",
  },
  preview: {
    fontSize: 15,
    color: "#666",
    lineHeight: 20,
    marginBottom: 12,
  },
  tipFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  priorityTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  categoryTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: "600",
    marginLeft: 4,
  },
  actionButton: {
    padding: 4,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#9d1af2",
    marginRight: 6,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#666",
    marginTop: 24,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 15,
    color: "#999",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: "#9d1af2",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emptyStateButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  bottomSpacer: {
    height: 120,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 30,
    width: 56,
    height: 56,
    borderRadius: 28,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.2,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 8,
      },
      android: {
        elevation: 6,
        shadowColor: "#000",
      },
    }),
  },
  fabContent: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e9237fff",
    alignItems: "center",
    justifyContent: "center",
  },
});