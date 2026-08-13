"use client";

import { useState } from "react";
import { CheckCircle2, Dices, XCircle } from "lucide-react";
import { RollingDie } from "@/components/dice/rolling-die";
import type { CharacterCheckRequest } from "@/server/repositories/character-repository";

export function CheckRequestCard({ request }: { request: CharacterCheckRequest }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ total: number; success: boolean; natural20: boolean; rolls: number[] }>();
  const [error, setError] = useState("");
  async function roll() {
    setBusy(true);
    setError("");
    const response = await fetch("/api/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "roll", requestId: request.id }),
    });
    const body = (await response.json()) as { total?: number; success?: boolean; natural20?: boolean; rolls?: number[]; error?: string };
    setBusy(false);
    if (!response.ok || body.total === undefined) return setError(body.error ?? "Não foi possível rolar.");
    setResult({ total: body.total, success: Boolean(body.success), natural20: Boolean(body.natural20), rolls: body.rolls ?? [] });
  }
  return (
    <section className="panel check-request-card rounded-lg border-[#594078] p-5" aria-live="polite">
      <p className="eyebrow">o mestre solicita</p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-extrabold">{request.skill || request.attribute.toUpperCase()} · DT {request.difficulty}</h2>
        <span className="tag">{request.method === "roll" ? "Rolagem" : request.method === "take_10" ? "Escolher 10" : "Escolher 20"}</span>
      </div>
      <p className="mt-2 text-sm text-[#a8abb2]">{request.context}</p>
      {!result ? <button className="btn btn-primary mt-4 w-full" type="button" disabled={busy} onClick={() => void roll()}><Dices size={15} /> {busy ? "Rolando…" : "Rolar teste solicitado"}</button> : (
        <div className={`mt-4 rounded border p-4 text-center ${result.success ? "border-[#315b45] text-[#7bd5a5]" : "border-[#6b3038] text-[#f0a5ad]"}`}>
          <RollingDie value={result.total} compact />
          <p className="mt-2 flex items-center justify-center gap-2 font-bold">{result.success ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {result.natural20 ? "Sucesso automático (20 natural)" : result.success ? "Sucesso" : "Falha"}</p>
          <p className="mt-1 text-xs">Dados: {result.rolls.join(", ")} · resultado publicado com seu nome.</p>
        </div>
      )}
      {error && <p className="mt-3 text-xs text-[#f0a5ad]">{error}</p>}
    </section>
  );
}
