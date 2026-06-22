import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";
import PressableScale from "../../components/ui/PressableScale";
import { C } from "../../lib/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const forgotPassword = useAuthStore((s) => s.forgotPassword);

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [focused, setFocused] = useState(false);

  const onSubmit = async () => {
    if (!email.trim()) { setError("Enter your email address"); return; }
    setError(null);
    setSubmitting(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={styles.inner}>

        <Animated.View entering={FadeInDown.delay(0).duration(400)} style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backText}>← Back</Text>
          </PressableScale>
          <Text style={styles.title}>Reset password</Text>
          <Text style={styles.subtitle}>
            We'll send a 6-character code to your email.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          {sent ? (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Code sent!</Text>
              <Text style={styles.successText}>
                Check your inbox for the reset code, then enter it below.
              </Text>
              <PressableScale
                style={styles.button}
                onPress={() => router.push("/reset-password")}
              >
                <Text style={styles.buttonText}>Enter code →</Text>
              </PressableScale>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Email</Text>
              <TextInput
                style={[styles.input, focused && styles.inputFocused]}
                placeholder="you@example.com"
                placeholderTextColor={C.t3}
                autoCapitalize="none"
                keyboardType="email-address"
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                autoFocus
              />

              <PressableScale
                onPress={onSubmit}
                disabled={submitting}
                scaleTo={0.97}
                style={[styles.button, !email.trim() && styles.buttonDisabled]}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Send reset code</Text>
                }
              </PressableScale>
            </>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:  { flex: 1, backgroundColor: C.bg },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 64 },
  header: { marginBottom: 36 },
  backBtn:  { marginBottom: 20 },
  backText: { color: C.accent, fontSize: 15, fontWeight: "600" },
  title: {
    color: C.t1,
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
    marginBottom: 10,
  },
  subtitle: { color: C.t2, fontSize: 15, lineHeight: 22 },
  label: {
    color: C.t2,
    fontSize: 13,
    fontWeight: "500",
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: C.input,
    color: C.t1,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
    fontSize: 16,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  inputFocused: { borderColor: C.accentBorder, backgroundColor: "#1a1f1e" },
  button: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: "#fca5a5", fontSize: 14 },
  successCard: {
    backgroundColor: C.card,
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  successIcon:  { fontSize: 40, color: C.accent, marginBottom: 12 },
  successTitle: { color: C.t1, fontSize: 20, fontWeight: "700", marginBottom: 8 },
  successText:  { color: C.t2, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 24 },
});
