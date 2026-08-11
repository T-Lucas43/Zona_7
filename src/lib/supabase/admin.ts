import { createClient } from "@supabase/supabase-js";
import { appConfig } from "@/lib/config";

export function createAdminClient() {
  if (!appConfig.supabaseUrl || !appConfig.serviceRoleKey) {
    throw new Error("Credenciais server-only do Supabase não configuradas.");
  }
  return createClient(appConfig.supabaseUrl, appConfig.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
