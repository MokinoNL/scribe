import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl  = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnon, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// ── Types ────────────────────────────────────────────────────────────────────

export type Household = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

export type HouseholdMember = {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  joined_at: string;
};

export type Printer = {
  id: string;
  household_id: string;
  name: string;
  api_key: string;
  last_seen: string | null;
  created_at: string;
};

export type List = {
  id: string;
  household_id: string;
  name: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ListItem = {
  id: string;
  list_id: string;
  text: string;
  checked: boolean;
  position: number;
  created_by: string | null;
  created_at: string;
};

export type PrintJob = {
  id: string;
  household_id: string;
  printer_id: string;
  type: "list" | "message";
  content: {
    title?: string;
    items?: string[];
    message?: string;
  };
  clear_list_after_print: boolean;
  list_id: string | null;
  status: "pending" | "printing" | "done" | "failed";
  created_by: string | null;
  created_at: string;
  printed_at: string | null;
};
