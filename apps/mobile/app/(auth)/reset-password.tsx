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
import { useRouter } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";
import PressableScale from "../../components/ui/PressableScale";
import type { Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

export default function ResetPassword() {
  const router = useRouter();
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const resetPassword = useAuthStore((st) => st.resetPassword);

  const [token, setToken]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone]         = useState(false);

  const [tokenFocused, setTokenFocused]       = useState(false);
  const [passFocused,  setPassFocused]        = useState(false);
  const [confirmFocused, setConfirmFocused]   = useState(false);

  const onSubmit = async () => {
    setError(null);
    if (!token.trim())    { setError("Enter the reset code from your email"); return; }
    if (password.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (password !== confirm) { setError("Passwords do not match"); return; }

    setSubmitting(true);
    try {
      await resetPassword(token.trim(), password);
      setDone(true);
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
          <Text style={styles.title}>Set new password</Text>
          <Text style={styles.subtitle}>
            Enter the 6-character code from your email and choose a new password.
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(100).duration(400)}>
          {done ? (
            <View style={styles.successCard}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>Password updated!</Text>
              <Text style={styles.successText}>
                Your password has been changed. Sign in with your new password.
              </Text>
              <PressableScale
                style={styles.button}
                onPress={() => router.replace("/login")}
              >
                <Text style={styles.buttonText}>Go to Sign in</Text>
              </PressableScale>
            </View>
          ) : (
            <>
              {error ? (
                <View style={styles.errorBox}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <Text style={styles.label}>Reset code</Text>
              <TextInput
                style={[styles.input, styles.codeInput, tokenFocused && styles.inputFocused]}
                placeholder="A3F9C2"
                placeholderTextColor={C.t3}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                value={token}
                onChangeText={(t) => setToken(t.toUpperCase())}
                onFocus={() => setTokenFocused(true)}
                onBlur={() => setTokenFocused(false)}
                autoFocus
              />

              <Text style={[styles.label, { marginTop: 4 }]}>New password</Text>
              <TextInput
                style={[styles.input, passFocused && styles.inputFocused]}
                placeholder="At least 6 characters"
                placeholderTextColor={C.t3}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
                onFocus={() => setPassFocused(true)}
                onBlur={() => setPassFocused(false)}
              />

              <Text style={[styles.label, { marginTop: 4 }]}>Confirm password</Text>
              <TextInput
                style={[styles.input, confirmFocused && styles.inputFocused]}
                placeholder="Repeat your new password"
                placeholderTextColor={C.t3}
                secureTextEntry
                value={confirm}
                onChangeText={setConfirm}
                onFocus={() => setConfirmFocused(true)}
                onBlur={() => setConfirmFocused(false)}
              />

              <PressableScale
                onPress={onSubmit}
                disabled={submitting}
                scaleTo={0.97}
                style={styles.button}
              >
                {submitting
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.buttonText}>Set new password</Text>
                }
              </PressableScale>
            </>
          )}
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
  button: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
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
}
