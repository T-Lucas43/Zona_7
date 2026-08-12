"use client";

import { useState } from "react";
import { Pencil, Plus, Save, Swords, Trash2, X } from "lucide-react";
import type { EncontroDaCampanha } from "@/server/repositories/master-repository";

const emptyForm = { name: "", status: "draft" as const, round: 0, notes: "" };

export function EncounterManager({ campaignId, initialItems }: { campaignId: string; initialItems: EncontroDaCampanha[] }) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ name: string; status: "draft" | "active" | "paused" | "ended"; round: number; notes: string }>(emptyForm);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(item: EncontroDaCampanha) {
    setEditingId(item.id);
    setForm({ name: item.nome, status: item.estado as typeof form.status, round: item.rodada, notes: item.observacoes });
    setNotice("");
  }

  function reset() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/master/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: editingId ? "update" : "create", campaignId, encounterId: editingId, ...form }),
    });
    const result = (await response.json()) as { item?: EncontroDaCampanha; error?: string };
    setBusy(false);
    if (!response.ok || !result.item) return setNotice(result.error ?? "Falha ao salvar encontro.");
    setItems((current) => editingId
      ? current.map((item) => item.id === editingId ? { ...result.item!, participantes: item.participantes } : item)
      : [result.item!, ...current]);
    setNotice(editingId ? "Encontro atualizado." : "Encontro criado.");
    reset();
  }

  async function remove(item: EncontroDaCampanha) {
    if (!window.confirm(`Excluir definitivamente o encontro “${item.nome}”?`)) return;
    setBusy(true);
    const response = await fetch("/api/master/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", campaignId, encounterId: item.id }),
    });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao excluir encontro.");
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    if (editingId === item.id) reset();
    setNotice("Encontro excluído.");
  }

  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <form className="panel rounded-lg p-5" onSubmit={save}>
        <div className="flex items-center gap-2"><Swords size={17} className="text-[#d84b57]" /><h2 className="font-extrabold">{editingId ? "Editar encontro" : "Novo encontro"}</h2></div>
        <label className="mt-4 block text-xs font-bold">Nome<input required className="field mt-1" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} /></label>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="text-xs font-bold">Estado<select className="field mt-1" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as typeof form.status }))}><option value="draft">Rascunho</option><option value="active">Ativo</option><option value="paused">Pausado</option><option value="ended">Encerrado</option></select></label>
          <label className="text-xs font-bold">Rodada<input className="field mt-1" type="number" min="0" value={form.round} onChange={(event) => setForm((current) => ({ ...current, round: Number(event.target.value) }))} /></label>
        </div>
        <label className="mt-3 block text-xs font-bold">Anotações do mestre<textarea className="field mt-1 min-h-28" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></label>
        <div className="mt-3 flex gap-2"><button className="btn btn-primary" disabled={busy}>{editingId ? <Save size={14} /> : <Plus size={14} />}{editingId ? "Salvar alterações" : "Criar encontro"}</button>{editingId && <button className="btn" type="button" onClick={reset}><X size={14} /> Cancelar</button>}</div>
        {notice && <p className="mt-3 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
      </form>
      <section className="grid content-start gap-3 md:grid-cols-2">
        {items.map((item) => <article className="panel central-card rounded-lg p-5" key={item.id}>
          <div className="flex justify-between gap-3"><Swords className="text-[#d54a56]" /><span className="tag">{item.estado.toUpperCase()}</span></div>
          <h2 className="mt-4 font-extrabold">{item.nome}</h2>
          <p className="mt-2 text-xs text-[#858890]">Rodada {item.rodada} · {item.participantes} participantes</p>
          {item.observacoes && <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#a3a5ab]">{item.observacoes}</p>}
          <div className="mt-4 flex gap-2"><button className="btn px-3" type="button" onClick={() => edit(item)}><Pencil size={13} /> Editar</button><button className="btn border-[#682d35] px-3 text-[#f0949d]" type="button" disabled={busy} onClick={() => void remove(item)}><Trash2 size={13} /> Excluir</button></div>
        </article>)}
        {items.length === 0 && <p className="rounded-lg border border-dashed border-[#3b3e46] p-6 text-sm text-[#777a82] md:col-span-2">Nenhum encontro cadastrado. Use o formulário para criar o primeiro.</p>}
      </section>
    </div>
  );
}
