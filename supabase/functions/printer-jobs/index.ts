/**
 * Supabase Edge Function: printer-jobs
 *
 * Called by the ESP8266 printer firmware to:
 *   GET  ?printer_id=xxx&api_key=yyy  → return next pending job (or null)
 *   POST { job_id, status }           → mark job done/failed
 *
 * Uses the service role key internally so the printer doesn't need a user JWT.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);

  // ── GET: fetch next pending job ────────────────────────────────────────────
  if (req.method === "GET") {
    const printerId = url.searchParams.get("printer_id");
    const apiKey    = url.searchParams.get("api_key");

    if (!printerId || !apiKey) {
      return json({ error: "printer_id and api_key required" }, 400);
    }

    // Verify the API key belongs to this printer
    const { data: printer, error: printerErr } = await supabase
      .from("printers")
      .select("id, household_id")
      .eq("id", printerId)
      .eq("api_key", apiKey)
      .single();

    if (printerErr || !printer) {
      return json({ error: "invalid credentials" }, 401);
    }

    // Update last_seen
    await supabase
      .from("printers")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", printerId);

    // Fetch oldest pending job for this printer
    const { data: job, error: jobErr } = await supabase
      .from("print_jobs")
      .select("id, type, content, clear_list_after_print, list_id")
      .eq("printer_id", printerId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (jobErr) {
      return json({ error: jobErr.message }, 500);
    }

    if (!job) {
      return json({ job: null });
    }

    // Mark as printing so it isn't picked up twice
    await supabase
      .from("print_jobs")
      .update({ status: "printing" })
      .eq("id", job.id);

    return json({ job });
  }

  // ── POST: mark job done or failed ─────────────────────────────────────────
  if (req.method === "POST") {
    const apiKey = url.searchParams.get("api_key");
    const body   = await req.json().catch(() => ({}));
    const { job_id, status } = body;

    if (!job_id || !status || !apiKey) {
      return json({ error: "job_id, status, and api_key required" }, 400);
    }
    if (!["done", "failed"].includes(status)) {
      return json({ error: "status must be 'done' or 'failed'" }, 400);
    }

    // Verify the API key is valid for the printer that owns this job
    const { data: job, error: jobErr } = await supabase
      .from("print_jobs")
      .select("id, list_id, clear_list_after_print, printer_id")
      .eq("id", job_id)
      .single();

    if (jobErr || !job) {
      return json({ error: "job not found" }, 404);
    }

    const { data: printer, error: printerErr } = await supabase
      .from("printers")
      .select("id")
      .eq("id", job.printer_id)
      .eq("api_key", apiKey)
      .single();

    if (printerErr || !printer) {
      return json({ error: "invalid credentials" }, 401);
    }

    // Update job status
    await supabase
      .from("print_jobs")
      .update({ status, printed_at: new Date().toISOString() })
      .eq("id", job_id);

    // If the job was a list print and the user chose to clear it, delete all items
    if (status === "done" && job.clear_list_after_print && job.list_id) {
      await supabase
        .from("list_items")
        .delete()
        .eq("list_id", job.list_id);
    }

    return json({ ok: true });
  }

  return json({ error: "method not allowed" }, 405);
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
