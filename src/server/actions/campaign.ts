"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export async function acknowledgeNotificationAction(notificationId: string) {
  const user = await requireUser("/app", "player");
  if (!isSupabaseConfigured || user.demo) return { ok: true, demo: true };
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ acknowledged_at: new Date().toISOString() })
    .eq("id", notificationId)
    .eq("user_id", user.id);
  if (error) throw new Error("Não foi possível reconhecer o alerta.");
  revalidatePath("/app");
  return { ok: true };
}
