"use client";

import Link from "next/link";
import { useState } from "react";
import { Pencil, Plus, Save, Swords, Trash2, Users, X } from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import type {
  AtorDaCampanha,
  EncontroDaCampanha,
} from "@/server/repositories/master-repository";

const emptyForm = { name: "", status: "draft" as const, round: 0, notes: "" };

export function EncounterManager({
  campaignId,
  initialItems,
  actors,
}: {
  campaignId: string;
  initialItems: EncontroDaCampanha[];
  actors: AtorDaCampanha[];
}) {
  const [items, setItems] = useState(initialItems);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedActorIds, setSelectedActorIds] = useState<string[]>([]);
  const [form, setForm] = useState<{
    name: string;
    status: "draft" | "active" | "paused" | "ended";
    round: number;
    notes: string;
  }>(emptyForm);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  function edit(item: EncontroDaCampanha) {
    setEditingId(item.id);
    setForm({
      name: item.nome,
      status: item.estado as typeof form.status,
      round: item.rodada,
      notes: item.observacoes,
    });
    setSelectedActorIds(
      item.combatentes.flatMap((combatant) =>
        combatant.actorId && actors.some((actor) => actor.id === combatant.actorId)
          ? [combatant.actorId]
          : [],
      ),
    );
    setNotice("");
  }

  function reset() {
    setEditingId(null);
    setSelectedActorIds([]);
    setForm(emptyForm);
  }

  function toggleActor(actorId: string) {
    setSelectedActorIds((current) =>
      current.includes(actorId)
        ? current.filter((id) => id !== actorId)
        : [...current, actorId],
    );
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    const response = await fetch("/api/master/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editingId ? "update" : "create",
        campaignId,
        encounterId: editingId,
        actorIds: selectedActorIds,
        ...form,
      }),
    });
    const result = (await response.json()) as { item?: EncontroDaCampanha; error?: string };
    setBusy(false);
    if (!response.ok || !result.item)
      return setNotice(result.error ?? "Falha ao salvar encontro.");
    setItems((current) =>
      editingId
        ? current.map((item) => (item.id === editingId ? result.item! : item))
        : [result.item!, ...current],
    );
    setNotice(
      editingId
        ? "Encontro e elenco atualizados."
        : "Encontro criado com o elenco selecionado.",
    );
    reset();
  }

  async function remove(item: EncontroDaCampanha) {
    if (!window.confirm("Excluir definitivamente o encontro “" + item.nome + "”?")) return;
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
    <div className="mt-6 grid gap-4 xl:grid-cols-[0.85fr_1.15fr]">
      <form className="panel rounded-lg p-5" onSubmit={save}>
        <div className="flex items-center gap-2">
          <Swords size={17} className="text-[#d84b57]" />
          <h2 className="font-extrabold">
            {editingId ? "Editar encontro" : "Novo encontro"}
          </h2>
        </div>
        <label className="mt-4 block text-xs font-bold">
          Nome
          <input
            required
            className="field mt-1"
            value={form.name}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
          />
        </label>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">
            Estado
            <select
              className="field mt-1"
              value={form.status}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  status: event.target.value as typeof form.status,
                }))
              }
            >
              <option value="draft">Rascunho</option>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="ended">Encerrado</option>
            </select>
          </label>
          <label className="text-xs font-bold">
            Rodada
            <input
              className="field mt-1"
              type="number"
              min="0"
              value={form.round}
              onChange={(event) =>
                setForm((current) => ({ ...current, round: Number(event.target.value) }))
              }
            />
          </label>
        </div>
        <label className="mt-3 block text-xs font-bold">
          Anotações do mestre
          <textarea
            className="field mt-1 min-h-24"
            value={form.notes}
            onChange={(event) =>
              setForm((current) => ({ ...current, notes: event.target.value }))
            }
          />
        </label>

        <fieldset className="mt-4 border-t border-[#30333a] pt-4">
          <legend className="flex items-center gap-2 pr-2 text-xs font-black uppercase tracking-wide text-[#d8a1a7]">
            <Users size={14} /> Entidades, NPCs e inimigos vinculados
          </legend>
          <p className="mt-2 text-xs leading-5 text-[#858890]">
            O encontro usa a ficha, os PV, os ataques e o retrato do cadastro original.
            O mestre rola a iniciativa desses participantes.
          </p>
          <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
            {actors.map((actor) => {
              const selected = selectedActorIds.includes(actor.id);
              return (
                <label
                  className={
                    "flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition " +
                    (selected
                      ? "border-[#a93b48] bg-[#7a1c28]/20"
                      : "border-[#30333a] bg-black/10 hover:border-[#4b505a]")
                  }
                  key={actor.id}
                >
                  <input
                    className="accent-[#c92e3e]"
                    type="checkbox"
                    checked={selected}
                    onChange={() => toggleActor(actor.id)}
                  />
                  <CharacterPortrait
                    name={actor.nome}
                    portraitUrl={actor.portraitUrl}
                    className="size-10 shrink-0 rounded-full"
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm">{actor.nome}</strong>
                    <small className="block truncate text-[#858890]">
                      {actor.tipo} · PV {actor.ficha?.recursos.pv.atual ?? "—"}/
                      {actor.ficha?.recursos.pv.maximo ?? "—"} · {actor.ataques?.length ?? 0} ataque(s)
                    </small>
                  </span>
                </label>
              );
            })}
            {actors.length === 0 && (
              <p className="rounded-lg border border-dashed border-[#3b3e46] p-4 text-xs text-[#858890]">
                Cadastre primeiro a entidade ou NPC na ficha correspondente.{" "}
                <Link
                  className="text-[#ef7d88] underline"
                  href={"/master/campaigns/" + campaignId + "/actors"}
                >
                  Abrir Entidades e NPCs
                </Link>
              </p>
            )}
          </div>
        </fieldset>

        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn btn-primary" disabled={busy}>
            {editingId ? <Save size={14} /> : <Plus size={14} />}
            {editingId ? "Salvar alterações" : "Criar encontro"}
          </button>
          {editingId && (
            <button className="btn" type="button" onClick={reset}>
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
        {notice && (
          <p className="mt-3 text-xs text-[#7bd5a5]" role="status">
            {notice}
          </p>
        )}
      </form>

      <section className="grid content-start gap-3 md:grid-cols-2">
        {items.map((item) => {
          const linkedActors = actors.filter((actor) =>
            item.combatentes.some((combatant) => combatant.actorId === actor.id),
          );
          return (
            <article className="panel central-card rounded-lg p-5" key={item.id}>
              <div className="flex justify-between gap-3">
                <Swords className="text-[#d54a56]" />
                <span className="tag">{(item.estado ?? "preparando").toUpperCase()}</span>
              </div>
              <h2 className="mt-4 font-extrabold">{item.nome}</h2>
              <p className="mt-2 text-xs text-[#858890]">
                Rodada {item.rodada} · {item.participantes} participantes
              </p>
              {linkedActors.length > 0 && (
                <div className="mt-3">
                  <p className="text-[0.62rem] font-black uppercase tracking-wide text-[#a8abb2]">
                    Elenco vinculado
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {linkedActors.map((actor) => (
                      <span
                        className="flex items-center gap-1.5 rounded-full border border-[#343840] bg-black/20 py-1 pl-1 pr-2 text-[0.65rem]"
                        key={actor.id}
                      >
                        <CharacterPortrait
                          name={actor.nome}
                          portraitUrl={actor.portraitUrl}
                          className="size-6 rounded-full"
                        />
                        {actor.nome}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {item.observacoes && (
                <p className="mt-3 line-clamp-3 text-xs leading-5 text-[#a3a5ab]">
                  {item.observacoes}
                </p>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                <button className="btn px-3" type="button" onClick={() => edit(item)}>
                  <Pencil size={13} /> Editar elenco
                </button>
                <button
                  className="btn border-[#682d35] px-3 text-[#f0949d]"
                  type="button"
                  disabled={busy}
                  onClick={() => void remove(item)}
                >
                  <Trash2 size={13} /> Excluir
                </button>
              </div>
            </article>
          );
        })}
        {items.length === 0 && (
          <p className="rounded-lg border border-dashed border-[#3b3e46] p-6 text-sm text-[#777a82] md:col-span-2">
            Nenhum encontro cadastrado. Use o formulário para criar o primeiro.
          </p>
        )}
      </section>
    </div>
  );
}
