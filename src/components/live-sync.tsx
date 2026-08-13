"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

const liveTables = [
  "characters",
  "character_attributes",
  "character_resources",
  "character_items",
  "character_abilities",
  "character_sheet_settings",
  "message_recipients",
  "handouts",
  "handout_access",
  "items",
  "investigation_board_items",
  "investigation_board_connections",
  "player_notebook_pages",
  "media_assets",
  "game_scenes",
  "actors",
  "scene_tokens",
  "sessions",
  "session_participants",
  "live_sessions",
  "live_session_events",
  "script_run_events",
  "session_public_state",
  "script_packages",
  "script_versions",
  "roll_requests",
  "dice_rolls",
  "encounters",
  "encounter_combatants",
  "audit_events",
  "session_summaries",
  "scene_reveal_states",
  "rule_change_log",
] as const;

export function LiveSync({
  campaignId,
  fallbackIntervalMs = 5_000,
}: {
  campaignId?: string;
  fallbackIntervalMs?: number;
}) {
  const router = useRouter();
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let subscription: ReturnType<ReturnType<typeof createClient>["channel"]> | undefined;
    let disposed = false;
    const refresh = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        startTransition(() => router.refresh());
      }, 120);
    };
    if (!isSupabaseConfigured) {
      return () => clearTimeout(timer);
    }
    const client = createClient();
    const connect = () => {
      if (disposed || subscription) return;
      let next = client.channel(`live-ui:${campaignId ?? "user"}:${crypto.randomUUID()}`);
      liveTables.forEach((table) => {
        next = next.on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table,
            ...(campaignId && table !== "character_attributes"
              ? { filter: `campaign_id=eq.${campaignId}` }
              : {}),
          },
          refresh,
        );
      });
      subscription = next;
      next.subscribe((status) => {
        if (
          !disposed &&
          (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") &&
          subscription === next
        ) {
          subscription = undefined;
          void client.removeChannel(next);
          clearTimeout(retryTimer);
          retryTimer = setTimeout(connect, 1_500);
        }
      });
    };
    connect();
    const recover = () => {
      if (document.visibilityState === "visible") {
        refresh();
        if (!subscription) connect();
      }
    };
    const fallback = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, fallbackIntervalMs);
    window.addEventListener("online", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(retryTimer);
      window.clearInterval(fallback);
      window.removeEventListener("online", recover);
      document.removeEventListener("visibilitychange", recover);
      if (subscription) void client.removeChannel(subscription);
    };
  }, [campaignId, fallbackIntervalMs, router]);
  return null;
}
