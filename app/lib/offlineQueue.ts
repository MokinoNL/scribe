/**
 * Offline queue — persists actions locally when the device has no internet,
 * then replays them once connectivity is restored.
 *
 * Format of each queued action:
 *   { id, type, payload, createdAt }
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

const QUEUE_KEY = "scribe_offline_queue";

export type QueuedAction =
  | { type: "ADD_LIST_ITEM";    payload: { list_id: string; text: string; position: number } }
  | { type: "CHECK_LIST_ITEM";  payload: { item_id: string; checked: boolean } }
  | { type: "DELETE_LIST_ITEM"; payload: { item_id: string } }
  | { type: "ADD_LIST";         payload: { household_id: string; name: string; temp_id: string } };

type StoredAction = QueuedAction & { id: string; createdAt: string };

export async function enqueue(action: QueuedAction): Promise<void> {
  const queue = await getQueue();
  const entry: StoredAction = {
    ...action,
    id: Math.random().toString(36).slice(2),
    createdAt: new Date().toISOString(),
  };
  queue.push(entry);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export async function getQueue(): Promise<StoredAction[]> {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function clearQueue(): Promise<void> {
  await AsyncStorage.removeItem(QUEUE_KEY);
}

export async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const updated = queue.filter((a) => a.id !== id);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(updated));
}
