"use client";

import { useState } from "react";
import { Eye, EyeOff, Plus, Sparkles, Swords, Trash2, UserPlus, X } from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import type { AbilityUseRequest } from "@/server/repositories/character-repository";
import type { AtorDaCampanha, CenaDaCampanha, EncontroDaCampanha } from "@/server/repositories/master-repository";

export function SessionOperations({ campaignId, sessionId, scene, initialEncounters, initialActors, initialRequests }: {
  campaignId: string; sessionId: string; scene: CenaDaCampanha; initialEncounters: EncontroDaCampanha[];
  initialActors: AtorDaCampanha[]; initialRequests: AbilityUseRequest[];
}) {
  const [encounters, setEncounters] = useState(initialEncounters);
  const [actors, setActors] = useState(initialActors);
  const [requests, setRequests] = useState(initialRequests);
  const [encounterName, setEncounterName] = useState("");
  const [actorName, setActorName] = useState("");
  const [actorType, setActorType] = useState("npc");
  const [notice, setNotice] = useState("");
  async function createEncounter(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/encounters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", campaignId, sessionId, name: encounterName, status: "active", round: 0, notes: "Criado na Central da Sessão" }) });
    const result = await response.json() as { item?: EncontroDaCampanha; error?: string };
    if (!response.ok || !result.item) return setNotice(result.error ?? "Falha ao criar encontro.");
    setEncounters((items) => [result.item!, ...items.map((item) => item.estado === "active" ? { ...item, estado: "paused" } : item)]); setEncounterName(""); setNotice("Encontro criado e incluído nesta sessão.");
  }
  async function setEncounter(item: EncontroDaCampanha, status: "active" | "paused" | "ended") {
    const response = await fetch("/api/master/encounters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "update", campaignId, sessionId, encounterId: item.id, name: item.nome, status, round: item.rodada, notes: item.observacoes }) });
    const result = await response.json() as { item?: EncontroDaCampanha; error?: string };
    if (!response.ok || !result.item) return setNotice(result.error ?? "Falha ao atualizar encontro.");
    setEncounters((items) => items.map((current) => current.id === item.id ? { ...result.item!, participantes: current.participantes } : status === "active" && current.estado === "active" ? { ...current, estado: "paused" } : current));
    setNotice(`Encontro ${status === "active" ? "incluído" : status === "paused" ? "pausado" : "encerrado"}.`);
  }
  async function createActor(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/actors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "create", campaignId, name: actorName, actorType, description: "Criado durante a sessão", color: "#8b5cf6", visibility: "gm_only" }) });
    const result = await response.json() as { id?: string; error?: string };
    if (!response.ok || !result.id) return setNotice(result.error ?? "Falha ao criar entidade.");
    const item: AtorDaCampanha = { id: result.id, nome: actorName, tipo: actorType, descricao: "Criado durante a sessão", cor: "#8b5cf6", estado: "Ativo", visibilidade: "Somente mestres", naCena: false };
    setActors((items) => [item, ...items]); setActorName(""); setNotice("Entidade criada. Escolha como inseri-la na cena.");
  }
  async function addActor(actor: AtorDaCampanha, visibleToPlayers: boolean) {
    const response = await fetch("/api/master/map/tokens", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, sceneId: scene.id, actorId: actor.id, x: 0.5, y: 0.5, visibleToPlayers }) });
    const result = await response.json() as { id?: string; error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao inserir entidade.");
    setActors((items) => items.map((item) => item.id === actor.id ? { ...item, naCena: true, tokenId: result.id, tokenVisivel: visibleToPlayers } : item)); setNotice(`${actor.nome} incluído no mapa${visibleToPlayers ? " para todos" : " somente para o mestre"}.`);
  }
  async function actorAction(actor: AtorDaCampanha, action: "hide" | "show" | "remove") {
    const response = await fetch("/api/master/session/actors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, sceneId: scene.id, actorId: actor.id, action }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao atualizar entidade.");
    setActors((items) => items.map((item) => item.id === actor.id ? { ...item, naCena: action !== "remove", tokenVisivel: action === "show" } : item)); setNotice(`${actor.nome}: ${action === "remove" ? "retirado da cena" : action === "show" ? "visível aos jogadores" : "oculto dos jogadores"}.`);
  }
  async function resolve(requestId: string, approved: boolean) {
    const response = await fetch("/api/abilities/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "resolve", campaignId, requestId, approved }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao analisar solicitação.");
    setRequests((items) => items.map((item) => item.id === requestId ? { ...item, status: approved ? "answered" : "revoked", decision: approved ? "approved" : "rejected" } : item)); setNotice(approved ? "Uso aprovado. O jogador já pode rolar." : "Uso recusado e jogador notificado.");
  }
  return <section className="mt-4 grid gap-4 xl:grid-cols-3">
    <article className="panel rounded-lg p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Swords size={18} className="text-[#ed5361]" /><h2 className="font-extrabold">Encontros</h2></div><span className="tag">{encounters.length}</span></div>
      <form className="mt-3 flex gap-2" onSubmit={createEncounter}><input required className="field" placeholder="Novo encontro" value={encounterName} onChange={(event) => setEncounterName(event.target.value)} /><button className="btn btn-primary px-3"><Plus size={14} /></button></form>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{encounters.map((item) => <div className="rounded border border-[#30333a] p-3" key={item.id}><div className="flex justify-between gap-2"><strong className="text-sm">{item.nome}</strong><span className="tag">{item.estado}</span></div><div className="mt-2 flex flex-wrap gap-2">{item.estado !== "active" && <button className="btn px-2" type="button" onClick={() => void setEncounter(item, "active")}><Swords size={12} /> Incluir</button>}{item.estado === "active" && <button className="btn px-2" type="button" onClick={() => void setEncounter(item, "paused")}>Pausar</button>}<button className="btn px-2" type="button" onClick={() => void setEncounter(item, "ended")}><X size={12} /> Encerrar</button></div></div>)}</div>
    </article>
    <article className="panel rounded-lg p-5"><div className="flex items-center justify-between"><div className="flex items-center gap-2"><Sparkles size={18} className="text-[#b993ef]" /><h2 className="font-extrabold">Entidades e NPCs</h2></div><span className="tag">{actors.filter((item) => item.naCena).length} em cena</span></div>
      <form className="mt-3 grid grid-cols-[1fr_0.75fr_auto] gap-2" onSubmit={createActor}><input required className="field" placeholder="Nome" value={actorName} onChange={(event) => setActorName(event.target.value)} /><select className="field" value={actorType} onChange={(event) => setActorType(event.target.value)}><option value="npc">NPC</option><option value="entity">Entidade</option><option value="threat">Ameaça</option><option value="narrator">Narrador</option></select><button className="btn btn-primary px-3"><UserPlus size={14} /></button></form>
      <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">{actors.map((actor) => <div className="rounded border border-[#30333a] p-3" key={actor.id}><div className="flex items-center gap-2"><CharacterPortrait name={actor.nome} portraitUrl={actor.portraitUrl} className="size-8 rounded-full" /><strong className="min-w-0 flex-1 truncate text-sm">{actor.nome}</strong></div><div className="mt-2 flex flex-wrap gap-1">{!actor.naCena ? <><button className="btn px-2" type="button" onClick={() => void addActor(actor, true)}><Eye size={12} /> Incluir</button><button className="btn px-2" type="button" onClick={() => void addActor(actor, false)}><EyeOff size={12} /> Só mestre</button></> : <><button className="btn px-2" type="button" onClick={() => void actorAction(actor, actor.tokenVisivel ? "hide" : "show")}>{actor.tokenVisivel ? <EyeOff size={12} /> : <Eye size={12} />}{actor.tokenVisivel ? "Ocultar" : "Mostrar"}</button><button className="btn px-2 text-[#f0949d]" type="button" onClick={() => void actorAction(actor, "remove")}><Trash2 size={12} /> Retirar</button></>}</div></div>)}</div>
    </article>
    <article className="panel rounded-lg p-5"><div className="flex items-center justify-between"><h2 className="font-extrabold">Solicitações de habilidades</h2><span className="tag">{requests.filter((item) => !item.decision).length} pendente(s)</span></div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">{requests.map((item) => <div className="rounded border border-[#30333a] p-3" key={item.id}><strong className="text-sm">{item.characterName} · {item.abilityName}</strong><p className="mt-1 text-xs text-[#858891]">{item.context}</p>{!item.decision ? <div className="mt-2 grid grid-cols-2 gap-2"><button className="btn border-[#315b45] px-2 text-[#7bd5a5]" type="button" onClick={() => void resolve(item.id, true)}>Aprovar</button><button className="btn border-[#6b3038] px-2 text-[#f0a5ad]" type="button" onClick={() => void resolve(item.id, false)}>Recusar</button></div> : <span className="tag mt-2">{item.decision === "approved" ? item.rolled ? "Rolada" : "Aprovada" : "Recusada"}</span>}</div>)}{requests.length === 0 && <p className="text-xs text-[#777a82]">Nenhuma solicitação.</p>}</div>
    </article>
    {notice && <p className="rounded border border-[#315b45] bg-[#153323]/30 p-3 text-xs text-[#7bd5a5] xl:col-span-3" role="status">{notice}</p>}
  </section>;
}
