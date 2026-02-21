/**
 * Single list screen — view items, add/check/delete, and print.
 */
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  TextInput, Alert, ActivityIndicator, Switch, Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, ListItem } from "@/lib/supabase";
import { useHousehold } from "@/contexts/HouseholdContext";
import { useAuth } from "@/contexts/AuthContext";
import { enqueue } from "@/lib/offlineQueue";
import NetInfo from "@react-native-community/netinfo";

export default function ListDetailScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();
  const { household, printer } = useHousehold();
  const { user } = useAuth();

  const [items, setItems]           = useState<ListItem[]>([]);
  const [loading, setLoading]       = useState(true);
  const [newText, setNewText]       = useState("");
  const [adding, setAdding]         = useState(false);
  const [printing, setPrinting]     = useState(false);
  const [printModal, setPrintModal] = useState(false);
  const [clearAfter, setClearAfter] = useState(false);

  const fetchItems = useCallback(async () => {
    const { data } = await supabase
      .from("list_items")
      .select("*")
      .eq("list_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true });
    setItems(data ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchItems();

    const channel = supabase
      .channel(`list-items-${id}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "list_items",
        filter: `list_id=eq.${id}`,
      }, fetchItems)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchItems, id]);

  async function addItem() {
    if (!newText.trim()) return;
    const text = newText.trim();
    const position = items.length;

    const { isConnected } = await NetInfo.fetch();

    // Optimistic update
    const tempItem: ListItem = {
      id: `temp-${Date.now()}`,
      list_id: id,
      text,
      checked: false,
      position,
      created_by: user?.id ?? null,
      created_at: new Date().toISOString(),
    };
    setItems((prev) => [...prev, tempItem]);
    setNewText("");

    if (!isConnected) {
      await enqueue({ type: "ADD_LIST_ITEM", payload: { list_id: id, text, position } });
      return;
    }

    setAdding(true);
    const { error } = await supabase
      .from("list_items")
      .insert({ list_id: id, text, position, created_by: user?.id });
    setAdding(false);

    if (error) {
      Alert.alert("Error", error.message);
      setItems((prev) => prev.filter((i) => i.id !== tempItem.id));
    }
  }

  async function toggleItem(item: ListItem) {
    // Optimistic update
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, checked: !i.checked } : i));

    const { isConnected } = await NetInfo.fetch();
    if (!isConnected) {
      await enqueue({ type: "CHECK_LIST_ITEM", payload: { item_id: item.id, checked: !item.checked } });
      return;
    }

    await supabase.from("list_items").update({ checked: !item.checked }).eq("id", item.id);
  }

  async function deleteItem(item: ListItem) {
    setItems((prev) => prev.filter((i) => i.id !== item.id));
    await supabase.from("list_items").delete().eq("id", item.id);
  }

  async function printList() {
    if (!printer || !household) {
      Alert.alert("No printer", "Add a printer in Settings first.");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Empty list", "Add some items before printing.");
      return;
    }

    setPrinting(true);
    const content = {
      title: name,
      items: items.map((i) => (i.checked ? `[x] ${i.text}` : `[ ] ${i.text}`)),
    };

    const { error } = await supabase.from("print_jobs").insert({
      household_id: household.id,
      printer_id: printer.id,
      type: "list",
      content,
      clear_list_after_print: clearAfter,
      list_id: id,
      created_by: user?.id,
    });

    setPrinting(false);
    setPrintModal(false);

    if (error) { Alert.alert("Error", error.message); return; }

    Alert.alert("Sent to printer", clearAfter ? "The list will be cleared after printing." : "");
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a1a1a" /></View>;
  }

  const unchecked = items.filter((i) => !i.checked);
  const checked   = items.filter((i) => i.checked);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color="#1a1a1a" />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{name}</Text>
        <TouchableOpacity onPress={() => setPrintModal(true)} style={styles.printBtn}>
          <Ionicons name="print-outline" size={22} color="#1a1a1a" />
        </TouchableOpacity>
      </View>

      <FlatList
        data={[...unchecked, ...checked]}
        keyExtractor={(i) => i.id}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.itemRow}>
            <TouchableOpacity onPress={() => toggleItem(item)} style={styles.checkbox}>
              <Ionicons
                name={item.checked ? "checkmark-circle" : "ellipse-outline"}
                size={24}
                color={item.checked ? "#aaa" : "#1a1a1a"}
              />
            </TouchableOpacity>
            <Text style={[styles.itemText, item.checked && styles.itemChecked]}>{item.text}</Text>
            <TouchableOpacity onPress={() => deleteItem(item)} style={styles.deleteBtn}>
              <Ionicons name="close" size={18} color="#ccc" />
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>No items yet — add one below</Text>
          </View>
        }
      />

      {/* Add item input */}
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Add item…"
          placeholderTextColor="#aaa"
          value={newText}
          onChangeText={setNewText}
          onSubmitEditing={addItem}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addItem} disabled={adding}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Print modal */}
      <Modal visible={printModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Print "{name}"</Text>
            <Text style={styles.modalInfo}>{items.length} item{items.length !== 1 ? "s" : ""}</Text>

            <View style={styles.switchRow}>
              <View>
                <Text style={styles.switchLabel}>Clear list after printing</Text>
                <Text style={styles.switchHint}>Removes all items once printed</Text>
              </View>
              <Switch
                value={clearAfter}
                onValueChange={setClearAfter}
                trackColor={{ true: "#1a1a1a" }}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setPrintModal(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.printConfirmBtn} onPress={printList} disabled={printing}>
                <Ionicons name="print-outline" size={18} color="#fff" style={{ marginRight: 6 }} />
                <Text style={styles.printConfirmText}>{printing ? "Sending…" : "Print"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:       { flex: 1, backgroundColor: "#fff" },
  center:          { flex: 1, justifyContent: "center", alignItems: "center" },
  header:          { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  backBtn:         { padding: 4, marginRight: 8 },
  title:           { flex: 1, fontSize: 22, fontWeight: "700", color: "#1a1a1a" },
  printBtn:        { padding: 8 },
  listContent:     { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 100 },
  itemRow:         { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#f8f8f8" },
  checkbox:        { marginRight: 12 },
  itemText:        { flex: 1, fontSize: 16, color: "#1a1a1a" },
  itemChecked:     { textDecorationLine: "line-through", color: "#aaa" },
  deleteBtn:       { padding: 4 },
  empty:           { paddingTop: 40, alignItems: "center" },
  emptyText:       { color: "#bbb", fontSize: 15 },
  inputRow:        { flexDirection: "row", padding: 16, borderTopWidth: 1, borderTopColor: "#f0f0f0", backgroundColor: "#fff" },
  input:           { flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, color: "#1a1a1a", marginRight: 10 },
  addBtn:          { backgroundColor: "#1a1a1a", borderRadius: 10, width: 46, justifyContent: "center", alignItems: "center" },
  modalOverlay:    { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:       { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:      { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  modalInfo:       { fontSize: 14, color: "#888", marginBottom: 24 },
  switchRow:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderTopWidth: 1, borderTopColor: "#f0f0f0", marginBottom: 24 },
  switchLabel:     { fontSize: 16, color: "#1a1a1a", fontWeight: "500" },
  switchHint:      { fontSize: 13, color: "#888", marginTop: 2 },
  modalActions:    { flexDirection: "row", gap: 12 },
  cancelBtn:       { flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  cancelText:      { color: "#666", fontSize: 16 },
  printConfirmBtn: { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 14, alignItems: "center", flexDirection: "row", justifyContent: "center" },
  printConfirmText:{ color: "#fff", fontSize: 16, fontWeight: "600" },
});
