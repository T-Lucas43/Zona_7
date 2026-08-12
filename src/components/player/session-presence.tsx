"use client";

import { useEffect } from "react";

export function SessionPresence({
  campaignId,
  sessionId,
  characterId,
}: {
  campaignId: string;
  sessionId: string;
  characterId: string;
}) {
  useEffect(() => {
    const body = (action: "join" | "heartbeat" | "leave") =>
      JSON.stringify({ campaignId, sessionId, characterId, action });
    const send = (action: "join" | "heartbeat") =>
      fetch("/api/session/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body(action),
        keepalive: true,
      }).catch(() => undefined);
    void send("join");
    const heartbeat = window.setInterval(() => void send("heartbeat"), 20_000);
    const recover = () => {
      if (document.visibilityState === "visible") void send("heartbeat");
    };
    const leave = () =>
      navigator.sendBeacon(
        "/api/session/presence",
        new Blob([body("leave")], { type: "application/json" }),
      );
    window.addEventListener("pagehide", leave);
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    document.addEventListener("visibilitychange", recover);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      window.removeEventListener("online", recover);
      window.removeEventListener("focus", recover);
      document.removeEventListener("visibilitychange", recover);
      leave();
    };
  }, [campaignId, characterId, sessionId]);
  return null;
}
