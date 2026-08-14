"use client";

import { useEffect, useState } from "react";
import { Dices, Send, Swords } from "lucide-react";
import { RollingDie } from "@/components/dice/rolling-die";

export function AttackRequestButton({ campaignId, sessionId, characterId, attackId, targets, targetMin = 1, targetMax = 1, pendingRequest }: {
  campaignId: string; sessionId: string; characterId: string; attackId: string;
  targets: Array<{ id: string; name: string; type: "character" | "actor" }>;
  pendingRequest?: { id: string; decision: string | null; rolled: boolean };
  targetMin?: number;
  targetMax?: number;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [requestId, setRequestId] = useState(pendingRequest?.id ?? "");
  const [decision, setDecision] = useState<string | null>(pendingRequest?.decision ?? null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [executed, setExecuted] = useState(pendingRequest?.rolled ?? false);

  useEffect(() => {
    if (!requestId || decision) return;
    const timer = window.setInterval(async () => {
      const response = await fetch("/api/combat/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", requestId }) });
      if (!response.ok) return;
      const result = await response.json();
      if (result.decision) setDecision(result.decision);
    }, 2500);
    return () => window.clearInterval(timer);
  }, [decision, requestId]);

  async function act(action: "request" | "execute") {
    setBusy(true); setNotice("");
    const selectedTargets = targets.filter((item) => selected.includes(item.id));
    const response = await fetch("/api/combat/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "request" ? {
      action, campaignId, sessionId, characterId, attackId,
      targetCharacterIds: selectedTargets.filter((target) => target.type === "character").map((target) => target.id),
      targetActorIds: selectedTargets.filter((target) => target.type === "actor").map((target) => target.id),
    } : { action, requestId }) });
    const result = await response.json(); setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Falha na ação.");
    if (action === "request") { setRequestId(result.requestId); setNotice("Ataque enviado ao mestre para aprovação."); }
    else { setExecuted(true); setNotice(result.outcomes?.map((item: { targetName: string; hit: boolean; damage: number }) => `${item.targetName}: ${item.hit ? `acerto, ${item.damage} de dano` : "falha"}`).join(" · ") ?? "Ataque executado."); }
  }

  return <div className="mt-3">
    {!requestId && <><fieldset className="rounded border border-[#343840] p-2"><legend className="px-1 text-[0.65rem] font-bold uppercase">Alvos ({targetMin}-{targetMax})</legend>{targets.map((target) => <label className="mt-1 flex items-center gap-2 text-xs" key={`${target.type}:${target.id}`}><input type="checkbox" checked={selected.includes(target.id)} onChange={(event) => setSelected((current) => event.target.checked ? current.length < targetMax ? [...current, target.id] : current : current.filter((id) => id !== target.id))} />{target.name}</label>)}</fieldset><button className="btn btn-primary mt-2 w-full" type="button" disabled={busy || selected.length < targetMin || selected.length > targetMax} onClick={() => void act("request")}><Send size={13} /> Solicitar ataque</button></>}
    {requestId && !decision && <button className="btn mt-2 w-full" type="button" disabled><Swords size={13} /> Aguardando aprovação do mestre</button>}
    {decision === "rejected" && <p className="mt-2 rounded border border-[#6b3038] p-3 text-xs text-[#f0a5ad]">Ataque recusado pelo mestre.</p>}
    {decision === "approved" && !executed && <button className="btn btn-primary mt-2 w-full" type="button" disabled={busy} onClick={() => void act("execute")}><Dices size={13} /> Executar ataque aprovado</button>}
    {executed && <p className="mt-2 rounded border border-[#315b45] p-3 text-xs text-[#7bd5a5]">Ataque executado e publicado.</p>}
    {busy && <div className="dice-stage mt-2"><RollingDie rolling /></div>}
    {notice && <p className="mt-2 text-xs text-[#9fd8b8]">{notice}</p>}
  </div>;
}
