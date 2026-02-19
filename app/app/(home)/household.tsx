/**
 * Household setup screen — shown when the user has no household yet.
 * They can create a new one or join one with an invite code.
 */
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from "react-native";
import { router } from "expo-router";
import { useHousehold } from "@/contexts/HouseholdContext";

export default function HouseholdScreen() {
  const { createHousehold, joinHousehold } = useHousehold();
  const [tab, setTab]           = useState<"create" | "join">("create");
  const [hhName, setHhName]     = useState("");
  const [inviteCode, setInvite] = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleCreate() {
    if (!hhName.trim()) { Alert.alert("Enter a household name"); return; }
    setLoading(true);
    const { error } = await createHousehold(hhName.trim());
    setLoading(false);
    if (error) { Alert.alert("Error", error); return; }
    router.replace("/(home)/lists");
  }

  async function handleJoin() {
    if (!inviteCode.trim()) { Alert.alert("Enter an invite code"); return; }
    setLoading(true);
    const { error } = await joinHousehold(inviteCode.trim());
    setLoading(false);
    if (error) { Alert.alert("Error", error); return; }
    router.replace("/(home)/lists");
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.inner}>
        <Text style={styles.title}>Set up your household</Text>
        <Text style={styles.subtitle}>
          Create a new household or join an existing one with an invite code.
        </Text>

        {/* Tab switcher */}
        <View style={styles.tabs}>
          {(["create", "join"] as const).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => setTab(t)}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === "create" ? "Create" : "Join"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {tab === "create" ? (
          <>
            <TextInput
              style={styles.input}
              placeholder="Household name (e.g. The Smiths)"
              placeholderTextColor="#999"
              value={hhName}
              onChangeText={setHhName}
            />
            <TouchableOpacity style={styles.button} onPress={handleCreate} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Creating…" : "Create household"}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              style={[styles.input, { letterSpacing: 4, textTransform: "uppercase" }]}
              placeholder="INVITE CODE"
              placeholderTextColor="#999"
              value={inviteCode}
              onChangeText={setInvite}
              autoCapitalize="characters"
              maxLength={8}
            />
            <TouchableOpacity style={styles.button} onPress={handleJoin} disabled={loading}>
              <Text style={styles.buttonText}>{loading ? "Joining…" : "Join household"}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  inner:     { flex: 1, justifyContent: "center", paddingHorizontal: 32 },
  title:     { fontSize: 26, fontWeight: "700", color: "#1a1a1a", marginBottom: 10 },
  subtitle:  { fontSize: 15, color: "#666", marginBottom: 32, lineHeight: 22 },
  tabs: {
    flexDirection: "row", borderWidth: 1, borderColor: "#e0e0e0",
    borderRadius: 10, marginBottom: 24, overflow: "hidden",
  },
  tab:           { flex: 1, paddingVertical: 12, alignItems: "center", backgroundColor: "#fff" },
  tabActive:     { backgroundColor: "#1a1a1a" },
  tabText:       { fontSize: 15, color: "#666", fontWeight: "500" },
  tabTextActive: { color: "#fff" },
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
});
