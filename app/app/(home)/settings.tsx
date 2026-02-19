/**
 * Settings screen — household info, invite code, printer setup, sign out.
 */
import { useState } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, ScrollView, TextInput, Modal, Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useHousehold } from "@/contexts/HouseholdContext";

export default function SettingsScreen() {
  const { user, signOut }                      = useAuth();
  const { household, printer, addPrinter, refresh } = useHousehold();
  const [printerModal, setPrinterModal]        = useState(false);
  const [printerName, setPrinterName]          = useState("Scribe Printer");
  const [creating, setCreating]                = useState(false);

  async function handleSignOut() {
    Alert.alert("Sign out", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out", style: "destructive",
        onPress: async () => { await signOut(); router.replace("/(auth)/login"); },
      },
    ]);
  }

  async function handleAddPrinter() {
    setCreating(true);
    const { printer: pr, error } = await addPrinter(printerName.trim() || "Scribe Printer");
    setCreating(false);

    if (error) { Alert.alert("Error", error); return; }

    setPrinterModal(false);

    // Show the API key — they need to flash it into the firmware
    Alert.alert(
      "Printer added",
      `Copy these values into your firmware:\n\nPrinter ID:\n${pr!.id}\n\nAPI Key:\n${pr!.api_key}`,
      [{ text: "OK" }],
    );
  }

  async function shareInvite() {
    if (!household) return;
    await Share.share({
      message: `Join my Scribe household "${household.name}"!\nInvite code: ${household.invite_code}`,
    });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Settings</Text>

      {/* Account */}
      <Section label="Account">
        <Row icon="person-outline" label="Email" value={user?.email ?? ""} />
        <Divider />
        <TouchableOpacity style={styles.row} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#e53935" style={styles.rowIcon} />
          <Text style={[styles.rowLabel, { color: "#e53935" }]}>Sign out</Text>
        </TouchableOpacity>
      </Section>

      {/* Household */}
      {household && (
        <Section label="Household">
          <Row icon="home-outline" label="Name" value={household.name} />
          <Divider />
          <TouchableOpacity style={styles.row} onPress={shareInvite}>
            <Ionicons name="share-outline" size={20} color="#1a1a1a" style={styles.rowIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Invite code</Text>
              <Text style={styles.rowValue}>{household.invite_code}</Text>
            </View>
            <Ionicons name="share-social-outline" size={18} color="#aaa" />
          </TouchableOpacity>
        </Section>
      )}

      {/* Printer */}
      <Section label="Printer">
        {printer ? (
          <>
            <Row icon="print-outline" label="Name" value={printer.name} />
            <Divider />
            <Row
              icon="time-outline"
              label="Last seen"
              value={printer.last_seen
                ? new Date(printer.last_seen).toLocaleString()
                : "Never"}
            />
            <Divider />
            <TouchableOpacity
              style={styles.row}
              onPress={() => Alert.alert(
                "Printer credentials",
                `Printer ID:\n${printer.id}\n\nAPI Key:\n${printer.api_key}`,
              )}
            >
              <Ionicons name="key-outline" size={20} color="#1a1a1a" style={styles.rowIcon} />
              <Text style={styles.rowLabel}>View credentials</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.row} onPress={() => setPrinterModal(true)}>
            <Ionicons name="add-circle-outline" size={20} color="#1a1a1a" style={styles.rowIcon} />
            <Text style={styles.rowLabel}>Add printer</Text>
            <Ionicons name="chevron-forward" size={18} color="#ccc" />
          </TouchableOpacity>
        )}
      </Section>

      {/* About */}
      <Section label="About">
        <Row icon="information-circle-outline" label="Version" value="1.0.0" />
      </Section>

      {/* Add printer modal */}
      <Modal visible={printerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add printer</Text>
            <Text style={styles.modalHint}>
              Give your printer a name. You'll get an ID and API key to flash into the firmware.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Printer name"
              placeholderTextColor="#999"
              value={printerName}
              onChangeText={setPrinterName}
              autoFocus
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPrinterModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={handleAddPrinter} disabled={creating}>
                <Text style={styles.createText}>{creating ? "Adding…" : "Add"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionLabel}>{label.toUpperCase()}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function Row({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Ionicons name={icon as any} size={20} color="#1a1a1a" style={styles.rowIcon} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={1}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#f5f5f5" },
  content:      { padding: 20, paddingTop: 64, paddingBottom: 40 },
  title:        { fontSize: 28, fontWeight: "700", color: "#1a1a1a", marginBottom: 24 },
  section:      { marginBottom: 24 },
  sectionLabel: { fontSize: 12, fontWeight: "600", color: "#888", letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  card:         { backgroundColor: "#fff", borderRadius: 14, overflow: "hidden" },
  row:          { flexDirection: "row", alignItems: "center", padding: 16 },
  rowIcon:      { marginRight: 12, width: 22 },
  rowLabel:     { flex: 1, fontSize: 16, color: "#1a1a1a" },
  rowValue:     { fontSize: 14, color: "#888", maxWidth: 160 },
  divider:      { height: 1, backgroundColor: "#f0f0f0", marginLeft: 50 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:   { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 8 },
  modalHint:    { fontSize: 14, color: "#888", marginBottom: 20, lineHeight: 20 },
  modalInput:   { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#1a1a1a", marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  cancelText:   { color: "#666", fontSize: 16 },
  createBtn:    { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  createText:   { color: "#fff", fontSize: 16, fontWeight: "600" },
});
