import { createClient } from "@supabase/supabase-js";

import { getServerConfig } from "./config.server";

// Server-only Supabase client (service role key never reaches the browser —
// this file has the .server.ts suffix so Vite excludes it from the client bundle).
// Returns null when the project isn't configured yet, so callers can no-op
// gracefully instead of crashing the demo before Supabase is wired up.
export function getSupabaseServerClient() {
  const { supabaseUrl, supabaseServiceRoleKey } = getServerConfig();
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  return createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });
}
