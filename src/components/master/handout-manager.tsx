"use client";

import { useState } from "react";
import { FileLock2, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { PistaDaCampanha } from "@/server/repositories/master-repository";

const emptyForm = { title: "", type: "pista", state: "hidden" as const, visibility: "gm_only" as const, excerpt: "", content: "" };

export function HandoutManager({ campaignId, initialItems }: { campaignId: string; initialItems: PistaDaCampanha[] }) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<{ title: string; type: string; state: "hidden" | "discovered" | "shared" | "corrupted"; visibility: "public" | "campaign" | "selected" | "owner_only" | "gm_only"; excerpt: string; content: string }>(emptyForm);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(item: PistaDaCampanha) {
    const visibilityByLabel: Record<string, typeof form.visibility> = { "Público": "public", "Toda a campanha": "campaign", "Pessoas selecionadas": "selected", "Dono da ficha e mestres": "owner_only", "Somente mestres": "gm_only" };
    setEditingId(item.id);
    setForm({ title: item.titulo, type: item.tipo, state: item.estado as typeof form.state, visibility: visibilityByLabel[item.visibilidade] ?? item.visibilidade as typeof form.visibility, excerpt: item.resumo, content: item.conteudo });
    setNotice("");
  }

  function reset() { setEditingId(null); setForm(emptyForm); }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    const response = await fetch("/api/master/handouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: editingId ? "update" : "create", campaignId, handoutId: editingId, ...form }) });
    const result = (await response.json()) as { item?: PistaDaCampanha; error?: string };
    setBusy(false);
    if (!response.ok || !result.item) return setNotice(result.error ?? "Falha ao salvar pista ou material.");
    setItems((current) => editingId ? current.map((item) => item.id === editingId ? result.item! : item) : [result.item!, ...current]);
    setNotice(editingId ? "Pista ou material atualizado." : "Pista ou material criado.");
    reset();
  }

  async function remove(item: PistaDaCampanha) {
    if (!window.confirm(`Excluir “${item.titulo}”? O registro deixará de aparecer no sistema.`)) return;
    setBusy(true);
    const response = await fetch("/api/master/handouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", campaignId, handoutId: item.id }) });
    const result = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao excluir pista ou material.");
    setItems((current) => current.filter((currentItem) => currentItem.id !== item.id));
    if (editingId === item.id) reset();
    setNotice("Pista ou material excluído.");
  }

  return <div className="mt-6 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
    <form className="panel rounded-lg p-5" onSubmit={save}>
      <div className="flex items-center gap-2"><FileLock2 size={17} className="text-[#d84b57]" /><h2 className="font-extrabold">{editingId ? "Editar pista ou material" : "Nova pista ou material"}</h2></div>
      <label className="mt-4 block text-xs font-bold">Título<input required className="field mt-1" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Tipo<input required className="field mt-1" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))} /></label><label className="text-xs font-bold">Estado<select className="field mt-1" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value as typeof form.state }))}><option value="hidden">Oculta</option><option value="discovered">Descoberta</option><option value="shared">Compartilhada</option><option value="corrupted">Corrompida</option></select></label></div>
      <label className="mt-3 block text-xs font-bold">Visibilidade<select className="field mt-1" value={form.visibility} onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as typeof form.visibility }))}><option value="gm_only">Somente mestres</option><option value="selected">Selecionados</option><option value="owner_only">Dono e mestres</option><option value="campaign">Toda a campanha</option><option value="public">Pública</option></select></label>
      <label className="mt-3 block text-xs font-bold">Resumo seguro<textarea className="field mt-1 min-h-20" value={form.excerpt} onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))} /></label>
      <label className="mt-3 block text-xs font-bold">Conteúdo protegido<textarea className="field mt-1 min-h-32" value={form.content} onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))} /></label>
      <div className="mt-3 flex gap-2"><button className="btn btn-primary" disabled={busy}>{editingId ? <Save size={14} /> : <Plus size={14} />}{editingId ? "Salvar alterações" : "Criar"}</button>{editingId && <button className="btn" type="button" onClick={reset}><X size={14} /> Cancelar</button>}</div>
      {notice && <p className="mt-3 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
    </form>
    <section className="grid content-start gap-3 sm:grid-cols-2">
      {items.map((item) => <article className="panel central-card rounded-lg p-5" key={item.id}><div className="flex justify-between gap-3"><FileLock2 className="text-[#cd4652]" /><span className="tag">{item.estado}</span></div><h2 className="mt-4 font-extrabold">{item.titulo}</h2><p className="mt-2 text-xs text-[#7e8188]">{item.tipo} · {item.visibilidade}</p>{item.resumo && <p className="mt-3 line-clamp-3 text-sm text-[#a3a5ab]">{item.resumo}</p>}<div className="mt-4 flex gap-2"><button className="btn px-3" type="button" onClick={() => edit(item)}><Pencil size={13} /> Editar</button><button className="btn border-[#682d35] px-3 text-[#f0949d]" type="button" disabled={busy} onClick={() => void remove(item)}><Trash2 size={13} /> Excluir</button></div></article>)}
      {items.length === 0 && <p className="rounded-lg border border-dashed border-[#3b3e46] p-6 text-sm text-[#777a82] sm:col-span-2">Nenhuma pista ou material cadastrado.</p>}
    </section>
  </div>;
}
