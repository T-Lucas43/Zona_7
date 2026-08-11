"use client";

import { useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/client";

export function RealtimeIndicator({ channel }: { channel: string }) {
  const [status, setStatus] = useState(isSupabaseConfigured ? "Conectando" : "Simulação local");
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const client = createClient();
    const subscription = client
      .channel(channel, { config: { private: true } })
      .subscribe((nextStatus) => {
        setStatus(
          nextStatus === "SUBSCRIBED"
            ? "Sincronizado"
            : nextStatus === "CHANNEL_ERROR"
              ? "Reconectando"
              : "Conectando",
        );
      });
    return () => {
      void client.removeChannel(subscription);
    };
  }, [channel]);
  return (
    <span className="tag" aria-live="polite">
      <span className="status-dot" /> {status}
    </span>
  );
}
