"use client";

import { useState } from "react";
import { Braces, Check, RotateCcw, Save, X } from "lucide-react";
import { useRouter } from "next/navigation";
import type { RuleCatalogEntry } from "@/server/repositories/rules-repository";

export function RuleCatalogManager({ campaignId, initialRules }: { campaignId: string; initialRules: RuleCatalogEntry[] }) {
  const router = useRouter();
  const [selected, setSelected] = useState<RuleCatalogEntry | null>(initialRules[0] ?? null);
  const [payload, setPayload] = useState(selected ? JSON.stringify(selected.effectivePayload, null, 2) : "{}");
  const [reason, setReason] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);

  function choose(rule: RuleCatalogEntry) {
    setSelected(rule);
    setPayload(JSON.stringify(rule.effectivePayload, null, 2));
    setReason("");
    setNotice("");
  }

  async function publish() {
    if (!selected) return;
    setPending(true);
    setNotice("");
    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      const response = await fetch("/api/master/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ campaignId, ruleDefinitionId: selected.id, payload: parsed, reason }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Falha ao publicar regra.");
      setNotice(`Override publicado na versão ${result.version ?? "nova"}.`);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "JSON inválido.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rule-manager">
      <aside className="rule-list panel">
        <div className="p-4"><p className="eyebrow">fonte única</p><h2 className="mt-1 font-black">Catálogo efetivo</h2></div>
        <div className="rule-list-scroll">
          {initialRules.map((rule) => (
            <button type="button" data-active={selected?.id === rule.id} onClick={() => choose(rule)} key={rule.id}>
              <span><strong>{rule.title}</strong><small>{rule.category} · v{rule.version}</small></span>
              {rule.overridden ? <span className="rule-override-badge">personalizada</span> : <Check size={14} />}
            </button>
          ))}
        </div>
      </aside>
      {selected ? (
        <section className="rule-editor panel">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="eyebrow">{selected.key}</p><h2 className="mt-1 text-xl font-black">{selected.title}</h2></div>
            <span className="tag"><Braces size={13} /> JSON auditável</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-[#343841] p-3"><span className="text-[0.65rem] uppercase text-[#858891]">Jogador</span><p className="mt-2 text-sm leading-6 text-[#c3c6cc]">{selected.playerSummary}</p></div>
            <div className="rounded-lg border border-[#343841] p-3"><span className="text-[0.65rem] uppercase text-[#858891]">Mestre</span><p className="mt-2 text-sm leading-6 text-[#c3c6cc]">{selected.masterSummary}</p></div>
          </div>
          <label className="mt-4 block text-xs font-bold">Regra efetiva
            <textarea className="rule-json field mt-1" spellCheck={false} value={payload} onChange={(event) => setPayload(event.target.value)} />
          </label>
          <label className="mt-3 block text-xs font-bold">Motivo da nova versão
            <input className="field mt-1" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Obrigatório para auditoria" />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-primary" type="button" disabled={pending || reason.trim().length < 3} onClick={() => void publish()}><Save size={14} /> {pending ? "Publicando..." : "Publicar versão"}</button>
            <button className="btn" type="button" onClick={() => setPayload(JSON.stringify(selected.basePayload, null, 2))}><RotateCcw size={14} /> Usar base no editor</button>
            {notice && <p className={notice.includes("publicado") ? "rule-notice success" : "rule-notice"}><X size={13} /> {notice}</p>}
          </div>
        </section>
      ) : <section className="panel rounded-xl p-6">Nenhuma regra cadastrada.</section>}
    </div>
  );
}

