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
    const leave = () =>
      navigator.sendBeacon(
        "/api/session/presence",
        new Blob([body("leave")], { type: "application/json" }),
      );
    window.addEventListener("pagehide", leave);
    return () => {
      window.clearInterval(heartbeat);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [campaignId, characterId, sessionId]);
  return null;
}
