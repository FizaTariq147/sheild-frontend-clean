// components/SafetyTipsCard.tsx
import React, { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  TouchableOpacity,
  Platform,
  AccessibilityInfo,
} from "react-native";

import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";

type Props = {
  userName?: string;
  tips?: string[];
  minIntervalMs?: number;
  maxIntervalMs?: number;
  onPress?: () => void;
};

const DEFAULT_TIPS = [
  "Share your location with someone you trust whenever you go somewhere unfamiliar.",
  "Trust your instincts! if something feels wrong, move to a safe place.",
  "Carry a charged phone and a portable charger.",
  "Plan exit routes when you go into crowded places.",
  "Keep your keys in your hand when approaching your car or home.",
  "Avoid sharing exact real-time locations on public posts.",
  "Stay in well-lit, populated areas if possible.",
  "Tell a friend when you change plans or are running late.",
  "Use cab services with driver and plate verification.",
  "Keep emergency contacts at the top of your phone.",
  "Avoid isolated shortcuts — stick to main roads.",
  "If you feel unsafe, call local emergency services immediately.",
];

export default function SafetyTipsCard({
  userName = "",
  tips = DEFAULT_TIPS,
  minIntervalMs = 120000,
  maxIntervalMs = 180000,
  onPress,
}: Props) {
  const [displayName, setDisplayName] = useState<string>(userName);

  const [index, setIndex] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // === NETWORK CONFIG - adjust LAN_IP if testing on a physical device ===
// === NETWORK CONFIG ===
const LAN_IP: string = ""; // explicitly typed as string
const candidateBases: string[] = ["https://fiza-tariq-shield-backend.hf.space"];
if (LAN_IP && LAN_IP.length > 0) candidateBases.push(`http://${LAN_IP.trim()}:5050`);


  const extractName = (data: any) => {
    if (!data) return null;
    const full =
      data.full_name ||
      (data.first_name && data.last_name ? `${data.first_name} ${data.last_name}` : null) ||
      data.first_name ||
      data.name ||
      null;
    if (full && typeof full === "string" && full.trim()) return full.trim();

    const email = data.email || data.email_address;
    if (email && typeof email === "string") {
      const parts = email.split("@");
      if (parts.length) return parts[0];
    }
    return null;
  };

  // Helper — get hour in Asia/Karachi (0-23). Fallback to local hour if Intl fails.
  const getKarachiHour = (): number => {
    try {
      const ks = new Date().toLocaleString("en-US", { timeZone: "Asia/Karachi", hour12: false, hour: "numeric" });
      const h = parseInt(String(ks), 10);
      if (!Number.isNaN(h) && h >= 0 && h < 24) return h;
    } catch (e) {
      // ignore and fallback
    }
    return new Date().getHours();
  };

  // Greeting pools for variety (we will choose randomly within the time-appropriate pool)
  const morningGreetings = ["Hello, good morning", "Welcome Back"];
  const afternoonGreetings = ["Nice afternoon", "It's Great having you here"];
  const eveningGreetings = ["Good Evening", "Welcome Back"];
  // Night must show "Welcome back" per your request (explicitly not Good night)
  const nightGreetings = ["Welcome back"];

  const chooseGreetingForHour = (hour: number) => {
    // Morning: 05:00 - 11:59
    if (hour >= 5 && hour < 12) {
      return morningGreetings[Math.floor(Math.random() * morningGreetings.length)];
    }
    // Afternoon: 12:00 - 16:59
    if (hour >= 12 && hour < 17) {
      return afternoonGreetings[Math.floor(Math.random() * afternoonGreetings.length)];
    }
    // Evening: 17:00 - 20:59
    if (hour >= 17 && hour < 21) {
      return eveningGreetings[Math.floor(Math.random() * eveningGreetings.length)];
    }
    // Night: 21:00 - 04:59 => show Welcome back
    return nightGreetings[Math.floor(Math.random() * nightGreetings.length)];
  };

  // Attempt to fetch profile; if 401 attempt refresh; fallback to local 'user' in AsyncStorage
  useEffect(() => {
    let mounted = true;
    const controller = new AbortController();

    const tryFetchWithRefresh = async (base: string, token: string | null, refreshToken: string | null) => {
      const profileUrl = `${base}/api/users/profile`;
      try {
        const res = await fetch(profileUrl, {
          method: "GET",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });

        if (res.status === 401 || res.status === 403) {
          console.debug(`SafetyTipsCard: unauthorized (${res.status}) from ${profileUrl}`);
          if (!refreshToken) {
            console.debug("SafetyTipsCard: no refreshToken to attempt refresh");
            return { ok: false, reason: "unauthorized_no_refresh" };
          }

          try {
            const refreshRes = await fetch(`${base}/api/users/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
              signal: controller.signal,
            });
            const refreshBodyText = await refreshRes.text().catch(() => "");
            let refreshBody = null;
            try {
              refreshBody = refreshBodyText ? JSON.parse(refreshBodyText) : null;
            } catch (e) {
              refreshBody = null;
            }
            if (!refreshRes.ok) {
              console.debug("SafetyTipsCard: refresh failed", refreshRes.status, refreshBodyText);
              return { ok: false, reason: "refresh_failed" };
            }

            const newAccess = refreshBody?.accessToken || refreshBody?.access_token || null;
            const newRefresh = refreshBody?.refreshToken || refreshBody?.refresh_token || null;
            if (newAccess) {
              await AsyncStorage.setItem("accessToken", newAccess);
              console.debug("SafetyTipsCard: saved refreshed accessToken");
            }
            if (newRefresh) {
              await AsyncStorage.setItem("refreshToken", newRefresh);
              console.debug("SafetyTipsCard: saved refreshed refreshToken");
            }

            const tokenToUse = newAccess || token;
            const retryRes = await fetch(profileUrl, {
              method: "GET",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenToUse}` },
              signal: controller.signal,
            });
            if (!retryRes.ok) {
              console.debug("SafetyTipsCard: profile retry after refresh failed", retryRes.status);
              return { ok: false, reason: "retry_failed" };
            }
            const json = await retryRes.json().catch(() => null);
            return { ok: true, data: json };
          } catch (err) {
            console.debug("SafetyTipsCard: refresh attempt error", err);
            return { ok: false, reason: "refresh_error" };
          }
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          console.debug(`SafetyTipsCard: profile fetch non-ok ${res.status} ${txt}`);
          return { ok: false, reason: "non_ok" };
        }

        const json = await res.json().catch(() => null);
        return { ok: true, data: json };
      } catch (err: any) {
        if (err.name === "AbortError") return { ok: false, reason: "aborted" };
        console.debug("SafetyTipsCard: profile fetch network error", err?.message || err);
        return { ok: false, reason: "network_error" };
      }
    };

    const doWork = async () => {
      try {
        const accessToken = await AsyncStorage.getItem("accessToken");
        const refreshToken = await AsyncStorage.getItem("refreshToken");

        if (!accessToken) {
          const rawUser = await AsyncStorage.getItem("user");
          if (rawUser) {
            try {
              const obj = JSON.parse(rawUser);
              const name = extractName(obj);
              if (name && mounted) {
                setDisplayName(name);
                console.debug("SafetyTipsCard: using stored user for displayName:", name);
                return;
              }
            } catch (e) {
              // ignore
            }
          }
          console.debug("SafetyTipsCard: no accessToken and no usable stored user; keeping default");
          // Still update greeting prefix based on Karachi time with default name
          const prefix = chooseGreetingForHour(getKarachiHour());
          setDisplayName((prev) => `${prefix}, ${prev}`);
          return;
        }

        let lastFailure: any = null;
        for (const base of candidateBases) {
          if (!mounted) return;
          console.debug("SafetyTipsCard: trying profile url:", `${base}/api/users/profile`);
          const result = await tryFetchWithRefresh(base, accessToken, refreshToken);
          if (result.ok) {
            const name = extractName(result.data);
            const prefix = chooseGreetingForHour(getKarachiHour());
            if (name && mounted) {
              setDisplayName(`${prefix}, ${name}`);
              console.debug("SafetyTipsCard: profile fetched, displayName set:", name);
              return;
            } else {
              // no name in response — use stored user fallback or just the prefix + existing displayName
              const rawUser = await AsyncStorage.getItem("user");
              if (rawUser) {
                try {
                  const obj = JSON.parse(rawUser);
                  const fallbackName = extractName(obj);
                  if (fallbackName && mounted) {
                    setDisplayName(`${prefix}, ${fallbackName}`);
                    return;
                  }
                } catch (e) {}
              }
              if (mounted) setDisplayName((prev) => `${prefix}, ${prev}`);
              return;
            }
          } else {
            lastFailure = result;
          }
        }

        // fallback to stored user if present
        const rawUser = await AsyncStorage.getItem("user");
        if (rawUser) {
          try {
            const obj = JSON.parse(rawUser);
            const name = extractName(obj);
            const prefix = chooseGreetingForHour(getKarachiHour());
            if (name && mounted) {
              setDisplayName(`${prefix}, ${name}`);
              console.debug("SafetyTipsCard: fallback to stored user after failures:", name);
              return;
            } else {
              if (mounted) setDisplayName((prev) => `${prefix}, ${prev}`);
            }
          } catch (e) {
            console.debug("SafetyTipsCard: failed parsing stored user", e);
          }
        } else {
          // no stored user — at least set greeting prefix based on Karachi time
          const prefix = chooseGreetingForHour(getKarachiHour());
          if (mounted) setDisplayName((prev) => `${prefix}, ${prev}`);
        }

        console.debug("SafetyTipsCard: profile fetch failed for all candidates:", lastFailure);
      } catch (err) {
        console.debug("SafetyTipsCard: unexpected error in profile flow", err);
      }
    };

    doWork();

    return () => {
      controller.abort();
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- animation & tip rotation logic (unchanged) ---
  const getRandomInterval = () =>
    Math.floor(Math.random() * (maxIntervalMs - minIntervalMs + 1)) + minIntervalMs;

  const animateIn = () =>
    new Promise<void>((res) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => res())
    );

  const animateOut = () =>
    new Promise<void>((res) =>
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 420,
          easing: Easing.in(Easing.poly(4)),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -8,
          duration: 420,
          easing: Easing.in(Easing.poly(4)),
          useNativeDriver: true,
        }),
      ]).start(() => res())
    );

  useEffect(() => {
    let mounted = true;

    async function startCycle() {
      await animateIn();
      scheduleNext();
    }

    function scheduleNext() {
      clearTimer();
      const ms = getRandomInterval();
      timerRef.current = setTimeout(() => {
        transitionTip();
      }, ms);
    }

    async function transitionTip() {
      if (!mounted) return;
      await animateOut();
      setIndex((prev) => {
        const next = (prev + 1) % tips.length;
        AccessibilityInfo.isScreenReaderEnabled().then((enabled) => {
          if (enabled) {
            AccessibilityInfo.announceForAccessibility(tips[next]);
          }
        });
        return next;
      });
      translateY.setValue(8);
      opacity.setValue(0);
      await animateIn();
      scheduleNext();
    }

    startCycle();

    return () => {
      mounted = false;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tips.length, minIntervalMs, maxIntervalMs]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleManualNext = async () => {
    clearTimer();
    await animateOut();
    setIndex((prev) => (prev + 1) % tips.length);
    translateY.setValue(8);
    opacity.setValue(0);
    await animateIn();
    scheduleManualTimer();
  };

  const scheduleManualTimer = () => {
    clearTimer();
    timerRef.current = setTimeout(() => {
      handleManualNext();
    }, getRandomInterval());
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.greetingContainer}>
        <View style={styles.greetingLeft}>
          <Text style={styles.greetingTitle}>
            {/* displayName already includes prefix + name */}
            <Text>{displayName}!</Text>
          </Text>
          <Text style={styles.greetingSub}>You're supported and empowered today</Text>
        </View>
      </View>

      <TouchableOpacity
        activeOpacity={onPress ? 0.85 : 1}
        onPress={onPress}
        style={styles.cardOuter}
      >
        <LinearGradient
          colors={["#ef6c97ff", "#e9237fff", "#9d1af2"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.row}>
            <View style={styles.textColumn}>
              <View style={styles.headingRow}>
                <View style={styles.tipsIconWrap}>
                  <Text style={styles.tipsIcon}>💡</Text>
                </View>
                <Text style={styles.heading}>SAFETY TIPS</Text>
              </View>

              <Text style={styles.subtitle}>Practical advice for staying safe</Text>

              <Animated.View
                style={[
                  styles.tipWrap,
                  {
                    opacity,
                    transform: [{ translateY }],
                  },
                ]}
              >
                <Text style={styles.tipText}>{tips[index]}</Text>
              </Animated.View>
            </View>

            <View style={styles.floatingBadge}>
              <View style={styles.badgeInner}>
                <Text style={styles.badgeStar}>★</Text>
              </View>
            </View>
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </View>
  );
}

// (styles unchanged — paste your existing style block here)
const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 18,
    marginTop: 8,
  },

  greetingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: "#fff",
  },
  greetingLeft: { flex: 1, paddingRight: 8 },
  greetingTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#21303A",
  },
  name: { color: "#21303A" },
  flower: { fontSize: 20 },
  greetingSub: { color: "#e91e7a", marginTop: 6, fontSize: 14 },

  supportPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ffe7f2",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
  },
  supportHeart: { color: "#e91e7a", marginRight: 6, fontSize: 14 },
  supportText: { color: "#e91e7a", fontWeight: "700", fontSize: 13 },

  cardOuter: {
    borderRadius: 22,
    overflow: "visible",
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.08,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 22,
      },
      android: {
        elevation: 6,
      },
    }),
  },

  gradient: {
    borderRadius: 22,
    padding: 18,
    overflow: "visible",
  },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  leftIconWrap: {
    marginRight: 14,
    alignSelf: "flex-start",
    marginTop: 4,
  },

  leftIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.16)",
  },

  leftIconEmoji: { fontSize: 26, color: "#fff" },

  textColumn: { flex: 1 },

  headingRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 6,
  },

  tipsIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  tipsIcon: { fontSize: 16 },

  heading: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginTop: -15,
  },

  subtitle: {
    color: "rgba(255,255,255,0.95)",
    fontSize: 13,
    marginBottom: 20,
    marginLeft: 50,
    marginTop: -20,
  },

  tipWrap: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.14)",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
  },

  tipText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },

  floatingBadge: {
    position: "absolute",
    right: -20,
    top: -22,
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  badgeInner: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff9f1c",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },

  badgeStar: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
