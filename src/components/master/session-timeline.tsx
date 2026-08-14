"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, History, RotateCcw, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import type { SessionTimelineEntry } from "@/server/repositories/session-history-repository";

function describe(entry: SessionTimelineEntry) {
  if (entry.type === "resource_mutated") return `${String(entry.after?.resource ?? "recurso").toUpperCase()}: ${entry.before?.current ?? "?"} → ${entry.after?.current ?? "?"}`;
  if (entry.type === "meter_changed") return `Valor ${entry.before?.value ?? "?"} → ${entry.after?.value ?? "?"}`;
  if (entry.type === "item_delivered") return String(entry.after?.name ?? "Item entregue");
  if (entry.type === "handout_delivered") return String(entry.after?.title ?? "Pista revelada");
  if (entry.type === "combat_turn_advanced") return `Rodada ${entry.after?.round ?? "?"} · ${entry.after?.currentTurn ?? "turno"}`;
  return String(entry.metadata.reason ?? entry.after?.reason ?? entry.entity);
}

export function SessionTimeline({ campaignId, sessionId, initialEntries }: { campaignId: string; sessionId: string; initialEntries: SessionTimelineEntry[] }) {
  const router = useRouter();
  const [entries, setEntries] = useState(initialEntries);
  const [selected, setSelected] = useState<SessionTimelineEntry | null>(null);
  const [reason, setReason] = useState("Correção confirmada pelo mestre");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntries(initialEntries));
    return () => window.cancelAnimationFrame(frame);
  }, [initialEntries]);
  async function reverse() {
    if (!selected) return;
    setPending(true); setNotice("");
    const response = await fetch("/api/master/session/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, sessionId, eventId: selected.id, reason }) });
    const result = await response.json() as { error?: string };
    setPending(false);
    if (!response.ok) return setNotice(result.error ?? "Não foi possível desfazer esta ação.");
    setEntries((items) => items.map((item) => item.id === selected.id ? { ...item, reversalStatus: "reversed", reversible: false } : item));
    setSelected(null); setNotice("Ação desfeita por compensação. O evento original foi preservado e todos os clientes serão sincronizados.");
    router.refresh();
  }
  return <section className="panel rounded-lg p-4 session-timeline">
    <div className="flex items-center justify-between gap-3"><div><p className="eyebrow">histórico reversível</p><h2 className="font-extrabold">Linha do tempo da sessão</h2></div><div className="flex items-center gap-2"><History size={19} className="text-[#e75b66]" /><button className="btn px-2" type="button" aria-expanded={!collapsed} onClick={() => setCollapsed((value) => !value)}>{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</button></div></div>
    {!collapsed && <>
    <div className="mt-3 max-h-80 space-y-2 overflow-auto pr-1">
      {entries.map((entry) => <article className="session-timeline-entry" data-reversed={entry.reversalStatus === "reversed"} key={entry.id}>
        <span className="session-timeline-dot" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{entry.label}</strong><time>{new Date(entry.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p>{describe(entry)}</p></div>
        {entry.reversible ? <button className="btn px-2 py-1" type="button" onClick={() => setSelected(entry)}><RotateCcw size={13} /> Desfazer</button> : <ShieldCheck size={15} className="text-[#59616c]" />}
      </article>)}
      {entries.length === 0 && <p className="text-xs text-[#7f8490]">As ações auditáveis desta sessão aparecerão aqui.</p>}
    </div>
    {selected && <div className="session-reverse-confirm mt-3"><strong>Desfazer “{selected.label}”?</strong><p>Será criado um evento compensatório; nada será apagado da auditoria.</p><input className="field mt-2" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-2 flex gap-2"><button className="btn btn-primary" type="button" disabled={pending || reason.trim().length < 3} onClick={() => void reverse()}><RotateCcw size={14} /> Confirmar</button><button className="btn" type="button" onClick={() => setSelected(null)}>Cancelar</button></div></div>}
    {notice && <p className="session-notice mt-3">{notice}</p>}
    </>}
  </section>;
}
