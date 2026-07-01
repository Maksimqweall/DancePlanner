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
import { Link } from "expo-router";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";
import GradientButton from "../../components/ui/GradientButton";
import AppBackground from "../../components/ui/AppBackground";
import type { Palette } from "../../lib/theme";
import { useC } from "../../lib/useTheme";
import Svg, { Path, Circle, Defs, RadialGradient, Stop, Ellipse } from "react-native-svg";

function LogoMark() {
  const C = useC();
  return (
    <Svg width={64} height={64} viewBox="0 0 64 64" fill="none">
      <Circle cx="32" cy="32" r="32" fill={C.accentFade} />
      <Path
        d="M20 44L28 20H36L44 44H38L36 38H28L26 44H20ZM30 26L28.5 34H35.5L34 26H30Z"
        fill={C.accent}
      />
    </Svg>
  );
}

export default function Login() {
  const C = useC();
  const styles = useMemo(() => makeStyles(C), [C]);
  const login = useAuthStore((st) => st.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  const onSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      await login(email.trim(), password);
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
      <AppBackground />
      <View style={styles.inner}>
        {/* Logo / hero */}
        <Animated.View entering={FadeInDown.delay(75).springify().damping(16).stiffness(140)} style={styles.hero}>
          <LogoMark />
          <Text style={styles.appName}>DancePlanner</Text>
          <Text style={styles.tagline}>Manage your dancesport finances</Text>
        </Animated.View>

        {/* Form */}
        <Animated.View entering={FadeInUp.delay(150).duration(500)} style={styles.form}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={[styles.input, emailFocused && styles.inputFocused]}
            placeholder="you@example.com"
            placeholderTextColor={C.t3}
            autoCapitalize="none"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
          />

          <Text style={[styles.label, { marginTop: 4 }]}>Password</Text>
          <TextInput
            style={[styles.input, passwordFocused && styles.inputFocused]}
            placeholder="••••••••"
            placeholderTextColor={C.t3}
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
          />

          <GradientButton onPress={onSubmit} disabled={submitting} style={{ marginTop: 8 }}>
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Sign in</Text>
            )}
          </GradientButton>

          <View style={styles.forgotRow}>
            <Link href="/forgot-password" style={styles.forgotLink}>Forgot password?</Link>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>No account? </Text>
            <Link href="/signup" style={styles.footerLink}>Create one</Link>
          </View>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(C: Palette) {
  return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  inner: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  hero: {
    alignItems: 'center',
    marginBottom: 44,
  },
  appName: {
    color: C.t1,
    fontSize: 32,
    fontWeight: '900',
    marginTop: 16,
    letterSpacing: -0.6,
  },
  tagline: {
    color: C.t2,
    fontSize: 15,
    fontWeight: '300',
    marginTop: 6,
    textAlign: 'center',
  },
  form: {
    gap: 0,
  },
  errorBox: {
    backgroundColor: C.redFade,
    borderWidth: 1,
    borderColor: C.red,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  errorText: {
    color: '#fca5a5',
    fontSize: 14,
  },
  label: {
    color: C.t2,
    fontSize: 13,
    fontWeight: '500',
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
  inputFocused: {
    borderColor: C.accentBorder,
    backgroundColor: C.elevated,
  },
  button: {
    backgroundColor: C.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.2,
  },
  forgotRow: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotLink: {
    color: C.t3,
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 20,
  },
  footerText: {
    color: C.t2,
    fontSize: 14,
  },
  footerLink: {
    color: C.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  });
}
