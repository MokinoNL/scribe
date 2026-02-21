/**
 * Messages screen — type a message and send it directly to the printer.
 * Great for leaving a note for people at home, or a reminder for yourself.
 */
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useAuth } from "@/contexts/AuthContext";

const MAX_CHARS = 300;

// Quick message templates
const TEMPLATES = [
  { label: "Be home soon", icon: "home-outline" },
  { label: "Out of milk 🥛", icon: "cart-outline" },
  { label: "Call me!", icon: "call-outline" },
  { label: "Don't forget the keys!", icon: "key-outline" },
];

export default function MessagesScreen() {
  const { household, printer } = useHousehold();
  const { user } = useAuth();
  const [message, setMessage]   = useState("");
  const [sending, setSending]   = useState(false);
  const [lastSent, setLastSent] = useState<string | null>(null);

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;

    if (!printer || !household) {
      Alert.alert("No printer", "Add a printer in Settings before sending messages.");
      return;
    }

    setSending(true);
    const { error } = await supabase.from("print_jobs").insert({
      household_id: household.id,
      printer_id: printer.id,
      type: "message",
      content: { message: trimmed },
      clear_list_after_print: false,
      created_by: user?.id,
    });
    setSending(false);

    if (error) { Alert.alert("Error", error.message); return; }

    setLastSent(trimmed);
    setMessage("");
    Alert.alert("Sent!", "Your message is on its way to the printer.");
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        <Text style={styles.title}>Send a message</Text>
        <Text style={styles.subtitle}>
          Leave a note at home or send yourself a reminder — printed instantly.
        </Text>

        {/* Quick templates */}
        <Text style={styles.sectionLabel}>Quick messages</Text>
        <View style={styles.templates}>
          {TEMPLATES.map((t) => (
            <TouchableOpacity
              key={t.label}
              style={styles.templateBtn}
              onPress={() => sendMessage(t.label)}
            >
              <Ionicons name={t.icon as any} size={16} color="#666" style={{ marginRight: 6 }} />
              <Text style={styles.templateText}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Custom message */}
        <Text style={styles.sectionLabel}>Custom message</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Type your message here…"
            placeholderTextColor="#aaa"
            value={message}
            onChangeText={(t) => t.length <= MAX_CHARS && setMessage(t)}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{message.length}/{MAX_CHARS}</Text>
        </View>

        <TouchableOpacity
          style={[styles.sendBtn, (!message.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(message)}
          disabled={!message.trim() || sending}
        >
          <Ionicons name="print-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.sendText}>{sending ? "Sending…" : "Print message"}</Text>
        </TouchableOpacity>

        {lastSent && (
          <View style={styles.lastSentBox}>
            <Ionicons name="checkmark-circle" size={16} color="#4caf50" style={{ marginRight: 6 }} />
            <Text style={styles.lastSentText} numberOfLines={2}>Last sent: "{lastSent}"</Text>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: "#fff" },
  scroll:         { padding: 24, paddingTop: 64 },
  title:          { fontSize: 28, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  subtitle:       { fontSize: 15, color: "#666", marginBottom: 32, lineHeight: 22 },
  sectionLabel:   { fontSize: 13, fontWeight: "600", color: "#888", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },
  templates:      { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 32 },
  templateBtn:    { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  templateText:   { fontSize: 14, color: "#444" },
  inputWrapper:   { marginBottom: 16 },
  input: {
    borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 12,
    padding: 16, fontSize: 16, color: "#1a1a1a",
    minHeight: 120,
  },
  charCount:      { alignSelf: "flex-end", fontSize: 12, color: "#bbb", marginTop: 6 },
  sendBtn: {
    backgroundColor: "#1a1a1a", borderRadius: 12,
    paddingVertical: 16, flexDirection: "row",
    justifyContent: "center", alignItems: "center",
  },
  sendBtnDisabled: { backgroundColor: "#ccc" },
  sendText:       { color: "#fff", fontSize: 16, fontWeight: "600" },
  lastSentBox:    { flexDirection: "row", alignItems: "center", marginTop: 20, padding: 14, backgroundColor: "#f6fff6", borderRadius: 10 },
  lastSentText:   { flex: 1, fontSize: 14, color: "#444" },
});
