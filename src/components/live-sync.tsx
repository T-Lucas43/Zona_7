"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

const liveTables = ["characters", "character_attributes", "character_resources", "character_items", "character_abilities", "character_sheet_settings", "notifications", "message_recipients", "handouts", "handout_access", "media_assets", "game_scenes", "actors", "scene_tokens", "sessions", "session_participants", "live_session_events", "script_run_events", "session_public_state", "roll_requests", "dice_rolls", "encounters"] as const;

export function LiveSync({ campaignId }: { campaignId?: string }) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 120);
    };
    if (!isSupabaseConfigured) {
      return () => clearTimeout(timer);
    }
    const client = createClient();
    let subscription = client.channel(`live-ui:${campaignId ?? "user"}`);
    liveTables.forEach((table) => {
      subscription = subscription.on("postgres_changes", {
        event: "*", schema: "public", table,
        ...(campaignId && !["message_recipients", "notifications", "character_attributes"].includes(table) ? { filter: `campaign_id=eq.${campaignId}` } : {}),
      }, refresh);
    });
    subscription.subscribe();
    return () => { clearTimeout(timer); void client.removeChannel(subscription); };
  }, [campaignId, router]);
  return null;
}
