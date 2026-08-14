"use client";

import { useState } from "react";
import { Archive, Eye, EyeOff, ImageUp, MapPinned, Plus, RotateCcw, Sparkles } from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import type { AtorDaCampanha } from "@/server/repositories/master-repository";
import { ActorCombatEditor } from "@/components/master/actor-combat-editor";

export function ActorManager({
  campaignId,
  initialActors,
  sceneId,
  sceneName,
}: {
  campaignId: string;
  initialActors: AtorDaCampanha[];
  sceneId: string;
  sceneName: string;
}) {
  const [atores, setAtores] = useState(initialActors);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("npc");
  const [descricao, setDescricao] = useState("");
  const [cor, setCor] = useState("#8b5cf6");
  const [aviso, setAviso] = useState("");
  async function criar(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        campaignId,
        name: nome,
        actorType: tipo,
        description: descricao,
        color: cor,
        visibility: "gm_only",
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao criar ator.");
    setAtores((atual) => [
      ...atual,
      {
        id: result.id ?? crypto.randomUUID(),
        nome,
        tipo,
        descricao,
        cor,
        estado: "Ativo",
        visibilidade: "Somente mestres",
        naCena: false,
      },
    ]);
    setNome("");
    setDescricao("");
    setAviso("Ator criado e entregue ao controle do mestre.");
  }
  async function enviarRetrato(ator: AtorDaCampanha, file?: File) {
    if (!file) return;
    const preview = URL.createObjectURL(file);
    setAtores((items) => items.map((item) => item.id === ator.id ? { ...item, portraitUrl: preview } : item));
    const form = new FormData();
    form.set("campaignId", campaignId);
    form.set("actorId", ator.id);
    form.set("assetType", "actor_portrait");
    form.set("title", `Retrato de ${ator.nome}`);
    form.set("file", file);
    const response = await fetch("/api/master/media", { method: "POST", body: form });
    const result = (await response.json()) as { signedUrl?: string | null; error?: string };
    if (!response.ok) return setAviso(result.error ?? "Não foi possível enviar o retrato.");
    if (result.signedUrl) setAtores((items) => items.map((item) => item.id === ator.id ? { ...item, portraitUrl: result.signedUrl ?? preview } : item));
    setAviso(`Retrato de ${ator.nome} atualizado nos painéis e tokens.`);
  }
  async function inserirNaCena(ator: AtorDaCampanha, visibleToPlayers: boolean) {
    const index = atores.findIndex((item) => item.id === ator.id);
    const response = await fetch("/api/master/map/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sceneId,
        actorId: ator.id,
        x: Math.min(0.82, 0.45 + (index % 4) * 0.1),
        y: Math.min(0.82, 0.48 + Math.floor(index / 4) * 0.12),
        visibleToPlayers,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Não foi possível inserir o ator na cena.");
    setAtores((items) => items.map((item) => item.id === ator.id ? { ...item, naCena: true, visibilidade: visibleToPlayers ? "Campanha" : "Somente mestres" } : item));
    setAviso(`${ator.nome} foi inserido em ${sceneName}${visibleToPlayers ? " e está visível aos jogadores" : " somente para o mestre"}.`);
  }
  async function alternar(ator: AtorDaCampanha) {
    const arquivado = ator.estado === "Arquivado";
    const response = await fetch("/api/master/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: arquivado ? "restore" : "archive",
        campaignId,
        actorId: ator.id,
      }),
    });
    if (!response.ok) return setAviso("Não foi possível atualizar o ator.");
    setAtores((atual) =>
      atual.map((item) =>
        item.id === ator.id ? { ...item, estado: arquivado ? "Ativo" : "Arquivado" } : item,
      ),
    );
  }
  return (
    <div className="mt-6 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
      <section className="panel rounded-lg p-5">
        <div className="flex items-center gap-2">
          <Sparkles className="text-[#d84b57]" size={18} />
          <h2 className="text-xl font-extrabold">Atores controlados pelo mestre</h2>
        </div>
        <p className="mt-2 text-sm text-[#8f9299]">
          Controle NPCs, entidades, ameaças, narradores e o próprio ambiente sem editar código.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {atores.map((ator) => (
            <article className="rounded-lg border border-[#30333a] p-4" key={ator.id}>
              <div className="flex justify-between gap-3">
                <CharacterPortrait name={ator.nome} portraitUrl={ator.portraitUrl} className="size-16 rounded-xl" />
                <div className="flex flex-col items-end gap-2"><span className="tag">{ator.estado}</span>{ator.naCena && <span className="tag"><MapPinned size={11} /> Na cena</span>}</div>
              </div>
              <h3 className="mt-3 font-extrabold">{ator.nome}</h3>
              <p className="mt-1 text-xs text-[#777a82]">
                {ator.tipo} · {ator.visibilidade}
              </p>
              <p className="mt-3 text-sm text-[#a3a5ab]">{ator.descricao}</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <label className="btn cursor-pointer"><ImageUp size={14} /> Enviar imagem<input className="sr-only" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void enviarRetrato(ator, event.target.files?.[0])} /></label>
                <button className="btn" type="button" onClick={() => void alternar(ator)}>{ator.estado === "Arquivado" ? <RotateCcw size={14} /> : <Archive size={14} />}{ator.estado === "Arquivado" ? "Restaurar" : "Arquivar"}</button>
                <button className="btn" type="button" disabled={ator.estado === "Arquivado"} onClick={() => void inserirNaCena(ator, false)}><EyeOff size={14} /> Inserir só para mestre</button>
                <button className="btn border-[#356248] text-[#87d9ab]" type="button" disabled={ator.estado === "Arquivado"} onClick={() => void inserirNaCena(ator, true)}><Eye size={14} /> Inserir para todos</button>
              </div>
              <ActorCombatEditor campaignId={campaignId} actor={ator} />
            </article>
          ))}
        </div>
      </section>
      <form className="panel rounded-lg p-5" onSubmit={criar}>
        <h2 className="font-extrabold">Criar ator livre</h2>
        <p className="mt-2 text-xs text-[#7f8289]">Cena atual: {sceneName}</p>
        <label className="mt-4 block text-xs font-bold">
          Nome
          <input
            required
            className="field mt-1"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-bold">
          Tipo
          <select
            className="field mt-1"
            value={tipo}
            onChange={(event) => setTipo(event.target.value)}
          >
            <option value="npc">Personagem não jogável</option>
            <option value="entity">Entidade</option>
            <option value="environment">Ambiente</option>
            <option value="threat">Ameaça</option>
            <option value="narrator">Narrador</option>
          </select>
        </label>
        <label className="mt-3 block text-xs font-bold">
          Descrição
          <textarea
            required
            className="field mt-1 min-h-24"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-bold">
          Cor
          <input
            type="color"
            className="field mt-1 h-12"
            value={cor}
            onChange={(event) => setCor(event.target.value)}
          />
        </label>
        <button className="btn btn-primary mt-4">
          <Plus size={14} /> Criar ator
        </button>
      </form>
      {aviso && (
        <p role="status" className="text-xs text-[#7bd5a5] xl:col-span-2">
          {aviso}
        </p>
      )}
    </div>
  );
}
