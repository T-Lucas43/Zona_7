"use client";

import { useMemo, useState } from "react";
import { CircleAlert, Sparkles, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ResourceKind } from "@/types/domain";

const labels: Record<ResourceKind, string> = { pv: "PV", pe: "PE", san: "SAN" };

export function AbilityUseButton({
  abilityId,
  costs,
}: {
  abilityId: string;
  costs: Partial<Record<ResourceKind, string>>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");
  const defaults = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(costs).map(([key, value]) => [
          key,
          /^\d+$/.test(value ?? "") ? Number(value) : 0,
        ]),
      ) as Partial<Record<ResourceKind, number>>,
    [costs],
  );
  const [resolved, setResolved] = useState(defaults);

  async function confirmUse() {
    setSending(true);
    setNotice("");
    const response = await fetch("/api/abilities/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterAbilityId: abilityId,
        resolvedCosts: resolved,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSending(false);
    if (!response.ok) return setNotice(result.error ?? "Não foi possível usar a habilidade.");
    setNotice("Uso confirmado. Custos descontados e evento registrado.");
    setOpen(false);
    router.refresh();
  }

  if (!open)
    return (
      <button className="btn btn-primary mt-4 w-full" type="button" onClick={() => setOpen(true)}>
        <Sparkles size={14} /> Usar habilidade
      </button>
    );

  return (
    <div className="mt-4 rounded border border-[#5d3036] bg-black/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <strong className="text-xs">Confirmar custos</strong>
          <p className="mt-1 text-[0.68rem] text-[#858891]">
            Valores variáveis devem ser rolados antes da confirmação.
          </p>
        </div>
        <button
          className="btn px-2 py-1"
          type="button"
          aria-label="Cancelar"
          onClick={() => setOpen(false)}
        >
          <X size={13} />
        </button>
      </div>
      {Object.entries(costs).map(([kind, expression]) => {
        const resource = kind as ResourceKind;
        return (
          <label className="mt-3 block text-xs font-bold" key={resource}>
            {labels[resource]} · custo configurado {expression}
            <input
              className="field mt-1"
              type="number"
              min={0}
              max={999}
              value={resolved[resource] ?? 0}
              readOnly={/^\d+$/.test(expression ?? "")}
              onChange={(event) =>
                setResolved((current) => ({ ...current, [resource]: Number(event.target.value) }))
              }
            />
          </label>
        );
      })}
      <button
        className="btn btn-primary mt-3 w-full"
        type="button"
        disabled={sending}
        onClick={() => void confirmUse()}
      >
        {sending ? "Confirmando..." : "Confirmar uso e descontar"}
      </button>
      {notice && (
        <p className="mt-2 flex gap-2 text-xs text-[#f0a5ad]" role="status">
          <CircleAlert size={14} /> {notice}
        </p>
      )}
    </div>
  );
}
