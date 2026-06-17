import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";

export default function Login() {
  const login = useAuthStore((s) => s.login);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      className="flex-1 bg-zinc-900"
    >
      <View className="flex-1 justify-center px-6">
        <Text className="text-4xl text-white font-bold mb-2">DancePlanner</Text>
        <Text className="text-zinc-400 mb-8">Sign in to manage your finances</Text>

        {error ? (
          <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
            <Text className="text-red-300">{error}</Text>
          </View>
        ) : null}

        <Text className="text-zinc-400 mb-1">Email</Text>
        <TextInput
          className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
          placeholder="you@example.com"
          placeholderTextColor="#71717a"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />

        <Text className="text-zinc-400 mb-1">Password</Text>
        <TextInput
          className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-6"
          placeholder="••••••••"
          placeholderTextColor="#71717a"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          className="bg-emerald-500 rounded-xl py-4 items-center"
          onPress={onSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white font-bold text-base">Sign in</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-zinc-400">No account? </Text>
          <Link href="/signup" className="text-emerald-400 font-semibold">
            Create one
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
