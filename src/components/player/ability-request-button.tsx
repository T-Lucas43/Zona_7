"use client";

import { useState } from "react";
import { Dices, Send } from "lucide-react";

export function AbilityRequestButton({ campaignId, sessionId, characterId, abilityId, pendingRequest }: {
  campaignId: string; sessionId: string; characterId: string; abilityId: string;
  pendingRequest?: { id: string; decision: string | null; rolled: boolean };
}) {
  const [request, setRequest] = useState(pendingRequest);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function act(action: "request" | "roll") {
    setBusy(true); setNotice("");
    const response = await fetch("/api/abilities/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(action === "request" ? {
      action, campaignId, sessionId, characterId, characterAbilityId: abilityId, context: "Solicitação enviada pela sala ao vivo",
    } : { action, requestId: request?.id }) });
    const result = await response.json() as { requestId?: string; total?: number; rolls?: number[]; error?: string };
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Não foi possível concluir.");
    if (action === "request") { setRequest({ id: result.requestId!, decision: null, rolled: false }); setNotice("Solicitação enviada ao mestre."); }
    else { setRequest((value) => value ? { ...value, rolled: true } : value); setNotice(`Resultado ${result.total} · dados ${result.rolls?.join(", ")}. Todos receberam o resultado.`); }
  }
  if (request?.decision === "approved" && !request.rolled) return <div><button className="btn btn-primary mt-3 w-full" type="button" disabled={busy} onClick={() => void act("roll")}><Dices size={14} /> {busy ? "Rolando..." : "Rolar teste aprovado"}</button>{notice && <p className="mt-2 text-xs text-[#7bd5a5]">{notice}</p>}</div>;
  if (request && !request.decision) return <p className="mt-3 rounded border border-[#6d5527] bg-[#6d5527]/10 p-3 text-xs text-[#e8c16d]">Aguardando decisão do mestre.</p>;
  if (request?.decision === "rejected") return <p className="mt-3 rounded border border-[#6b3038] p-3 text-xs text-[#f0a5ad]">Uso recusado pelo mestre.</p>;
  if (request?.rolled) return <p className="mt-3 rounded border border-[#315b45] p-3 text-xs text-[#7bd5a5]">Teste realizado e exibido na sala.</p>;
  return <div><button className="btn btn-primary mt-3 w-full" type="button" disabled={busy} onClick={() => void act("request")}><Send size={14} /> {busy ? "Enviando..." : "Solicitar uso ao mestre"}</button>{notice && <p className="mt-2 text-xs text-[#f0a5ad]">{notice}</p>}</div>;
}
