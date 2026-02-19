/**
 * Lists overview — shows all lists for the household.
 * Users can create new lists and tap one to open it.
 */
import { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, Alert, TextInput, Modal,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { supabase, List } from "@/lib/supabase";
import { useHousehold } from "@/contexts/HouseholdContext";

export default function ListsScreen() {
  const { household } = useHousehold();
  const [lists, setLists]         = useState<List[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefresh]  = useState(false);
  const [modalVisible, setModal]  = useState(false);
  const [newName, setNewName]     = useState("");
  const [creating, setCreating]   = useState(false);

  const fetchLists = useCallback(async () => {
    if (!household) return;
    const { data } = await supabase
      .from("lists")
      .select("*")
      .eq("household_id", household.id)
      .order("updated_at", { ascending: false });
    setLists(data ?? []);
    setLoading(false);
    setRefresh(false);
  }, [household]);

  useEffect(() => {
    fetchLists();

    if (!household) return;

    // Real-time subscription for collaborative updates
    const channel = supabase
      .channel("lists-changes")
      .on("postgres_changes", {
        event: "*", schema: "public", table: "lists",
        filter: `household_id=eq.${household.id}`,
      }, fetchLists)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchLists, household]);

  async function createList() {
    if (!newName.trim() || !household) return;
    setCreating(true);
    const { error } = await supabase
      .from("lists")
      .insert({ household_id: household.id, name: newName.trim() });
    setCreating(false);
    if (error) { Alert.alert("Error", error.message); return; }
    setNewName("");
    setModal(false);
  }

  async function deleteList(list: List) {
    Alert.alert("Delete list", `Delete "${list.name}"? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          await supabase.from("lists").delete().eq("id", list.id);
        },
      },
    ]);
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#1a1a1a" /></View>;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Lists</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setModal(true)}>
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {lists.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="list-outline" size={56} color="#ccc" />
          <Text style={styles.emptyText}>No lists yet</Text>
          <Text style={styles.emptyHint}>Tap + to create your first list</Text>
        </View>
      ) : (
        <FlatList
          data={lists}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefresh(true); fetchLists(); }} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.listRow}
              onPress={() => router.push({ pathname: "/(home)/list/[id]", params: { id: item.id, name: item.name } })}
              onLongPress={() => deleteList(item)}
            >
              <Ionicons name="list-outline" size={20} color="#666" style={styles.rowIcon} />
              <Text style={styles.listName}>{item.name}</Text>
              <Ionicons name="chevron-forward" size={18} color="#ccc" />
            </TouchableOpacity>
          )}
        />
      )}

      {/* Create list modal */}
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New list</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="List name (e.g. Groceries)"
              placeholderTextColor="#999"
              value={newName}
              onChangeText={setNewName}
              autoFocus
              onSubmitEditing={createList}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setModal(false); setNewName(""); }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.createBtn} onPress={createList} disabled={creating}>
                <Text style={styles.createText}>{creating ? "Creating…" : "Create"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container:    { flex: 1, backgroundColor: "#fff" },
  center:       { flex: 1, justifyContent: "center", alignItems: "center" },
  header:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingTop: 60, paddingBottom: 16 },
  title:        { fontSize: 28, fontWeight: "700", color: "#1a1a1a" },
  addBtn:       { backgroundColor: "#1a1a1a", borderRadius: 20, width: 40, height: 40, justifyContent: "center", alignItems: "center" },
  listContent:  { paddingHorizontal: 20 },
  listRow:      { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  rowIcon:      { marginRight: 12 },
  listName:     { flex: 1, fontSize: 17, color: "#1a1a1a" },
  empty:        { flex: 1, justifyContent: "center", alignItems: "center", paddingBottom: 80 },
  emptyText:    { fontSize: 18, color: "#aaa", marginTop: 16, fontWeight: "500" },
  emptyHint:    { fontSize: 14, color: "#ccc", marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalCard:    { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle:   { fontSize: 20, fontWeight: "700", color: "#1a1a1a", marginBottom: 16 },
  modalInput:   { borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#1a1a1a", marginBottom: 16 },
  modalActions: { flexDirection: "row", gap: 12 },
  cancelBtn:    { flex: 1, borderWidth: 1, borderColor: "#e0e0e0", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  cancelText:   { color: "#666", fontSize: 16 },
  createBtn:    { flex: 1, backgroundColor: "#1a1a1a", borderRadius: 10, paddingVertical: 14, alignItems: "center" },
  createText:   { color: "#fff", fontSize: 16, fontWeight: "600" },
});
