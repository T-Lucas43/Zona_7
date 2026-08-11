import { createAdminClient } from "@/lib/supabase/admin";
import { isAdminConfigured } from "@/lib/config";

export async function processDueEvents() {
  if (!isAdminConfigured) return { processed: 0, demo: true };
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("process_due_events", { p_limit: 100 });
  if (error) throw new Error(error.message);
  return { processed: Array.isArray(data) ? data.length : Number(data ?? 0), demo: false };
}
