import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, Alert,
} from "react-native";
import { router, Link } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert("Fill in all fields"); return; }
    setLoading(true);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);
    if (error) { Alert.alert("Login failed", error); return; }
    router.replace("/");
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.logo}>Scribe</Text>
        <Text style={styles.tagline}>Your household printer, in your pocket.</Text>

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

        <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? "Signing in…" : "Sign in"}</Text>
        </TouchableOpacity>

        <Link href="/(auth)/register" asChild>
          <TouchableOpacity style={styles.link}>
            <Text style={styles.linkText}>No account yet? <Text style={styles.linkBold}>Create one</Text></Text>
          </TouchableOpacity>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner:     { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  logo:      { fontSize: 40, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  tagline:   { fontSize: 15, color: "#666", marginBottom: 40 },
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
