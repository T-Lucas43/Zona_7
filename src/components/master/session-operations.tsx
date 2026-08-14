"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Dices,
  Eye,
  EyeOff,
  Plus,
  Save,
  Sparkles,
  Swords,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { readSessionDraft, writeSessionDraft } from "@/lib/session-draft";
import type { AbilityUseRequest } from "@/server/repositories/character-repository";
import type { CharacterSummary } from "@/types/domain";
import type {
  AtorDaCampanha,
  CenaDaCampanha,
  EncontroDaCampanha,
} from "@/server/repositories/master-repository";

export function SessionOperations({
  campaignId,
  sessionId,
  scene,
  initialEncounters,
  initialActors,
  initialRequests,
  characters,
  compact = false,
  onEncountersChange,
}: {
  campaignId: string;
  sessionId: string;
  scene: CenaDaCampanha;
  initialEncounters: EncontroDaCampanha[];
  initialActors: AtorDaCampanha[];
  initialRequests: AbilityUseRequest[];
  characters: CharacterSummary[];
  compact?: boolean;
  onEncountersChange?: (encounters: EncontroDaCampanha[]) => void;
}) {
  const [encounters, setEncounters] = useState(initialEncounters);
  const [actors, setActors] = useState(initialActors);
  const [requests, setRequests] = useState(initialRequests);
  const [encounterName, setEncounterName] = useState("");
  const [actorName, setActorName] = useState("");
  const [actorType, setActorType] = useState("npc");
  const [combatantName, setCombatantName] = useState("");
  const [combatantKind, setCombatantKind] = useState<"character" | "ally" | "npc" | "enemy">(
    "character",
  );
  const [combatantInitiative, setCombatantInitiative] = useState(0);
  const [checkCharacterId, setCheckCharacterId] = useState(characters[0]?.id ?? "");
  const [checkAttribute, setCheckAttribute] = useState<"agi" | "for" | "int" | "pre" | "vig">("agi");
  const [checkSkill, setCheckSkill] = useState("");
  const [checkDifficulty, setCheckDifficulty] = useState(15);
  const [checkContext, setCheckContext] = useState("Teste solicitado durante a sessão");
  const [checkConsequences, setCheckConsequences] = useState("");
  const [checkFavorable, setCheckFavorable] = useState(0);
  const [checkUnfavorable, setCheckUnfavorable] = useState(0);
  const [checkModifier, setCheckModifier] = useState(0);
  const [checkMethod, setCheckMethod] = useState<"roll" | "take_10" | "take_20">("roll");
  const [initiativeDrafts, setInitiativeDrafts] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState("");
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = `zona7:session-operations:${campaignId}:${sessionId}`;
  useEffect(() => {
    const draft = readSessionDraft<{
      encounterName: string; actorName: string; actorType: string; combatantName: string;
      combatantKind: "character" | "ally" | "npc" | "enemy"; combatantInitiative: number;
      checkCharacterId: string; checkAttribute: "agi" | "for" | "int" | "pre" | "vig";
      checkSkill: string; checkDifficulty: number; checkContext: string; checkConsequences: string;
      checkFavorable: number; checkUnfavorable: number; checkModifier: number;
      checkMethod: "roll" | "take_10" | "take_20"; initiativeDrafts: Record<string, string>;
    }>(draftKey);
    const frame = window.requestAnimationFrame(() => {
      if (draft) {
        setEncounterName(draft.encounterName); setActorName(draft.actorName); setActorType(draft.actorType);
        setCombatantName(draft.combatantName); setCombatantKind(draft.combatantKind); setCombatantInitiative(draft.combatantInitiative);
        setCheckCharacterId(draft.checkCharacterId); setCheckAttribute(draft.checkAttribute); setCheckSkill(draft.checkSkill);
        setCheckDifficulty(draft.checkDifficulty); setCheckContext(draft.checkContext); setCheckConsequences(draft.checkConsequences);
        setCheckFavorable(draft.checkFavorable); setCheckUnfavorable(draft.checkUnfavorable); setCheckModifier(draft.checkModifier);
        setCheckMethod(draft.checkMethod); setInitiativeDrafts(draft.initiativeDrafts);
      }
      setDraftReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftKey]);
  useEffect(() => {
    if (!draftReady) return;
    writeSessionDraft(draftKey, { encounterName, actorName, actorType, combatantName, combatantKind, combatantInitiative, checkCharacterId, checkAttribute, checkSkill, checkDifficulty, checkContext, checkConsequences, checkFavorable, checkUnfavorable, checkModifier, checkMethod, initiativeDrafts });
  }, [actorName, actorType, checkAttribute, checkCharacterId, checkConsequences, checkContext, checkDifficulty, checkFavorable, checkMethod, checkModifier, checkSkill, checkUnfavorable, combatantInitiative, combatantKind, combatantName, draftKey, draftReady, encounterName, initiativeDrafts]);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setEncounters(initialEncounters);
      setActors(initialActors);
      setRequests(initialRequests);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialActors, initialEncounters, initialRequests]);
  function commitEncounters(
    update: (current: EncontroDaCampanha[]) => EncontroDaCampanha[],
  ) {
    setEncounters((current) => {
      const next = update(current);
      onEncountersChange?.(next);
      return next;
    });
  }
  async function createEncounter(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        campaignId,
        sessionId,
        name: encounterName,
        status: "active",
        round: 0,
        notes: "Criado na Central da Sessão",
      }),
    });
    const result = (await response.json()) as { item?: EncontroDaCampanha; error?: string };
    if (!response.ok || !result.item) return setNotice(result.error ?? "Falha ao criar encontro.");
    commitEncounters((items) => [
      result.item!,
      ...items.map((item) => (item.estado === "active" ? { ...item, estado: "paused" } : item)),
    ]);
    setEncounterName("");
    setNotice("Encontro criado e incluído nesta sessão.");
  }
  async function setEncounter(item: EncontroDaCampanha, status: "active" | "paused" | "ended") {
    const response = await fetch("/api/master/encounters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        campaignId,
        sessionId,
        encounterId: item.id,
        name: item.nome,
        status,
        round: item.rodada,
        notes: item.observacoes,
      }),
    });
    const result = (await response.json()) as { item?: EncontroDaCampanha; error?: string };
    if (!response.ok || !result.item)
      return setNotice(result.error ?? "Falha ao atualizar encontro.");
    commitEncounters((items) =>
      items.map((current) =>
        current.id === item.id
          ? result.item!
          : status === "active" && current.estado === "active"
            ? { ...current, estado: "paused" }
            : current,
      ),
    );
    setNotice(
      `Encontro ${status === "active" ? "incluído" : status === "paused" ? "pausado" : "encerrado"}.`,
    );
  }
  async function createActor(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create",
        campaignId,
        name: actorName,
        actorType,
        description: "Criado durante a sessão",
        color: "#8b5cf6",
        visibility: "gm_only",
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok || !result.id) return setNotice(result.error ?? "Falha ao criar entidade.");
    const item: AtorDaCampanha = {
      id: result.id,
      nome: actorName,
      tipo: actorType,
      descricao: "Criado durante a sessão",
      cor: "#8b5cf6",
      estado: "Ativo",
      visibilidade: "Somente mestres",
      naCena: false,
    };
    setActors((items) => [item, ...items]);
    setActorName("");
    setNotice("Entidade criada. Escolha como inseri-la na cena.");
  }
  async function initiativeAction(
    encounter: EncontroDaCampanha,
    action: "add" | "update" | "remove" | "current",
    combatantId?: string,
  ) {
    const draft = combatantId ? initiativeDrafts[combatantId] : undefined;
    const response = await fetch("/api/master/initiative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        campaignId,
        encounterId: encounter.id,
        ...(action === "add"
          ? {
              name: combatantName,
              kind: combatantKind,
              initiative: combatantInitiative,
            }
          : { combatantId }),
        ...(action === "update"
          ? { initiative: draft === "" || draft === undefined ? null : Number(draft) }
          : {}),
      }),
    });
    const result = (await response.json()) as {
      combatentes?: EncontroDaCampanha["combatentes"];
      error?: string;
    };
    if (!response.ok || !result.combatentes)
      return setNotice(result.error ?? "Falha ao atualizar iniciativa.");
    commitEncounters((items) =>
      items.map((item) =>
        item.id === encounter.id
          ? {
              ...item,
              combatentes: result.combatentes!,
              participantes: result.combatentes!.length,
              turnoAtual: result.combatentes!.find((value) => value.atual)?.posicao ?? null,
            }
          : item,
      ),
    );
    if (action === "add") {
      setCombatantName("");
      setCombatantInitiative(0);
    }
    setNotice(
      action === "add"
        ? "Combatente incluído e ordem recalculada."
        : action === "remove"
          ? "Combatente retirado da iniciativa."
          : action === "current"
            ? "Turno atual sincronizado com todos."
            : "Iniciativa salva e ordem recalculada.",
    );
  }
  async function requestInitiative(encounter: EncontroDaCampanha) {
    const response = await fetch("/api/master/initiative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request",
        campaignId,
        encounterId: encounter.id,
        sessionId,
        sceneId: scene.id,
      }),
    });
    const result = (await response.json()) as { combatentes?: EncontroDaCampanha["combatentes"]; error?: string };
    if (!response.ok || !result.combatentes) return setNotice(result.error ?? "Não foi possível solicitar a iniciativa.");
    commitEncounters((items) => items.map((item) => item.id === encounter.id ? {
      ...item,
      iniciativaEstado: "requested",
      rodada: 0,
      turnoAtual: null,
      participantes: result.combatentes!.length,
      combatentes: result.combatentes!,
    } : item));
    setNotice("Iniciativa solicitada. Os jogadores receberam o pop-up e os NPCs aguardam a rolagem do mestre.");
  }
  async function rollActorInitiative(encounter: EncontroDaCampanha, combatantId: string) {
    const response = await fetch("/api/master/initiative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "roll_actor", campaignId, encounterId: encounter.id, combatantId, sessionId }),
    });
    const result = (await response.json()) as { combatentes?: EncontroDaCampanha["combatentes"]; error?: string };
    if (!response.ok || !result.combatentes) return setNotice(result.error ?? "Não foi possível rolar a iniciativa.");
    const active = result.combatentes.every((item) => item.iniciativa !== null);
    commitEncounters((items) => items.map((item) => item.id === encounter.id ? {
      ...item,
      iniciativaEstado: active ? "active" : "requested",
      rodada: active ? 1 : 0,
      turnoAtual: active ? 0 : null,
      combatentes: result.combatentes!,
    } : item));
    setNotice(active ? "Todos rolaram. A ordem de iniciativa está ativa." : "Iniciativa do NPC registrada e publicada.");
  }
  async function addActor(actor: AtorDaCampanha, visibleToPlayers: boolean) {
    const response = await fetch("/api/master/map/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sceneId: scene.id,
        actorId: actor.id,
        x: 0.5,
        y: 0.5,
        visibleToPlayers,
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao inserir entidade.");
    setActors((items) =>
      items.map((item) =>
        item.id === actor.id
          ? { ...item, naCena: true, tokenId: result.id, tokenVisivel: visibleToPlayers }
          : item,
      ),
    );
    setNotice(
      `${actor.nome} incluído no mapa${visibleToPlayers ? " para todos" : " somente para o mestre"}.`,
    );
  }
  async function actorAction(actor: AtorDaCampanha, action: "hide" | "show" | "remove") {
    const response = await fetch("/api/master/session/actors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sceneId: scene.id, actorId: actor.id, action }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao atualizar entidade.");
    setActors((items) =>
      items.map((item) =>
        item.id === actor.id
          ? { ...item, naCena: action !== "remove", tokenVisivel: action === "show" }
          : item,
      ),
    );
    setNotice(
      `${actor.nome}: ${action === "remove" ? "retirado da cena" : action === "show" ? "visível aos jogadores" : "oculto dos jogadores"}.`,
    );
  }
  async function resolve(requestId: string, approved: boolean) {
    const request = requests.find((item) => item.id === requestId);
    const response = await fetch(request?.requestKind === "attack" ? "/api/combat/requests" : "/api/abilities/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "resolve", campaignId, requestId, approved }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao analisar solicitação.");
    setRequests((items) =>
      items.map((item) =>
        item.id === requestId
          ? {
              ...item,
              status: approved ? "answered" : "revoked",
              decision: approved ? "approved" : "rejected",
            }
          : item,
      ),
    );
    setNotice(
      approved ? "Uso aprovado. O jogador já pode rolar." : "Uso recusado e jogador notificado.",
    );
  }
  async function requestCheck(event: React.FormEvent) {
    event.preventDefault();
    if (!checkCharacterId) return setNotice("Selecione um personagem.");
    const response = await fetch("/api/checks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "request",
        campaignId,
        sessionId,
        characterId: checkCharacterId,
        attribute: checkAttribute,
        skill: checkSkill,
        difficulty: checkDifficulty,
        context: checkContext,
        consequences: checkConsequences,
        favorableDice: checkFavorable,
        unfavorableDice: checkUnfavorable,
        numericModifier: checkModifier,
        method: checkMethod,
      }),
    });
    const result = (await response.json()) as { requestId?: string; error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao solicitar teste.");
    const selectedCharacter = characters.find((item) => item.id === checkCharacterId);
    setNotice(`Teste de ${checkSkill || checkAttribute.toUpperCase()} enviado para ${selectedCharacter?.name ?? "o jogador"}.`);
  }
  return (
    <section
      className={
        compact ? "session-operations-compact space-y-3" : "mt-4 grid gap-4 xl:grid-cols-3"
      }
    >
      <article className={`panel rounded-lg ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Swords size={18} className="text-[#ed5361]" />
            <h2 className="font-extrabold">Encontros</h2>
          </div>
          <span className="tag">{encounters.length}</span>
        </div>
        <form className="mt-3 flex gap-2" onSubmit={createEncounter}>
          <input
            required
            className="field"
            placeholder="Novo encontro"
            value={encounterName}
            onChange={(event) => setEncounterName(event.target.value)}
          />
          <button className="btn btn-primary px-3">
            <Plus size={14} />
          </button>
        </form>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {encounters.map((item) => (
            <div className="rounded border border-[#30333a] p-3" key={item.id}>
              <div className="flex justify-between gap-2">
                <strong className="text-sm">{item.nome}</strong>
                <span className="tag">{item.estado}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.estado !== "active" && (
                  <button
                    className="btn px-2"
                    type="button"
                    onClick={() => void setEncounter(item, "active")}
                  >
                    <Swords size={12} /> Incluir
                  </button>
                )}
                {item.estado === "active" && (
                  <button
                    className="btn px-2"
                    type="button"
                    onClick={() => void setEncounter(item, "paused")}
                  >
                    Pausar
                  </button>
                )}
                <button
                  className="btn px-2"
                  type="button"
                  onClick={() => void setEncounter(item, "ended")}
                >
                  <X size={12} /> Encerrar
                </button>
              </div>
              {item.estado !== "ended" && (
                <div className="mt-3 border-t border-[#30333a] pt-3">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-xs uppercase tracking-wide text-[#d8a1a7]">
                      Ordem de iniciativa
                    </strong>
                    <span className="tag">rodada {item.rodada}</span>
                  </div>
                  <button
                    className="btn btn-primary mt-2 w-full"
                    type="button"
                    onClick={() => void requestInitiative(item)}
                  >
                    <Dices size={13} />
                    {item.iniciativaEstado === "idle" ? "Solicitar iniciativa dos participantes da cena" : "Solicitar iniciativa novamente"}
                  </button>
                  {item.iniciativaEstado === "requested" && (
                    <p className="mt-2 rounded border border-[#6d5527] bg-[#6d5527]/10 p-2 text-xs text-[#e8c16d]">
                      Aguardando as rolagens. O combate só começa quando todos tiverem iniciativa.
                    </p>
                  )}
                  <form
                    className="mt-2 grid grid-cols-[minmax(0,1fr)_4.5rem_auto] gap-1.5"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void initiativeAction(item, "add");
                    }}
                  >
                    <input
                      className="field"
                      required
                      aria-label={`Novo combatente de ${item.nome}`}
                      placeholder="Nome"
                      value={combatantName}
                      onChange={(event) => setCombatantName(event.target.value)}
                    />
                    <input
                      className="field text-center"
                      type="number"
                      min={-100}
                      max={999}
                      aria-label="Iniciativa inicial"
                      value={combatantInitiative}
                      onChange={(event) => setCombatantInitiative(Number(event.target.value))}
                    />
                    <button className="btn px-2" aria-label="Adicionar à iniciativa">
                      <Plus size={13} />
                    </button>
                    <select
                      className="field col-span-3"
                      aria-label="Tipo do combatente"
                      value={combatantKind}
                      onChange={(event) =>
                        setCombatantKind(
                          event.target.value as "character" | "ally" | "npc" | "enemy",
                        )
                      }
                    >
                      <option value="character">Personagem</option>
                      <option value="ally">Aliado</option>
                      <option value="npc">NPC</option>
                      <option value="enemy">Inimigo</option>
                    </select>
                  </form>
                  <ol className="mt-2 space-y-1.5">
                    {item.combatentes.map((combatente) => (
                      <li
                        className={`grid grid-cols-[1.5rem_minmax(0,1fr)_3.6rem_auto] items-center gap-1.5 rounded border p-1.5 ${combatente.atual ? "border-[#8a3943] bg-[#8a1b27]/20" : "border-[#30333a]"}`}
                        key={combatente.id}
                      >
                        <span className="grid size-6 place-items-center rounded-full bg-black/25 font-mono text-[0.65rem]">
                          {combatente.posicao + 1}
                        </span>
                        <button
                          className="min-w-0 truncate text-left text-xs font-bold"
                          type="button"
                          title="Definir como turno atual"
                          onClick={() => void initiativeAction(item, "current", combatente.id)}
                        >
                          {combatente.atual && <CheckCircle2 className="mr-1 inline" size={12} />}
                          {combatente.nome}
                        </button>
                        <input
                          className="field px-1 text-center font-mono text-xs"
                          type="number"
                          min={-100}
                          max={999}
                          aria-label={`Iniciativa de ${combatente.nome}`}
                          value={initiativeDrafts[combatente.id] ?? combatente.iniciativa ?? ""}
                          onChange={(event) =>
                            setInitiativeDrafts((current) => ({
                              ...current,
                              [combatente.id]: event.target.value,
                            }))
                          }
                        />
                        <span className="flex gap-1">
                          {combatente.actorId && combatente.tipo !== "character" && combatente.iniciativa === null && (
                            <button
                              className="btn px-1.5 text-[#e8c16d]"
                              type="button"
                              aria-label={`Rolar iniciativa de ${combatente.nome}`}
                              title="Rolar pelo NPC"
                              onClick={() => void rollActorInitiative(item, combatente.id)}
                            >
                              <Dices size={11} />
                            </button>
                          )}
                          <button
                            className="btn px-1.5"
                            type="button"
                            aria-label={`Salvar iniciativa de ${combatente.nome}`}
                            onClick={() => void initiativeAction(item, "update", combatente.id)}
                          >
                            <Save size={11} />
                          </button>
                          <button
                            className="btn px-1.5 text-[#f0949d]"
                            type="button"
                            aria-label={`Remover ${combatente.nome} da iniciativa`}
                            onClick={() => void initiativeAction(item, "remove", combatente.id)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </span>
                      </li>
                    ))}
                    {item.combatentes.length === 0 && (
                      <li className="text-xs text-[#777a82]">
                        Inclua os participantes para habilitar o avanço de turnos.
                      </li>
                    )}
                  </ol>
                </div>
              )}
            </div>
          ))}
        </div>
      </article>
      <article className={`panel rounded-lg ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-extrabold">Solicitar teste</h2>
          <span className="tag">regra efetiva</span>
        </div>
        <form className="mt-3 space-y-2" onSubmit={requestCheck}>
          <select className="field" aria-label="Personagem do teste" required value={checkCharacterId} onChange={(event) => setCheckCharacterId(event.target.value)}>
            {characters.map((character) => <option value={character.id} key={character.id}>{character.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <select className="field" aria-label="Atributo" value={checkAttribute} onChange={(event) => setCheckAttribute(event.target.value as typeof checkAttribute)}>
              <option value="agi">AGI</option><option value="for">FOR</option><option value="int">INT</option><option value="pre">PRE</option><option value="vig">VIG</option>
            </select>
            <input className="field" aria-label="Perícia" placeholder="Perícia (opcional)" value={checkSkill} onChange={(event) => setCheckSkill(event.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold">DT<input className="field mt-1" type="number" min={0} max={99} value={checkDifficulty} onChange={(event) => setCheckDifficulty(Number(event.target.value))} /></label>
            <label className="text-xs font-bold">Método<select className="field mt-1" value={checkMethod} onChange={(event) => setCheckMethod(event.target.value as typeof checkMethod)}><option value="roll">Rolar</option><option value="take_10">Escolher 10</option><option value="take_20">Escolher 20</option></select></label>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs">Dados +<input className="field mt-1" type="number" min={0} max={20} value={checkFavorable} onChange={(event) => setCheckFavorable(Number(event.target.value))} /></label>
            <label className="text-xs">Dados −<input className="field mt-1" type="number" min={0} max={20} value={checkUnfavorable} onChange={(event) => setCheckUnfavorable(Number(event.target.value))} /></label>
            <label className="text-xs">Bônus<input className="field mt-1" type="number" min={-999} max={999} value={checkModifier} onChange={(event) => setCheckModifier(Number(event.target.value))} /></label>
          </div>
          <textarea className="field min-h-20" required aria-label="Contexto do teste" value={checkContext} onChange={(event) => setCheckContext(event.target.value)} />
          <input className="field" aria-label="Consequência da falha" placeholder="Consequência da falha (opcional)" value={checkConsequences} onChange={(event) => setCheckConsequences(event.target.value)} />
          <button className="btn btn-primary w-full" type="submit"><Dices size={14} /> Enviar solicitação</button>
        </form>
      </article>
      <article className={`panel rounded-lg ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={18} className="text-[#b993ef]" />
            <h2 className="font-extrabold">Entidades e NPCs</h2>
          </div>
          <span className="tag">{actors.filter((item) => item.naCena).length} em cena</span>
        </div>
        <form className="mt-3 grid grid-cols-[1fr_0.75fr_auto] gap-2" onSubmit={createActor}>
          <input
            required
            className="field"
            placeholder="Nome"
            value={actorName}
            onChange={(event) => setActorName(event.target.value)}
          />
          <select
            className="field"
            value={actorType}
            onChange={(event) => setActorType(event.target.value)}
          >
            <option value="npc">NPC</option>
            <option value="entity">Entidade</option>
            <option value="threat">Ameaça</option>
            <option value="narrator">Narrador</option>
          </select>
          <button className="btn btn-primary px-3">
            <UserPlus size={14} />
          </button>
        </form>
        <div className="mt-3 max-h-64 space-y-2 overflow-y-auto">
          {actors.map((actor) => (
            <div className="rounded border border-[#30333a] p-3" key={actor.id}>
              <div className="flex items-center gap-2">
                <CharacterPortrait
                  name={actor.nome}
                  portraitUrl={actor.portraitUrl}
                  className="size-8 rounded-full"
                />
                <strong className="min-w-0 flex-1 truncate text-sm">{actor.nome}</strong>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {!actor.naCena ? (
                  <>
                    <button
                      className="btn px-2"
                      type="button"
                      onClick={() => void addActor(actor, true)}
                    >
                      <Eye size={12} /> Incluir
                    </button>
                    <button
                      className="btn px-2"
                      type="button"
                      onClick={() => void addActor(actor, false)}
                    >
                      <EyeOff size={12} /> Só mestre
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn px-2"
                      type="button"
                      onClick={() => void actorAction(actor, actor.tokenVisivel ? "hide" : "show")}
                    >
                      {actor.tokenVisivel ? <EyeOff size={12} /> : <Eye size={12} />}
                      {actor.tokenVisivel ? "Ocultar" : "Mostrar"}
                    </button>
                    <button
                      className="btn px-2 text-[#f0949d]"
                      type="button"
                      onClick={() => void actorAction(actor, "remove")}
                    >
                      <Trash2 size={12} /> Retirar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </article>
      <article className={`panel rounded-lg ${compact ? "p-4" : "p-5"}`}>
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold">Solicitações de combate</h2>
          <span className="tag">
            {requests.filter((item) => !item.decision).length} pendente(s)
          </span>
        </div>
        <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
          {requests.map((item) => (
            <div className="rounded border border-[#30333a] p-3" key={item.id}>
              <strong className="text-sm">
                {item.characterName} · {item.abilityName}
              </strong>
              <p className="mt-1 text-xs text-[#858891]">{item.context}</p>
              {item.targetNames.length > 0 && <p className="mt-1 text-xs text-[#d2a8ad]"><strong>Alvo(s):</strong> {item.targetNames.join(", ")}</p>}
              {!item.decision ? (
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    className="btn border-[#315b45] px-2 text-[#7bd5a5]"
                    type="button"
                    onClick={() => void resolve(item.id, true)}
                  >
                    Aprovar
                  </button>
                  <button
                    className="btn border-[#6b3038] px-2 text-[#f0a5ad]"
                    type="button"
                    onClick={() => void resolve(item.id, false)}
                  >
                    Recusar
                  </button>
                </div>
              ) : (
                <span className="tag mt-2">
                  {item.decision === "approved"
                    ? item.rolled
                      ? "Rolada"
                      : "Aprovada"
                    : "Recusada"}
                </span>
              )}
            </div>
          ))}
          {requests.length === 0 && <p className="text-xs text-[#777a82]">Nenhuma solicitação.</p>}
        </div>
      </article>
      {notice && (
        <p
          className={`rounded border border-[#315b45] bg-[#153323]/30 p-3 text-xs text-[#7bd5a5] ${compact ? "" : "xl:col-span-3"}`}
          role="status"
        >
          {notice}
        </p>
      )}
    </section>
  );
}
