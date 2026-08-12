"use client";

import { useState } from "react";
import { Gift, PackageOpen, Trash2 } from "lucide-react";

type Target = { id: string; name: string };

export function InventoryActions({ characterItemId, targets }: { characterItemId: string; targets: Target[] }) {
  const [target, setTarget] = useState(targets[0]?.id ?? "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: "use" | "discard" | "donate") {
    if (action === "discard" && !window.confirm("Jogar fora uma unidade deste item?")) return;
    setBusy(true); setNotice("");
    const response = await fetch("/api/inventory/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterItemId, action, quantity: 1, targetCharacterId: action === "donate" ? target : undefined }) });
    const result = await response.json() as { error?: string; remaining?: number };
    setBusy(false); setNotice(response.ok ? `Ação concluída${result.remaining !== undefined ? ` · restante ${result.remaining}` : ""}.` : result.error ?? "Falha na ação.");
  }
  return <div className="mt-3 border-t border-[#30333a] pt-3">
    <div className="grid grid-cols-2 gap-2"><button className="btn px-2" type="button" disabled={busy} onClick={() => void act("use")}><PackageOpen size={13} /> Usar</button><button className="btn px-2 text-[#f0949d]" type="button" disabled={busy} onClick={() => void act("discard")}><Trash2 size={13} /> Jogar fora</button></div>
    {targets.length > 0 && <div className="mt-2 grid grid-cols-[1fr_auto] gap-2"><select className="field" value={target} onChange={(event) => setTarget(event.target.value)}>{targets.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select><button className="btn px-3" type="button" disabled={busy || !target} onClick={() => void act("donate")}><Gift size={13} /> Doar</button></div>}
    {notice && <p className="mt-2 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
  </div>;
}
