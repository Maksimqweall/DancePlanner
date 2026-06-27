import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Modal,
} from "react-native";
import { Link } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";
import GradientButton from "../../components/ui/GradientButton";
import { GRADIENTS, type Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";

function InputField({
  label,
  ...props
}: React.ComponentProps<typeof TextInput> & { label: string }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const [focused, setFocused] = useState(false);
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, focused && styles.inputFocused]}
        placeholderTextColor={C.t3}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        {...props}
      />
    </View>
  );
}

export default function Signup() {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const signup = useAuthStore((st) => st.signup);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showNameNotice, setShowNameNotice] = useState(true);

  const onSubmit = async () => {
    setError(null);
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        password,
      });
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
      <NameNoticeModal visible={showNameNotice} onClose={() => setShowNameNotice(false)} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Animated.View entering={FadeInDown.delay(50).duration(500)} style={styles.header}>
          <Text style={styles.title}>Create account</Text>
          <Text style={styles.subtitle}>Start tracking your dancesport budget</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(150).duration(500)} style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.row}>
            <View style={styles.half}>
              <InputField
                label="First name"
                placeholder="Jane"
                value={firstName}
                onChangeText={setFirstName}
              />
            </View>
            <View style={styles.half}>
              <InputField
                label="Last name"
                placeholder="Doe"
                value={lastName}
                onChangeText={setLastName}
              />
            </View>
          </View>

          <InputField
            label="Email"
            placeholder="you@example.com"
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          <InputField
            label="Password"
            placeholder="At least 6 characters"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <GradientButton onPress={onSubmit} disabled={submitting} style={{ marginTop: 8 }}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Create account</Text>
            )}
          </GradientButton>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <Link href="/login" style={styles.footerLink}>Sign in</Link>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Near-fullscreen notice shown on the signup screen: stresses that the name and
// surname must be real and match the athlete's WDSF/DTV card, otherwise the
// competition-analysis features (which look the athlete up by name) won't work.
function NameNoticeModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View style={styles.noticeOverlay}>
        <Animated.View entering={FadeInUp.duration(360)} style={styles.noticeCard}>
          <LinearGradient
            colors={GRADIENTS.brand}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.noticeIconWrap}
          >
            <Text style={styles.noticeIcon}>🩰</Text>
          </LinearGradient>

          <Text style={styles.noticeTitle}>Use your real name</Text>

          <Text style={styles.noticeBody}>
            To unlock <Text style={styles.noticeStrong}>competition analysis</Text>, ranking and
            your performance stats, Dance Planner has to find you in the WDSF database.
          </Text>
          <Text style={styles.noticeBody}>
            Enter your first name and surname{" "}
            <Text style={styles.noticeStrong}>exactly as they appear on your WDSF / DTV card</Text>{" "}
            (correct spelling, accents and order). If the name doesn't match, your profile cannot be
            linked.
          </Text>

          <View style={styles.noticeExample}>
            <Text style={styles.noticeExampleLabel}>Example</Text>
            <Text style={styles.noticeExampleText}>First name: Jana · Surname: Nováková</Text>
          </View>

          <GradientButton onPress={onClose} style={{ marginTop: 20, alignSelf: "stretch" }}>
            <Text style={styles.buttonText}>I understand</Text>
          </GradientButton>
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  scroll: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 48 },
  header: { marginBottom: 36 },
  title: { color: C.t1, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { color: C.t2, fontSize: 15, marginTop: 6 },
  form: { gap: 0 },
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: { color: '#fca5a5', fontSize: 14 },
  row: { flexDirection: 'row', gap: 12, marginBottom: 0 },
  half: { flex: 1 },
  label: { color: C.t2, fontSize: 13, fontWeight: '500', marginBottom: 8, letterSpacing: 0.2 },
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
  inputFocused: { borderColor: C.accentBorder, backgroundColor: C.elevated },
  button: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.2 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: C.t2, fontSize: 14 },
  footerLink: { color: C.accent, fontWeight: '600', fontSize: 14 },

  // Name notice modal
  noticeOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  noticeCard: {
    backgroundColor: C.elevated,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 24,
    paddingVertical: 28,
    alignItems: 'center',
  },
  noticeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  noticeIcon: { fontSize: 34 },
  noticeTitle: {
    color: C.t1,
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.4,
    textAlign: 'center',
    marginBottom: 14,
  },
  noticeBody: {
    color: C.t2,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 12,
  },
  noticeStrong: { color: C.t1, fontWeight: '700' },
  noticeExample: {
    alignSelf: 'stretch',
    backgroundColor: C.accentFade,
    borderWidth: 1,
    borderColor: C.accentBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginTop: 6,
  },
  noticeExampleLabel: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  noticeExampleText: { color: C.t1, fontSize: 14, fontWeight: '600' },
  });
}
