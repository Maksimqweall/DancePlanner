import { useMemo, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../store/useAuthStore";
import { GRADIENTS, type Palette } from "../lib/theme";
import { useC } from "../lib/useTheme";
import GradientButton from "../components/ui/GradientButton";

const SECTIONS: { title: string; body: string }[] = [
  {
    title: "1. Information we collect",
    body:
      "When you create an account we store your name, email address and a securely hashed password. As you use DancePlanner we also store the data you enter — expenses, budgets, calendar sessions, events and partner information — so we can sync it across your devices.",
  },
  {
    title: "2. Financial data",
    body:
      "Budgets, expenses and split calculations are stored only to power the app's finance features. We never sell this data and we do not process real payments — all amounts are figures you record yourself.",
  },
  {
    title: "3. WDSF profile data",
    body:
      "If you link a World DanceSport Federation profile, we fetch and cache publicly available competition results, rankings and judge data associated with your athlete profile to display your analytics. You can unlink your profile at any time, which removes this cached data.",
  },
  {
    title: "4. Partner synchronisation",
    body:
      "When you connect with a partner or coach, the data of your shared couple — proposals, shared expenses, chat and activity — becomes visible to the members of that couple. Only people you explicitly connect with can see this information.",
  },
  {
    title: "5. Notifications",
    body:
      "If you allow notifications, we store a push token for your device so we can alert you about partner activity and reminders. You can disable notifications at any time in your device settings.",
  },
  {
    title: "6. Security",
    body:
      "Passwords are hashed and never stored in plain text. Access to your data requires an authenticated session token. We take reasonable measures to protect your information, though no method of transmission over the internet is ever completely secure.",
  },
  {
    title: "7. Your rights",
    body:
      "You can view, edit or delete the data you create at any time from within the app, and you can request deletion of your account. Once your account is deleted, your personal data is removed from our systems.",
  },
  {
    title: "8. Contact",
    body:
      "If you have any questions about this Privacy Policy or how your data is handled, please contact us at privacy@danceplanner.app.",
  },
];

export default function PrivacyPolicyScreen() {
  const C = useC();
  const s = useMemo(() => makeStyles(C), [C]);
  const insets = useSafeAreaInsets();
  const acceptPrivacy = useAuthStore((st) => st.acceptPrivacy);
  const logout = useAuthStore((st) => st.logout);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const onAccept = async () => {
    if (!agreed || submitting) return;
    setSubmitting(true);
    try {
      await acceptPrivacy();
      // The root layout redirects automatically once privacyAccepted flips to true.
    } catch {
      setSubmitting(false);
      Alert.alert("Couldn't save", "Please check your connection and try again.");
    }
  };

  const onDecline = () => {
    Alert.alert(
      "Decline Privacy Policy?",
      "You can't use DancePlanner without accepting the Privacy Policy. You'll be signed out.",
      [
        { text: "Back", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => logout() },
      ],
    );
  };

  return (
    <View style={[s.root, { paddingTop: insets.top + 8 }]}>
      {/* Header */}
      <Animated.View entering={FadeInDown.duration(400)} style={s.header}>
        <LinearGradient
          colors={GRADIENTS.brand}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={s.badge}
        >
          <Text style={s.badgeIcon}>🔒</Text>
        </LinearGradient>
        <Text style={s.title}>Privacy Policy</Text>
        <Text style={s.subtitle}>
          Before you start, please review and accept how DancePlanner handles your data.
        </Text>
      </Animated.View>

      {/* Policy body */}
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator
      >
        <Animated.View entering={FadeInUp.delay(120).duration(400)} style={s.card}>
          <Text style={s.updated}>Last updated: June 2026</Text>
          {SECTIONS.map((sec, i) => (
            <View key={i} style={[s.section, i < SECTIONS.length - 1 && s.sectionBorder]}>
              <Text style={s.sectionTitle}>{sec.title}</Text>
              <Text style={s.sectionBody}>{sec.body}</Text>
            </View>
          ))}
        </Animated.View>
      </ScrollView>

      {/* Footer */}
      <View style={[s.footer, { paddingBottom: insets.bottom + 14 }]}>
        <Pressable onPress={() => setAgreed((v) => !v)} style={s.agreeRow} hitSlop={8}>
          <View style={[s.checkbox, agreed && { backgroundColor: C.accent, borderColor: C.accent }]}>
            {agreed ? <Text style={s.checkmark}>✓</Text> : null}
          </View>
          <Text style={s.agreeText}>I have read and agree to the Privacy Policy</Text>
        </Pressable>

        <GradientButton onPress={onAccept} disabled={!agreed || submitting}>
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.acceptText}>Accept & Continue</Text>
          )}
        </GradientButton>

        <Pressable onPress={onDecline} style={s.declineBtn} hitSlop={8}>
          <Text style={s.declineText}>Decline and sign out</Text>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    header: { alignItems: "center", paddingHorizontal: 24, paddingTop: 8, paddingBottom: 16 },
    badge: {
      width: 64,
      height: 64,
      borderRadius: 20,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 14,
      shadowColor: "#6366F1",
      shadowOpacity: 0.45,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 8 },
      elevation: 10,
    },
    badgeIcon: { fontSize: 28 },
    title: { color: C.t1, fontSize: 24, fontWeight: "800", letterSpacing: -0.5, marginBottom: 6 },
    subtitle: { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 340 },

    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 16 },
    card: {
      backgroundColor: C.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: C.border,
      paddingHorizontal: 18,
      paddingVertical: 6,
    },
    updated: { color: C.t3, fontSize: 12, fontWeight: "600", paddingTop: 14, paddingBottom: 2 },
    section: { paddingVertical: 14 },
    sectionBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
    sectionTitle: { color: C.t1, fontSize: 15, fontWeight: "700", marginBottom: 6, letterSpacing: -0.2 },
    sectionBody: { color: C.t2, fontSize: 13.5, lineHeight: 20 },

    footer: {
      paddingHorizontal: 20,
      paddingTop: 14,
      gap: 14,
      borderTopWidth: 1,
      borderTopColor: C.border,
      backgroundColor: C.card,
    },
    agreeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 7,
      borderWidth: 2,
      borderColor: C.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkmark: { color: "#fff", fontSize: 14, fontWeight: "900" },
    agreeText: { color: C.t1, fontSize: 14, fontWeight: "600", flex: 1 },

    acceptText: { color: "#fff", fontSize: 16, fontWeight: "800", letterSpacing: 0.2 },
    declineBtn: { alignItems: "center", paddingVertical: 4 },
    declineText: { color: C.t3, fontSize: 13, fontWeight: "600" },
  });
}
