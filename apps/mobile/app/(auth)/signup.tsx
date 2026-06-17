import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { Link } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { ApiError } from "../../lib/api";

export default function Signup() {
  const signup = useAuthStore((s) => s.signup);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
      className="flex-1 bg-zinc-900"
    >
      <ScrollView contentContainerClassName="flex-grow justify-center px-6 py-12">
        <Text className="text-4xl text-white font-bold mb-2">Create account</Text>
        <Text className="text-zinc-400 mb-8">Start tracking your dancesport budget</Text>

        {error ? (
          <View className="bg-red-500/20 border border-red-500 rounded-xl p-3 mb-4">
            <Text className="text-red-300">{error}</Text>
          </View>
        ) : null}

        <View className="flex-row gap-3">
          <View className="flex-1">
            <Text className="text-zinc-400 mb-1">First name</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="Jane"
              placeholderTextColor="#71717a"
              value={firstName}
              onChangeText={setFirstName}
            />
          </View>
          <View className="flex-1">
            <Text className="text-zinc-400 mb-1">Last name</Text>
            <TextInput
              className="bg-zinc-800 text-white rounded-xl px-4 py-3 mb-4"
              placeholder="Doe"
              placeholderTextColor="#71717a"
              value={lastName}
              onChangeText={setLastName}
            />
          </View>
        </View>

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
          placeholder="At least 6 characters"
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
            <Text className="text-white font-bold text-base">Create account</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-zinc-400">Already have an account? </Text>
          <Link href="/login" className="text-emerald-400 font-semibold">
            Sign in
          </Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
