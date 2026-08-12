"use client";

import { useState } from "react";
import { Bell, Check, X } from "lucide-react";
import type { PlayerNotification } from "@/server/repositories/character-repository";

export function NotificationBell({ initial }: { initial: PlayerNotification[] }) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(() => new Set());
  const [open, setOpen] = useState(false);
  const items = initial.map((item) => acknowledged.has(item.id) ? { ...item, acknowledged: true, read: true } : item);
  const unread = items.filter((item) => !item.acknowledged).length;
  async function acknowledge(id: string) {
    const response = await fetch("/api/notifications/acknowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ notificationId: id }) });
    if (response.ok) setAcknowledged((current) => new Set(current).add(id));
  }
  return <div className="relative">
    <button className="btn relative px-3" type="button" onClick={() => setOpen((value) => !value)} aria-label={`${unread} notificações`}><Bell size={16} />{unread > 0 && <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-[#c52b3a] text-[0.6rem] font-black">{Math.min(unread, 9)}</span>}</button>
    {open && <div className="absolute right-0 top-12 z-50 w-[min(24rem,calc(100vw-2rem))] rounded-lg border border-[#3a3d44] bg-[#111318] p-3 shadow-2xl">
      <div className="flex items-center justify-between"><strong>Notificações</strong><button className="btn px-2 py-1" type="button" onClick={() => setOpen(false)}><X size={13} /></button></div>
      <div className="mt-3 max-h-96 space-y-2 overflow-y-auto">{items.map((item) => <article className={`rounded border p-3 ${item.acknowledged ? "border-[#30333a] opacity-60" : "border-[#6b3038]"}`} key={item.id}><div className="flex justify-between gap-2"><div><strong className="text-xs">{item.title}</strong><p className="mt-1 text-xs leading-5 text-[#92959c]">{item.preview}</p></div>{!item.acknowledged && <button className="btn px-2" type="button" onClick={() => void acknowledge(item.id)} aria-label="Confirmar"><Check size={13} /></button>}</div></article>)}{items.length === 0 && <p className="text-xs text-[#777a82]">Nenhuma notificação.</p>}</div>
    </div>}
  </div>;
}
