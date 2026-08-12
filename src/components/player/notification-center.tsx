"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Check, Package, ScrollText } from "lucide-react";
import { demoRealtimeChannel, type DemoRealtimeEvent } from "@/lib/demo-realtime";
import { liveNotificationEvent } from "@/lib/notification-events";
import type { PlayerNotification } from "@/server/repositories/character-repository";

export function NotificationCenter({ initial, authorizedCharacterIds }: { initial: PlayerNotification[]; authorizedCharacterIds: string[] }) {
  const [realtimeItems, setRealtimeItems] = useState<PlayerNotification[]>([]);
  const [acknowledgedIds, setAcknowledgedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    const channel = new BroadcastChannel(demoRealtimeChannel);
    channel.onmessage = (message: MessageEvent<DemoRealtimeEvent>) => {
      if (message.data.targetCharacterIds?.length && !message.data.targetCharacterIds.some((id) => authorizedCharacterIds.includes(id))) return;
      setRealtimeItems((current) => [{
        id: `local-${message.data.createdAt}`,
        type: message.data.type,
        title: message.data.title,
        preview: "Atualização recebida em tempo real.",
        read: false,
        acknowledged: false,
        createdAt: message.data.createdAt,
      }, ...current]);
    };
    return () => channel.close();
  }, [authorizedCharacterIds]);
  useEffect(() => {
    const receive = (event: Event) => {
      const item = (event as CustomEvent<PlayerNotification>).detail;
      setRealtimeItems((current) => current.some((value) => value.id === item.id) ? current : [item, ...current]);
    };
    window.addEventListener(liveNotificationEvent, receive);
    return () => window.removeEventListener(liveNotificationEvent, receive);
  }, []);
  const items = useMemo(
    () => [...realtimeItems, ...initial].map((item) => acknowledgedIds.has(item.id) ? { ...item, acknowledged: true, read: true } : item),
    [acknowledgedIds, initial, realtimeItems],
  );
  const unread = useMemo(() => items.filter((item) => !item.acknowledged).length, [items]);
  async function acknowledge(id: string) {
    if (!id.startsWith("local-") && !id.startsWith("demo-")) {
      const response = await fetch("/api/notifications/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId: id }),
      });
      if (!response.ok) return;
    }
    setAcknowledgedIds((current) => new Set(current).add(id));
  }
  return (
    <section className="panel rounded-lg p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[#e15d69]">
          <Bell size={18} />
          <h2 className="font-extrabold">Notificações</h2>
        </div>
        <span className="tag">{unread} nova(s)</span>
      </div>
      <div className="mt-4 max-h-80 space-y-3 overflow-y-auto">
        {items.length === 0 && <p className="text-sm text-[#858891]">Nenhuma notificação.</p>}
        {items.map((item) => (
          <article className={`rounded border p-3 ${item.acknowledged ? "border-[#30333a] opacity-60" : "border-[#5e2830]"}`} key={item.id}>
            <div className="flex gap-3">
              {item.type.includes("item") ? <Package size={16} /> : <ScrollText size={16} />}
              <div className="min-w-0 flex-1">
                <strong className="block text-sm">{item.title}</strong>
                <p className="mt-1 text-xs text-[#858891]">{item.preview}</p>
              </div>
              {!item.acknowledged && (
                <button className="btn btn-ghost px-2" type="button" onClick={() => void acknowledge(item.id)} aria-label={`Confirmar ${item.title}`}>
                  <Check size={14} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
