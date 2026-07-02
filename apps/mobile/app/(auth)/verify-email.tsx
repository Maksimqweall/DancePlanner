import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";
import PressableScale from "../../components/ui/PressableScale";
import type { Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

export default function VerifyEmail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const verifyEmail = useAuthStore((st) => st.verifyEmail);
  const resendVerification = useAuthStore((st) => st.resendVerification);

  const [email] = useState(params.email ?? "");
  const [code, setCode] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [codeFocused, setCodeFocused] = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!code.trim()) { setError("Enter the code from your email"); return; }
    setSubmitting(true);
    try {
      await verifyEmail(email, code.trim(), rememberMe);
      // Root layout redirects into the app once status flips to authenticated.
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setError(null); setResent(false); setResending(true);
    try {
      await resendVerification(email);
      setResent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not resend the code");
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.root}
    >
      <View style={styles.inner}>
        <Animated.View entering={FadeInDown.delay(0).springify().damping(16).stiffness(140)} style={styles.header}>
          <PressableScale onPress={() => router.replace("/login")} style={styles.backBtn}>
            <Text style={styles.backText}>← Back to sign in</Text>
          </PressableScale>
          <Text style={styles.title}>Verify your email</Text>
          <Text style={styles.subtitle}>
            We sent a 6-character code to {email || "your email"}. Enter it below to activate your account.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}
          {resent ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>A new code has been sent.</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Verification code</Text>
          <TextInput
            style={[styles.input, styles.codeInput, codeFocused && styles.inputFocused]}
            placeholder="A3F9C2"
            placeholderTextColor={C.t3}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.toUpperCase())}
            onFocus={() => setCodeFocused(true)}
            onBlur={() => setCodeFocused(false)}
            autoFocus
          />

          <PressableScale
            onPress={() => setRememberMe((v) => !v)}
            style={styles.rememberRow}
          >
            <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
              {rememberMe ? <Text style={styles.checkboxMark}>✓</Text> : null}
            </View>
            <Text style={styles.rememberText}>Remember me for 30 days</Text>
          </PressableScale>

          <PressableScale
            onPress={onSubmit}
            disabled={submitting}
            scaleTo={0.97}
            style={styles.button}
          >
            {submitting
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Verify</Text>
            }
          </PressableScale>

          <PressableScale onPress={onResend} disabled={resending} style={styles.resendRow}>
            <Text style={styles.resendText}>
              {resending ? "Sending…" : "Didn't get a code? Resend"}
            </Text>
          </PressableScale>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
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
  codeInput: {
    letterSpacing: 6,
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
  },
  inputFocused: { borderColor: C.accentBorder, backgroundColor: C.elevated },
  rememberRow: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: C.border,
    alignItems: "center", justifyContent: "center", marginRight: 10, backgroundColor: C.input,
  },
  checkboxChecked: { backgroundColor: C.accent, borderColor: C.accent },
  checkboxMark: { color: "#fff", fontSize: 13, fontWeight: "800" },
  rememberText: { color: C.t2, fontSize: 14, fontWeight: "500" },
  button: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  resendRow: { alignItems: "center", marginTop: 20 },
  resendText: { color: C.t3, fontSize: 13, fontWeight: "600" },
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: "#fca5a5", fontSize: 14 },
  successBox: {
    backgroundColor: C.accentFade,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  successText: { color: C.accent, fontSize: 14, fontWeight: "600" },
  });
}
