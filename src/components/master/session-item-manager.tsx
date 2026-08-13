"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, PackagePlus, Pencil, Save, Trash2, X } from "lucide-react";
import type { ItemDaCampanha } from "@/server/repositories/master-repository";

const blank = { name: "", description: "", category: "Item de sessão" };

export function SessionItemManager({
  campaignId,
  initialItems,
  compact = false,
}: {
  campaignId: string;
  initialItems: ItemDaCampanha[];
  compact?: boolean;
}) {
  const [items, setItems] = useState(initialItems);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [notice, setNotice] = useState("");
  async function save(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: editing ? "update" : "create",
        campaignId,
        itemId: editing,
        ...form,
      }),
    });
    const result = (await response.json()) as { item?: ItemDaCampanha; error?: string };
    if (!response.ok || !result.item) return setNotice(result.error ?? "Falha ao salvar item.");
    setItems((current) =>
      editing
        ? current.map((item) => (item.id === editing ? result.item! : item))
        : [result.item!, ...current],
    );
    setEditing(null);
    setForm(blank);
    setNotice("Item salvo no catálogo da sessão.");
  }
  async function remove(id: string) {
    const response = await fetch("/api/master/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", campaignId, itemId: id }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao excluir item.");
    setItems((current) => current.filter((item) => item.id !== id));
    setNotice("Item removido do catálogo.");
  }
  async function uploadImage(item: ItemDaCampanha, file?: File) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setItems((current) =>
      current.map((value) => (value.id === item.id ? { ...value, imageUrl: preview } : value)),
    );
    const body = new FormData();
    body.set("campaignId", campaignId);
    body.set("itemId", item.id);
    body.set("assetType", "item");
    body.set("title", `Imagem de ${item.nome}`);
    body.set("file", file);
    const response = await fetch("/api/master/media", { method: "POST", body });
    const result = (await response.json()) as {
      signedUrl?: string | null;
      imagePath?: string;
      error?: string;
    };
    if (!response.ok) return setNotice(result.error ?? "Falha ao enviar a imagem do item.");
    setItems((current) =>
      current.map((value) =>
        value.id === item.id
          ? { ...value, imageUrl: result.signedUrl ?? preview, imagePath: result.imagePath }
          : value,
      ),
    );
    setNotice(`Imagem de “${item.nome}” atualizada no catálogo e no mapa.`);
  }
  return (
    <div className={compact ? "space-y-3" : "mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.28fr]"}>
      <form className="panel rounded-lg p-5" onSubmit={save}>
        <div className="flex items-center gap-2">
          <PackagePlus size={17} />
          <h2 className="font-extrabold">{editing ? "Editar item" : "Novo item da sessão"}</h2>
        </div>
        <input
          required
          className="field mt-3"
          placeholder="Nome"
          value={form.name}
          onChange={(event) => setForm((value) => ({ ...value, name: event.target.value }))}
        />
        <input
          required
          className="field mt-2"
          placeholder="Categoria"
          value={form.category}
          onChange={(event) => setForm((value) => ({ ...value, category: event.target.value }))}
        />
        <textarea
          className="field mt-2 min-h-20"
          placeholder="Descrição e efeito"
          value={form.description}
          onChange={(event) => setForm((value) => ({ ...value, description: event.target.value }))}
        />
        <div className="mt-3 flex gap-2">
          <button className="btn btn-primary">
            <Save size={14} /> Salvar
          </button>
          {editing && (
            <button
              className="btn"
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(blank);
              }}
            >
              <X size={14} /> Cancelar
            </button>
          )}
        </div>
      </form>
      <section className="grid content-start gap-2 md:grid-cols-2">
        {items.map((item) => (
          <article className="panel item-catalog-card rounded-lg p-4" key={item.id}>
            <div className="item-catalog-image">
              {item.imageUrl ? (
                <Image src={item.imageUrl} alt={`Imagem de ${item.nome}`} fill sizes="88px" />
              ) : (
                <PackagePlus size={28} aria-hidden="true" />
              )}
            </div>
            <div>
              <span className="tag">{item.categoria}</span>
              <h3 className="mt-3 font-extrabold">{item.nome}</h3>
              <p className="mt-2 text-xs leading-5 text-[#92959c]">
                {item.descricao || "Sem descrição."}
              </p>
            </div>
            <div className="item-catalog-actions mt-3 flex flex-wrap gap-2">
              <label className="btn cursor-pointer px-3">
                <ImagePlus size={13} /> Imagem
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(event) => void uploadImage(item, event.target.files?.[0])}
                />
              </label>
              <button
                className="btn px-3"
                type="button"
                onClick={() => {
                  setEditing(item.id);
                  setForm({
                    name: item.nome,
                    description: item.descricao,
                    category: item.categoria,
                  });
                }}
              >
                <Pencil size={13} /> Editar
              </button>
              <button
                className="btn px-3 text-[#f0949d]"
                type="button"
                onClick={() => void remove(item.id)}
              >
                <Trash2 size={13} /> Excluir
              </button>
            </div>
          </article>
        ))}
        {items.length === 0 && (
          <p className="rounded border border-dashed border-[#3b3e46] p-5 text-sm text-[#777a82]">
            Nenhum item cadastrado.
          </p>
        )}
      </section>
      {notice && (
        <p className="text-xs text-[#7bd5a5] xl:col-span-2" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
