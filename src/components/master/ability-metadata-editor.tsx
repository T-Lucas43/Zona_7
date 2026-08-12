"use client";

import { useState } from "react";
import { Pencil, Save, X } from "lucide-react";
import type { AbilitySummary } from "@/types/domain";

export function AbilityMetadataEditor({ campaignId, ability, onSaved }: { campaignId: string; ability: AbilitySummary; onSaved: (ability: AbilitySummary) => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ useCriteria: ability.useCriteria ?? "", application: ability.application ?? "", testFormula: ability.testFormula ?? "1d20", difficulty: ability.difficulty ?? 10, successEffect: ability.successEffect ?? "", partialEffect: ability.partialEffect ?? "", failureEffect: ability.failureEffect ?? "" });
  const [notice, setNotice] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/abilities/metadata", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, characterAbilityId: ability.id, ...form }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao salvar.");
    onSaved({ ...ability, ...form }); setOpen(false); setNotice("");
  }
  if (!open) return <button className="btn mt-3 w-full" type="button" onClick={() => setOpen(true)}><Pencil size={13} /> Editar critérios, teste e efeitos</button>;
  return <form className="mt-3 rounded border border-[#4a3a3d] bg-black/20 p-3" onSubmit={save}>
    <label className="text-xs font-bold">Critério de uso<textarea required className="field mt-1 min-h-16" value={form.useCriteria} onChange={(event) => setForm((value) => ({ ...value, useCriteria: event.target.value }))} /></label>
    <label className="mt-2 block text-xs font-bold">Aplicação<textarea required className="field mt-1 min-h-16" value={form.application} onChange={(event) => setForm((value) => ({ ...value, application: event.target.value }))} /></label>
    <div className="mt-2 grid grid-cols-2 gap-2"><label className="text-xs font-bold">Teste<input required className="field mt-1" value={form.testFormula} onChange={(event) => setForm((value) => ({ ...value, testFormula: event.target.value }))} /></label><label className="text-xs font-bold">DT<input className="field mt-1" type="number" value={form.difficulty} onChange={(event) => setForm((value) => ({ ...value, difficulty: Number(event.target.value) }))} /></label></div>
    <label className="mt-2 block text-xs font-bold">Efeito no sucesso<textarea required className="field mt-1 min-h-16" value={form.successEffect} onChange={(event) => setForm((value) => ({ ...value, successEffect: event.target.value }))} /></label>
    <label className="mt-2 block text-xs font-bold">Efeito parcial<textarea className="field mt-1 min-h-16" value={form.partialEffect} onChange={(event) => setForm((value) => ({ ...value, partialEffect: event.target.value }))} /></label>
    <label className="mt-2 block text-xs font-bold">Efeito na falha<textarea required className="field mt-1 min-h-16" value={form.failureEffect} onChange={(event) => setForm((value) => ({ ...value, failureEffect: event.target.value }))} /></label>
    <div className="mt-3 flex gap-2"><button className="btn btn-primary"><Save size={13} /> Salvar</button><button className="btn" type="button" onClick={() => setOpen(false)}><X size={13} /> Cancelar</button></div>{notice && <p className="mt-2 text-xs text-[#f0a5ad]">{notice}</p>}
  </form>;
}
