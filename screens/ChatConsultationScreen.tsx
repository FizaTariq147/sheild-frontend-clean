import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StackNavigationProp } from "@react-navigation/stack";
import { RootStackParamList } from "../navigation/AppNavigator";

type ChatConsultationScreenNavProp = StackNavigationProp<
  RootStackParamList,
  "ChatConsultationScreen"
>;

type Props = {
  navigation: ChatConsultationScreenNavProp;
};

// ─── Types ────────────────────────────────────────────────────────────────────
type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};


const SYSTEM_PROMPT = `You are SHIELD Legal AI, a compassionate legal assistant specializing in 
women's rights, domestic violence, harassment, and family law. Provide clear, empathetic, 
practical legal guidance. Keep responses concise (2–4 sentences). Always remind users in 
serious situations to contact emergency services or a qualified lawyer. Never provide advice 
that could endanger the user.`;

const QUICK_PROMPTS = [
  "What are my rights if I face domestic violence?",
  "How do I file a harassment complaint?",
  "What is a restraining order?",
  "How to get legal aid?",
];


// ─── Groq API (Free, no credit card) ─────────────────────────────────────────


// List of currently working free models on Groq
const GROQ_MODELS = [
  "llama-3.1-8b-instant",    // Fast, good for legal
  "llama3-70b-8192", // Higher quality
  "gemma2-9b-it",            // Google's model
];

async function fetchAIResponse(
  messages: { role: "user" | "assistant"; content: string }[]
): Promise<string> {
  for (const model of GROQ_MODELS) {
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
    "Authorization": `Bearer ${process.env.EXPO_PUBLIC_GROQ_API_KEY}`,

          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...messages,
          ],
          max_tokens: 300,
          temperature: 0.7,
        }),
      });

      const data = await response.json();

      if (response.ok && data.choices?.[0]?.message?.content) {
        console.log(`✅ Using Groq model: ${model}`);
        return data.choices[0].message.content;
      } else {
        console.log(`❌ Model ${model} failed:`, data.error?.message);
      }
    } catch (err) {
      console.log(`⚠️ Error with ${model}:`, err);
    }
  }

  // Fallback when all models fail
  return getFallbackResponse(messages);
}

// Fallback with keyword-based responses (no API needed)
function getFallbackResponse(
  messages: { role: "user" | "assistant"; content: string }[]
): string {
  const lastMsg = messages[messages.length - 1].content.toLowerCase();
  
  if (lastMsg.includes("domestic violence") || lastMsg.includes("abuse")) {
    return "⚠️ Your safety is the priority. Please call the National Domestic Violence Hotline: 1-800-799-7233 (24/7, confidential). They can help with safety planning and local resources. Would you like information about protective orders?";
  }
  if (lastMsg.includes("harassment")) {
    return "Harassment is illegal. Keep a log of incidents, save all messages, and tell the harasser to stop in writing. You can file a police report or seek a restraining order. Need step-by-step guidance?";
  }
  if (lastMsg.includes("restraining order")) {
    return "A restraining order is a court order that prohibits someone from contacting you. Apply at your local family court – many have advocates to help. Can I help you find your local court?";
  }
  if (lastMsg.includes("legal aid")) {
    return "Legal aid provides free/low-cost legal help. Visit LawHelp.org or call your local bar association. Many states have dedicated resources for survivors. Would you like me to search for your state?";
  }
  
  return "I'm here to help with women's rights, domestic violence, harassment, and family law. Please tell me more about your situation. If you're in immediate danger, call 911.";
}



// ─── Screen ───────────────────────────────────────────────────────────────────
const ChatConsultationScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const flatRef = useRef<FlatList>(null);
  const apiHistory = useRef<{ role: "user" | "assistant"; content: string }[]>([]);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "0",
      role: "assistant",
      text: "Hello! I'm your SHIELD Legal AI assistant. I'm here to provide free, confidential legal guidance. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (messages.length > 1) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  const sendMessage = async (text?: string) => {
    const userText = (text ?? input).trim();
    if (!userText || loading) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      text: userText,
    };
    setMessages((prev) => [...prev, userMsg]);
    apiHistory.current.push({ role: "user", content: userText });

    setLoading(true);
    try {
      const reply = await fetchAIResponse(apiHistory.current);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: reply,
      };
      setMessages((prev) => [...prev, botMsg]);
      apiHistory.current.push({ role: "assistant", content: reply });
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        text: "Connection error. Please check your internet and try again.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View style={[styles.msgRow, isUser ? styles.msgRowUser : styles.msgRowBot]}>
        {!isUser && (
          <LinearGradient
            colors={["#e9237f", "#e9237f"]}
            style={styles.botAvatar}
          >
            <Text style={styles.botAvatarText}>AI</Text>
          </LinearGradient>
        )}
        <LinearGradient
          colors={isUser ? ["#e9237f", "#e9237f"] : ["#fff", "#fff"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.bubble, isUser ? styles.bubbleUser : styles.bubbleBot]}
        >
          <Text style={[styles.bubbleText, isUser ? styles.bubbleTextUser : styles.bubbleTextBot]}>
            {item.text}
          </Text>
        </LinearGradient>
      </View>
    );
  };

  return (
    <View style={[styles.container]}>
      {/* Header */}
      <LinearGradient
        colors={["#e9237f", "#e9237f"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[styles.header, { paddingTop: insets.top + 10 }]}
        
      >
        <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                        activeOpacity={0.7}
                      >
                        <Ionicons name="arrow-back" size={24} color="#fff" />
                      </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatarWrap}>
            <Text style={styles.headerAvatarText}>AI</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>chat consultation</Text>
            <View style={styles.headerStatusRow}>
              <View style={styles.onlineDot} />
              <Text style={styles.headerSubtitle}>AI-powered · Free · Confidential</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Messages */}
      <FlatList
        ref={flatRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderMessage}
        contentContainerStyle={styles.messagesList}
        style={styles.messagesContainer}
        onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: true })}
      />

      {/* Typing indicator */}
      {loading && (
        <View style={styles.typingRow}>
          <LinearGradient colors={["#e9237f", "#e9237f"]} style={styles.botAvatar}>
            <Text style={styles.botAvatarText}>AI</Text>
          </LinearGradient>
          <View style={[styles.bubble, styles.bubbleBot]}>
            <ActivityIndicator size="small" color="#9d1af2" />
          </View>
        </View>
      )}

      {/* Quick prompts */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.quickScroll}
        contentContainerStyle={styles.quickContent}
      >
        {QUICK_PROMPTS.map((q) => (
          <TouchableOpacity
            key={q}
            style={styles.quickChip}
            onPress={() => sendMessage(q)}
            activeOpacity={0.7}
          >
            <Text style={styles.quickChipText}>{q}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Input */}
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={[styles.inputRow, { paddingBottom: insets.bottom || 12 }]}>
          <TextInput
            style={styles.textInput}
            placeholder="Ask your legal question..."
            placeholderTextColor="#aaa"
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
          />
          <TouchableOpacity
            onPress={() => sendMessage()}
            disabled={loading || !input.trim()}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={["#e9237f", "#9d1af2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[
                styles.sendBtn,
                (!input.trim() || loading) && styles.sendBtnDisabled,
              ]}
            >
              <Ionicons name="send" size={16} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default ChatConsultationScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  backBtn: {
 padding: 8, marginRight: 8
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  headerAvatarWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarText: { color: "#e9237f", fontWeight: "700", fontSize: 13 },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#fff" },
  headerStatusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#4ade80" },
  headerSubtitle: { fontSize: 11, color: "rgba(255,255,255,0.85)" },

  // Messages
  messagesContainer: { flex: 1 },
  messagesList: { padding: 16, paddingBottom: 8 },
  msgRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginBottom: 12,
    gap: 8,
  },
  msgRowUser: { flexDirection: "row-reverse" },
  msgRowBot: {},
  botAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  botAvatarText: { color: "#fff", fontSize: 10, fontWeight: "700" },
  bubble: {
    maxWidth: "78%",
    padding: 10,
    paddingHorizontal: 14,
    borderRadius: 18,
  },
  bubbleBot: {
    borderBottomLeftRadius: 4,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4 },
      android: { elevation: 1 },
    }),
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextBot: { color: "#111" },
  bubbleTextUser: { color: "#fff" },

  // Typing
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },

  // Quick prompts
  quickScroll: {
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderTopColor: "#eee",
    maxHeight: 52,
  },
  quickContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
    flexDirection: "row",
  },
  quickChip: {
    backgroundColor: "#fce4f3",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  quickChipText: { color: "#e9237f", fontSize: 12, fontWeight: "600" },

  // Input
  inputRow: {
    
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderTopWidth: 0.5,
    borderTopColor: "#eee",
  },
  textInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#e0e0e0",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: "#111",
    maxHeight: 100,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
});