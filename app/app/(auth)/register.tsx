import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { router, Link } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleRegister() {
    if (!email || !password || !confirm) { Alert.alert("Fill in all fields"); return; }
    if (password !== confirm) { Alert.alert("Passwords don't match"); return; }
    if (password.length < 8)  { Alert.alert("Password must be at least 8 characters"); return; }

    setLoading(true);
    const { error } = await signUp(email.trim(), password);
    setLoading(false);

    if (error) { Alert.alert("Registration failed", error); return; }

    Alert.alert(
      "Check your email",
      "We sent you a confirmation link. Click it then come back to sign in.",
      [{ text: "OK", onPress: () => router.replace("/(auth)/login") }],
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Create account</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#999"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#999"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={styles.input}
          placeholder="Confirm password"
          placeholderTextColor="#999"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleRegister} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Creating account…" : "Create account"}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/login" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>Already have an account? <Text style={styles.linkBold}>Sign in</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner:     { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  title:     { fontSize: 28, fontWeight: "700", color: "#1a1a1a", marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16,
    marginBottom: 12, color: "#1a1a1a",
  },
  button: {
    backgroundColor: "#1a1a1a", borderRadius: 10,
    paddingVertical: 16, alignItems: "center", marginTop: 4,
  },
  buttonText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  link:       { marginTop: 24, alignItems: "center" },
  linkText:   { color: "#666", fontSize: 15 },
  linkBold:   { color: "#1a1a1a", fontWeight: "600" },
});
