"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { liveNotificationEvent, mergeNotifications } from "@/lib/notification-events";
import type { PlayerNotification } from "@/server/repositories/character-repository";

export function LiveNotificationOverlay({ notifications }: { notifications: PlayerNotification[] }) {
  const [items, setItems] = useState(notifications);
  useEffect(() => {
    const receive = (event: Event) => {
      const item = (event as CustomEvent<PlayerNotification>).detail;
      setItems((current) => mergeNotifications([item], current));
    };
    window.addEventListener(liveNotificationEvent, receive);
    return () => window.removeEventListener(liveNotificationEvent, receive);
  }, []);
  const allItems = mergeNotifications(notifications, items);
  const latest = allItems.find((item) => !item.acknowledged);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());
  if (!latest || dismissed.has(latest.id)) return null;
  const item = latest;
  async function close() {
    setDismissed((current) => new Set(current).add(item.id));
    setItems((current) => current.map((value) => value.id === item.id ? { ...value, acknowledged: true, read: true } : value));
    await fetch("/api/notifications/acknowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: item.id }) });
  }
  return <div className="fixed inset-x-4 top-20 z-[80] mx-auto max-w-lg animate-[pulse_0.35s_ease-out_1] rounded-xl border border-[#b83240] bg-[#17191f] p-5 shadow-2xl shadow-black/70" role="alert">
    <div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#a91f2d]/30 text-[#ff7b88]"><BellRing size={20} /></span><div className="min-w-0 flex-1"><p className="eyebrow">atualização ao vivo</p><h2 className="mt-1 text-xl font-black">{item.title}</h2><p className="mt-2 text-sm leading-6 text-[#b9bbc0]">{item.preview}</p></div><button className="btn px-2" type="button" onClick={() => void close()} aria-label="Fechar"><X size={14} /></button></div>
  </div>;
}
