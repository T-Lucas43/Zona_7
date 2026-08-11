import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

const masterRoles = ["campaign_owner", "game_master", "co_master"];

export async function requireCampaignMaster(campaignId: string) {
  const user = await getCurrentUser("master");
  if (!user) throw new Error("Não autenticado.");
  if (user.demo || user.role === "platform_admin") return user;

  if (!isSupabaseConfigured) return user;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_members")
    .select("role,status")
    .eq("campaign_id", campaignId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data || data.status !== "active" || !masterRoles.includes(data.role)) {
    throw new Error("Acesso restrito ao mestre da campanha.");
  }
  return user;
}
