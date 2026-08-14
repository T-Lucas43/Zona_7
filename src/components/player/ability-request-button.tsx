"use client";

import { useState } from "react";
import { Dices, Send } from "lucide-react";
import { RollingDie } from "@/components/dice/rolling-die";

export function AbilityRequestButton({
  campaignId,
  sessionId,
  characterId,
  abilityId,
  pendingRequest,
  targets = [],
  targetMin = 0,
  targetMax = 1,
}: {
  campaignId: string;
  sessionId: string;
  characterId: string;
  abilityId: string;
  pendingRequest?: { id: string; decision: string | null; rolled: boolean };
  targets?: Array<{ id: string; name: string; type: "character" | "actor" }>;
  targetMin?: number;
  targetMax?: number;
}) {
  const [request, setRequest] = useState(pendingRequest);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [lastResult, setLastResult] = useState<number>();
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);
  async function act(action: "request" | "roll") {
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/abilities/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "request"
          ? {
              action,
              campaignId,
              sessionId,
              characterId,
              characterAbilityId: abilityId,
              context: "Solicitação enviada pela sala ao vivo",
              targetCharacterIds: targets.filter((target) => target.type === "character" && selectedTargets.includes(target.id)).map((target) => target.id),
              targetActorIds: targets.filter((target) => target.type === "actor" && selectedTargets.includes(target.id)).map((target) => target.id),
            }
          : { action, requestId: request?.id },
      ),
    });
    const result = (await response.json()) as {
      requestId?: string;
      total?: number;
      rolls?: number[];
      error?: string;
    };
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Não foi possível concluir.");
    if (action === "request") {
      setRequest({ id: result.requestId!, decision: null, rolled: false });
      setNotice("Solicitação enviada ao mestre.");
    } else {
      setRequest((value) => (value ? { ...value, rolled: true } : value));
      setLastResult(result.total);
      setNotice(
        `Resultado ${result.total} · dados ${result.rolls?.join(", ")}. Todos receberam o resultado.`,
      );
    }
  }
  if (request?.decision === "approved" && !request.rolled)
    return (
      <div>
        <button
          className="btn btn-primary mt-3 w-full"
          type="button"
          disabled={busy}
          onClick={() => void act("roll")}
        >
          <Dices size={14} /> {busy ? "Rolando..." : "Rolar teste aprovado"}
        </button>
        {busy && (
          <div className="dice-stage mt-3">
            <RollingDie rolling />
          </div>
        )}
        {notice && <p className="mt-2 text-xs text-[#7bd5a5]">{notice}</p>}
      </div>
    );
  if (request && !request.decision)
    return (
      <p className="mt-3 rounded border border-[#6d5527] bg-[#6d5527]/10 p-3 text-xs text-[#e8c16d]">
        Aguardando decisão do mestre.
      </p>
    );
  if (request?.decision === "rejected")
    return (
      <p className="mt-3 rounded border border-[#6b3038] p-3 text-xs text-[#f0a5ad]">
        Uso recusado pelo mestre.
      </p>
    );
  if (request?.rolled)
    return (
      <div className="mt-3 rounded border border-[#315b45] p-3 text-center text-xs text-[#7bd5a5]">
        {lastResult !== undefined && <RollingDie value={lastResult} compact />}
        <p className="mt-2">Teste realizado e exibido na sala.</p>
      </div>
    );
  return (
    <div>
      {targets.length > 0 && targetMax > 0 && (
        <fieldset className="mt-3 rounded border border-[#343840] p-2">
          <legend className="px-1 text-[0.65rem] font-bold uppercase tracking-wide text-[#9da2ab]">
            Alvos ({targetMin}-{targetMax})
          </legend>
          <div className="space-y-1">
            {targets.map((target) => (
              <label className="flex cursor-pointer items-center gap-2 text-xs" key={`${target.type}:${target.id}`}>
                <input
                  type="checkbox"
                  checked={selectedTargets.includes(target.id)}
                  onChange={(event) => setSelectedTargets((current) => event.target.checked
                    ? current.length < targetMax ? [...current, target.id] : current
                    : current.filter((id) => id !== target.id))}
                />
                <span>{target.name}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <button
        className="btn btn-primary mt-3 w-full"
        type="button"
        disabled={busy || selectedTargets.length < targetMin || selectedTargets.length > targetMax}
        onClick={() => void act("request")}
      >
        <Send size={14} /> {busy ? "Enviando..." : "Solicitar uso ao mestre"}
      </button>
      {notice && <p className="mt-2 text-xs text-[#f0a5ad]">{notice}</p>}
    </div>
  );
}
