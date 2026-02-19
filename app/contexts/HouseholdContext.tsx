import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase, Household, Printer } from "@/lib/supabase";
import { useAuth } from "./AuthContext";

type HouseholdContextValue = {
  household: Household | null;
  printer: Printer | null;
  loading: boolean;
  refresh: () => Promise<void>;
  createHousehold: (name: string) => Promise<{ error: string | null }>;
  joinHousehold: (inviteCode: string) => Promise<{ error: string | null }>;
  addPrinter: (name: string) => Promise<{ printer: Printer | null; error: string | null }>;
};

const HouseholdContext = createContext<HouseholdContextValue | null>(null);

export function HouseholdProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [household, setHousehold] = useState<Household | null>(null);
  const [printer, setPrinter]     = useState<Printer | null>(null);
  const [loading, setLoading]     = useState(true);

  const refresh = useCallback(async () => {
    if (!user) { setHousehold(null); setPrinter(null); setLoading(false); return; }

    setLoading(true);

    // Find the household this user belongs to
    const { data: member } = await supabase
      .from("household_members")
      .select("household_id")
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (!member) { setHousehold(null); setPrinter(null); setLoading(false); return; }

    const [{ data: hh }, { data: pr }] = await Promise.all([
      supabase.from("households").select("*").eq("id", member.household_id).single(),
      supabase.from("printers").select("*").eq("household_id", member.household_id).maybeSingle(),
    ]);

    setHousehold(hh ?? null);
    setPrinter(pr ?? null);
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  async function createHousehold(name: string) {
    if (!user) return { error: "Not logged in" };

    const { data: hh, error: hhErr } = await supabase
      .from("households")
      .insert({ name })
      .select()
      .single();

    if (hhErr || !hh) return { error: hhErr?.message ?? "Failed to create household" };

    const { error: memErr } = await supabase
      .from("household_members")
      .insert({ household_id: hh.id, user_id: user.id, role: "owner" });

    if (memErr) return { error: memErr.message };

    await refresh();
    return { error: null };
  }

  async function joinHousehold(inviteCode: string) {
    if (!user) return { error: "Not logged in" };

    const { data: hh, error: hhErr } = await supabase
      .from("households")
      .select("id")
      .eq("invite_code", inviteCode.toUpperCase())
      .single();

    if (hhErr || !hh) return { error: "Invite code not found" };

    const { error: memErr } = await supabase
      .from("household_members")
      .insert({ household_id: hh.id, user_id: user.id, role: "member" });

    if (memErr) {
      if (memErr.code === "23505") return { error: "You are already in this household" };
      return { error: memErr.message };
    }

    await refresh();
    return { error: null };
  }

  async function addPrinter(name: string) {
    if (!household) return { printer: null, error: "No household" };

    const { data: pr, error } = await supabase
      .from("printers")
      .insert({ household_id: household.id, name })
      .select()
      .single();

    if (error || !pr) return { printer: null, error: error?.message ?? "Failed to add printer" };

    setPrinter(pr);
    return { printer: pr, error: null };
  }

  return (
    <HouseholdContext.Provider value={{ household, printer, loading, refresh, createHousehold, joinHousehold, addPrinter }}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold() {
  const ctx = useContext(HouseholdContext);
  if (!ctx) throw new Error("useHousehold must be used inside HouseholdProvider");
  return ctx;
}
