"use client";

import { useState } from "react";
import { DoorOpen, Pause, RotateCcw, Scissors, ShieldAlert } from "lucide-react";

const tools = [
  ["pause", "Pausa", Pause],
  ["cut", "Corte", Scissors],
  ["rewind", "Rebobinar", RotateCcw],
  ["open_door", "Porta Aberta", DoorOpen],
  ["check_in", "Check-in", ShieldAlert],
] as const;

export function SafetyTools({ campaignId, sessionId }: { campaignId: string; sessionId: string }) {
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  async function trigger(tool: string) {
    setPending(true);
    const response = await fetch("/api/safety", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, sessionId, tool, privateToMaster: true }) });
    const payload = await response.json();
    setPending(false);
    setNotice(response.ok ? "O mestre foi avisado de forma privada." : payload.error ?? "Falha ao acionar.");
  }
  return (
    <div className="safety-tools">
      <button className="safety-trigger" type="button" aria-expanded={open} onClick={() => setOpen((value) => !value)}><ShieldAlert size={16} /> Segurança</button>
      {open && <div className="safety-popover panel"><div className="flex justify-between gap-3"><div><p className="eyebrow">sem justificativa</p><strong>Ferramentas da mesa</strong></div><button className="btn min-h-8 px-2 py-1" onClick={() => setOpen(false)} type="button">×</button></div><div className="mt-3 grid grid-cols-2 gap-2">{tools.map(([value, label, Icon]) => <button className="btn justify-start" disabled={pending} key={value} onClick={() => void trigger(value)} type="button"><Icon size={14} /> {label}</button>)}</div>{notice && <p className="mt-3 text-xs text-[#e8c674]">{notice}</p>}</div>}
    </div>
  );
}

