"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Backpack,
  BookOpen,
  Eye,
  EyeOff,
  HeartPulse,
  MessageSquare,
  Package,
  PanelRightClose,
  PanelRightOpen,
  Radio,
  ScrollText,
  Send,
  ShieldAlert,
  Sparkles,
  Swords,
  Trash2,
  WandSparkles,
  UserRound,
  Users,
} from "lucide-react";
import { LiveSync } from "@/components/live-sync";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { CharacterPdfActions } from "@/components/character/character-pdf-actions";
import { AbilityDetails } from "@/components/character/ability-details";
import { CharacterLiveControls } from "@/components/master/character-live-controls";
import { MapStudio } from "@/components/master/map-studio";
import { SessionControls } from "@/components/master/session-controls";
import { SessionClock } from "@/components/master/session-clock";
import { SessionScriptControl } from "@/components/master/session-script-control";
import { SessionOperations } from "@/components/master/session-operations";
import { SessionInitiativeStrip } from "@/components/master/session-initiative-strip";
import { SessionTimeline } from "@/components/master/session-timeline";
import { SessionSummaryManager } from "@/components/master/session-summary-manager";
import { LiveRollFeed } from "@/components/player/live-roll-feed";
import { publishDemoRealtime } from "@/lib/demo-realtime";
import type { CharacterSummary, ResourceKind, SessionSummary } from "@/types/domain";
import type {
  AtorDaCampanha,
  CenaDaCampanha,
  ContaDaCampanha,
  EncontroDaCampanha,
  ItemDaCampanha,
  PistaDaCampanha,
  Remetente,
  RoteiroDaCampanha,
} from "@/server/repositories/master-repository";
import type { SessionPublicState } from "@/server/repositories/session-repository";
import type { SessionScriptRun } from "@/server/repositories/script-repository";
import type { SessionSummaryData, SessionTimelineEntry } from "@/server/repositories/session-history-repository";
import type {
  AbilityUseRequest,
  CharacterCheckRequest,
  PublicDiceRoll,
  SessionCharacterDetails,
} from "@/server/repositories/character-repository";

const resourceLabels: Record<ResourceKind, string> = { pv: "PV", pe: "PE", san: "SAN" };

function isItemInUse(state: string) {
  const normalized = state
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    normalized.includes("equipado") ||
    normalized.includes("em uso") ||
    normalized.includes("usado") ||
    normalized.includes("ativo")
  );
}

export function SessionHub({
  campaignId,
  session,
  initialPublicState,
  initialCharacters,
  characterDetails,
  scene,
  accounts,
  senders,
  scripts,
  initialScriptRun,
  encounters,
  actors,
  items,
  handouts,
  initialAbilityRequests,
  initialCheckRequests,
  initialRolls,
  initialSceneSyncEnabled,
  visibleCharacterIds,
  initialTimeline,
  initialSessionSummary,
}: {
  campaignId: string;
  session: SessionSummary;
  initialPublicState: SessionPublicState;
  initialCharacters: CharacterSummary[];
  characterDetails: SessionCharacterDetails[];
  scene: CenaDaCampanha;
  accounts: ContaDaCampanha[];
  senders: Remetente[];
  scripts: RoteiroDaCampanha[];
  initialScriptRun: SessionScriptRun | null;
  encounters: EncontroDaCampanha[];
  actors: AtorDaCampanha[];
  items: ItemDaCampanha[];
  handouts: PistaDaCampanha[];
  initialAbilityRequests: AbilityUseRequest[];
  initialCheckRequests: CharacterCheckRequest[];
  initialRolls: PublicDiceRoll[];
  initialSceneSyncEnabled: boolean;
  visibleCharacterIds: string[];
  initialTimeline: SessionTimelineEntry[];
  initialSessionSummary: SessionSummaryData | null;
}) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [details, setDetails] = useState(characterDetails);
  const [selectedId, setSelectedId] = useState(initialCharacters[0]?.id ?? "");
  const [visible, setVisible] = useState(() => new Set(visibleCharacterIds));
  const [notice, setNotice] = useState("");
  const [resource, setResource] = useState<ResourceKind>("pv");
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState("Acontecimento da sessão");
  const [deliveryKind, setDeliveryKind] = useState<"item" | "handout">("item");
  const [deliveryTarget, setDeliveryTarget] = useState<"selected" | "all">("selected");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [deliveryCatalogId, setDeliveryCatalogId] = useState("new");
  const [messageTarget, setMessageTarget] = useState<"selected" | "all">("selected");
  const [messageSender, setMessageSender] = useState(senders[0]?.nome ?? "Mestre");
  const [messageBody, setMessageBody] = useState("");
  const [messageReview, setMessageReview] = useState(false);
  const [publicState, setPublicState] = useState(initialPublicState);
  const [sheetTab, setSheetTab] = useState<"summary" | "inventory" | "abilities" | "rules">(
    "summary",
  );
  const [sceneSyncEnabled, setSceneSyncEnabled] = useState(initialSceneSyncEnabled);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [liveEncounters, setLiveEncounters] = useState(encounters);
  const [sceneSelection, setSceneSelection] = useState<CenaDaCampanha["tokens"][number] | null>(null);
  const selected = useMemo(
    () => characters.find((item) => item.id === selectedId) ?? characters[0],
    [characters, selectedId],
  );
  const selectedDetails = details.find((item) => item.characterId === selected?.id);
  const selectedAccount = accounts.find((account) => account.personagemId === selected?.id);
  const selectedActiveItems =
    selectedDetails?.inventory.filter((item) => isItemInUse(item.state)) ?? [];
  const activeEncounter =
    liveEncounters.find((encounter) => encounter.estado === "active") ??
    liveEncounters.find((encounter) => encounter.estado === "paused") ??
    null;
  const preparedCheck =
    initialCheckRequests.find((request) => request.characterId === selected?.id) ??
    initialCheckRequests[0];
  const currentCombatant = activeEncounter?.combatentes.find((combatant) => combatant.atual);
  const normalizeName = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const selectedCanAct = Boolean(selected) && !["dying", "dead"].includes(selected?.characterState ?? "active") && !selected?.conditions.some((condition) => /morto|inconsciente|incapacitado/i.test(condition));
  const selectedHasTurn = !currentCombatant || (selected ? normalizeName(currentCombatant.nome).includes(normalizeName(selected.name).split(" ")[0]) : false);
  const selectedHasEnergy = (selected?.resources.pe.current ?? 0) > 0;
  const selectedToken = scene.tokens.find((token) => token.characterId === selected?.id);
  const nearestThreat = selectedToken ? scene.tokens.filter((token) => token.atorId && ["threat", "entity", "npc"].includes(token.actorType ?? "")).map((token) => ({ token, distance: Math.hypot((token.x - selectedToken.x) * 16, (token.y - selectedToken.y) * 9) })).sort((a, b) => a.distance - b.distance)[0] : undefined;
  function focusControl(id: string) {
    window.requestAnimationFrame(() =>
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  }
  async function mutateResource(direction: -1 | 1) {
    if (!selected) return;
    const response = await fetch("/api/resources/mutate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterId: selected.id,
        resource,
        delta: direction * Math.abs(amount),
        operation:
          direction < 0
            ? resource === "pv"
              ? "damage"
              : "loss"
            : resource === "pv"
              ? "healing"
              : "recovery",
        source: "Central da sessão",
        reason,
        visibility: "owner_only",
        sessionId: session.id.match(/^[0-9a-f-]{36}$/i) ? session.id : undefined,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar recurso.");
    const before = selected.resources[resource];
    const current = Math.max(
      0,
      Math.min(before.maximum, before.current + direction * Math.abs(amount)),
    );
    setCharacters((items) =>
      items.map((item) =>
        item.id === selected.id
          ? { ...item, resources: { ...item.resources, [resource]: { ...before, current } } }
          : item,
      ),
    );
    setNotice(
      `${selected.name}: ${resourceLabels[resource]} alterado para ${current}. O jogador será atualizado em tempo real.`,
    );
  }

  async function toggleVisibility() {
    if (!selected) return;
    const next = !visible.has(selected.id);
    const response = await fetch("/api/master/session/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, characterId: selected.id, visible: next }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar visibilidade.");
    setVisible((current) => {
      const copy = new Set(current);
      if (next) copy.add(selected.id);
      else copy.delete(selected.id);
      return copy;
    });
    setNotice(`${selected.name} ${next ? "voltou à" : "foi ocultado da"} tela dos jogadores.`);
  }
  async function actorSceneAction(action: "hide" | "show" | "remove") {
    if (!sceneSelection?.atorId) return;
    const response = await fetch("/api/master/session/actors", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, sceneId: scene.id, actorId: sceneSelection.atorId, action }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Não foi possível atualizar a entidade.");
    setNotice(`${sceneSelection.nome}: ${action === "remove" ? "retirado da cena" : action === "show" ? "revelado aos jogadores" : "ocultado dos jogadores"}.`);
    if (action === "remove") setSceneSelection(null);
  }

  async function changeAbilityState(abilityId: string, state: "unlocked" | "sealed") {
    if (!selected) return;
    const response = await fetch("/api/master/abilities/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterAbilityId: abilityId,
        state,
        reason: `${state === "unlocked" ? "Liberação" : "Selamento"} durante a sessão ${session.title}`,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar habilidade.");
    setDetails((items) =>
      items.map((item) =>
        item.characterId === selected.id
          ? {
              ...item,
              abilities: item.abilities.map((ability) =>
                ability.id === abilityId ? { ...ability, state } : ability,
              ),
            }
          : item,
      ),
    );
    setNotice(
      `${selected.name}: habilidade ${state === "unlocked" ? "liberada" : "selada"}. O jogador recebeu a atualização em tempo real.`,
    );
  }

  async function deliver(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const targetCharacterIds =
      deliveryTarget === "all" ? characters.map((item) => item.id) : [selected.id];
    const input =
      deliveryKind === "item"
        ? {
            kind: "item",
            campaignId,
            sessionId: session.id,
            targetCharacterIds,
            name: deliveryName,
            description: deliveryDetails,
            quantity: 1,
          }
        : {
            kind: "handout",
            campaignId,
            sessionId: session.id,
            targetCharacterIds,
            title: deliveryName,
            publicExcerpt: deliveryDetails,
            protectedText: deliveryDetails,
          };
    const response = await fetch("/api/master/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const result = (await response.json()) as {
      error?: string;
      demo?: boolean;
      notification?: { type: string; title: string; targetCharacterIds: string[] };
    };
    if (!response.ok) return setNotice(result.error ?? "Falha na entrega.");
    if (result.demo && result.notification) publishDemoRealtime(result.notification);
    setNotice(
      `${deliveryKind === "item" ? "Item" : "Pista"} entregue ${deliveryTarget === "all" ? "a todos" : `a ${selected.name}`}. Notificação enviada.`,
    );
    setDeliveryName("");
    setDeliveryDetails("");
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!messageReview) {
      setMessageReview(true);
      setNotice("Revise remetente, destinatários e conteúdo antes de confirmar.");
      return;
    }
    const recipientUserIds =
      messageTarget === "all"
        ? accounts
            .filter((account) => account.papel === "Jogador")
            .map((account) => account.usuarioId)
        : selectedAccount
          ? [selectedAccount.usuarioId]
          : [];
    if (recipientUserIds.length === 0)
      return setNotice("Vincule uma conta ao personagem antes de enviar mensagem.");
    const response = await fetch("/api/master/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        apparentSenderName: messageSender,
        recipientUserIds,
        body: messageBody,
        format: "text",
        visibility: "selected",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao enviar mensagem.");
    setNotice(
      `Mensagem enviada ${messageTarget === "all" ? "a todos os jogadores" : `a ${selected?.name}`}.`,
    );
    setMessageBody("");
    setMessageReview(false);
  }

  async function savePublicState(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/session/state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publicState),
    });
    const result = (await response.json()) as { error?: string };
    setNotice(
      response.ok
        ? "Cena pública atualizada para todos os jogadores."
        : (result.error ?? "Falha ao publicar cena."),
    );
  }

  async function toggleSceneSync() {
    const enabled = !sceneSyncEnabled;
    const response = await fetch("/api/master/session/scene-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId: session.id, sceneId: scene.id, enabled }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao sincronizar cena.");
    setSceneSyncEnabled(enabled);
    setNotice(
      enabled
        ? "Cena sincronizada. Mapa, entidades e movimentos estão ao vivo para os jogadores."
        : "Cena dessincronizada. Os jogadores veem o aviso enquanto você prepara o cenário.",
    );
  }

  function chooseDelivery(id: string) {
    setDeliveryCatalogId(id);
    if (id === "new") {
      setDeliveryName("");
      setDeliveryDetails("");
      return;
    }
    if (deliveryKind === "item") {
      const item = items.find((value) => value.id === id);
      if (item) {
        setDeliveryName(item.nome);
        setDeliveryDetails(item.descricao);
      }
    } else {
      const handout = handouts.find((value) => value.id === id);
      if (handout) {
        setDeliveryName(handout.titulo);
        setDeliveryDetails(handout.conteudo || handout.resumo);
      }
    }
  }

  return (
    <div
      id="controle-sessao"
      className="session-command-center"
      data-right-collapsed={rightPanelCollapsed}
    >
      <LiveSync campaignId={campaignId} fallbackIntervalMs={30_000} />
      <section className="panel session-command-header rounded-lg p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="eyebrow">central da sessão // mesa de operação</p>
            <div className="mt-1 flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-black">{session.title}</h1>
              <span className="tag">
                <Radio size={12} />{" "}
                {session.status === "active"
                  ? "EM ANDAMENTO"
                  : (session.status ?? "preparing").toUpperCase()}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <SessionClock
              initialElapsedSeconds={session.elapsedSeconds ?? 0}
              initialTimerStartedAt={session.timerStartedAt}
              initialStatus={session.status}
            />
            <SessionControls
              initialTurn={session.round}
              campaignId={campaignId}
              sessionId={session.id}
              initialStatus={session.status}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#2d3037] pt-3">
          <p className="min-w-0 text-sm">
            <span className="text-xs text-[#7d8087]">CENA PÚBLICA</span>{" "}
            <strong className="ml-2">{publicState.sceneTitle}</strong>{" "}
            <span className="text-[#92959c]">
              · Pressão {session.pressure}/7 · {characters.length} conectado(s)
            </span>
          </p>
          <div className="flex flex-wrap gap-2">
            <Link className="btn px-3 py-2" href={`/master/campaigns/${campaignId}/encounters`}>
              <Swords size={14} /> Encontros
            </Link>
            <Link className="btn px-3 py-2" href={`/master/campaigns/${campaignId}/actors`}>
              <Sparkles size={14} /> Entidades
            </Link>
            <Link className="btn px-3 py-2" href={`/master/campaigns/${campaignId}/items`}>
              <Package size={14} /> Itens
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-3" id="roteiro-sessao">
        <SessionScriptControl
          key={scripts.map((script) => `${script.id}:${script.versao}`).join("|")}
          campaignId={campaignId}
          sessionId={session.id}
          sessionStatus={session.status}
          scripts={scripts}
          initialRun={initialScriptRun}
        />
      </div>

      <div className="session-command-workspace mt-3" id="mapa-sessao">
        <div className="session-map-column">
          <MapStudio
            campaignId={campaignId}
            sessionId={session.id}
            initialScene={scene}
            hiddenCharacterIds={characters
              .filter((character) => !visible.has(character.id))
              .map((character) => character.id)}
            allowedCharacterIds={characters.map((character) => character.id)}
            selectedCharacterId={selected?.id}
            onSelectCharacter={(characterId) => {
              setSelectedId(characterId);
              setMessageReview(false);
            }}
            onSelectToken={setSceneSelection}
            items={items}
            recipientCharacters={characters.map((character) => ({
              id: character.id,
              name: character.name,
            }))}
            workspace
            sideContent={
              <>
                <div id="operacoes-sessao">
                <SessionOperations
                  key={JSON.stringify(
                    encounters.map((encounter) => [
                      encounter.id,
                      encounter.estado,
                      encounter.rodada,
                      encounter.turnoAtual,
                      encounter.combatentes.map((combatente) => [
                        combatente.id,
                        combatente.iniciativa,
                        combatente.posicao,
                        combatente.atual,
                      ]),
                    ]),
                  )}
                  compact
                  campaignId={campaignId}
                  sessionId={session.id}
                  scene={scene}
                  initialEncounters={encounters}
                  initialActors={actors}
                  initialRequests={initialAbilityRequests}
                  characters={characters}
                  onEncountersChange={setLiveEncounters}
                />
                </div>
                <LiveRollFeed rolls={initialRolls} />
                <SessionTimeline campaignId={campaignId} sessionId={session.id} initialEntries={initialTimeline} />
                <form
                  className="panel rounded-lg p-4"
                  id="transmissao-sessao"
                  onSubmit={savePublicState}
                >
                  <div className="flex items-center gap-2">
                    <Radio size={17} className="text-[#d84b57]" />
                    <div>
                      <p className="eyebrow">transmissão</p>
                      <h2 className="font-extrabold">O que os jogadores veem</h2>
                    </div>
                  </div>
                  <label className="mt-3 block text-xs font-bold">
                    Título da cena
                    <input
                      className="field mt-1"
                      value={publicState.sceneTitle}
                      onChange={(event) =>
                        setPublicState((state) => ({ ...state, sceneTitle: event.target.value }))
                      }
                    />
                  </label>
                  <label className="mt-3 block text-xs font-bold">
                    Resumo público
                    <textarea
                      className="field mt-1 min-h-20"
                      value={publicState.publicSummary}
                      onChange={(event) =>
                        setPublicState((state) => ({ ...state, publicSummary: event.target.value }))
                      }
                    />
                  </label>
                  <label className="mt-3 block text-xs font-bold">
                    Objetivo público
                    <input
                      className="field mt-1"
                      value={publicState.publicObjective}
                      onChange={(event) =>
                        setPublicState((state) => ({
                          ...state,
                          publicObjective: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <button className="btn btn-primary mt-3 w-full">Publicar na sala ao vivo</button>
                </form>
              </>
            }
          />
          <div className="session-map-sync">
            <button
              className={`btn ${sceneSyncEnabled ? "border-[#315b45] text-[#7bd5a5]" : "border-[#6d5527] text-[#e8c16d]"}`}
              type="button"
              onClick={() => void toggleSceneSync()}
            >
              {sceneSyncEnabled ? <EyeOff size={14} /> : <Eye size={14} />}
              {sceneSyncEnabled ? "Dessincronizar cena" : "Sincronizar cena para jogadores"}
            </button>
          </div>
          <SessionInitiativeStrip
            encounter={activeEncounter}
            characters={characters}
            onSelectCharacter={(characterId) => {
              setSelectedId(characterId);
              setMessageReview(false);
            }}
          />
        </div>

        <aside className="session-character-rail" aria-label="Comando dos personagens">
          <button
            className="session-rail-toggle session-right-toggle"
            type="button"
            onClick={() => setRightPanelCollapsed((value) => !value)}
            aria-label={
              rightPanelCollapsed
                ? "Abrir painel dos personagens"
                : "Recolher painel dos personagens"
            }
          >
            {rightPanelCollapsed ? <PanelRightOpen size={18} /> : <PanelRightClose size={18} />}
            {!rightPanelCollapsed && <span>Comando dos personagens</span>}
          </button>
          {!rightPanelCollapsed && (
            <div className="session-character-rail-content">
              <section className="panel rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={17} className="text-[#d84b57]" />
                    <h2 className="font-extrabold">Na sessão</h2>
                  </div>
                  <span className="tag">{characters.length}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {characters.map((character) => (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(character.id);
                        setMessageReview(false);
                      }}
                      key={character.id}
                      className={`central-card rounded-lg border p-2 text-left ${selected?.id === character.id ? "border-[#a83a45] bg-[#8a1b27]/15" : "border-[#30333a] bg-black/10"}`}
                    >
                      <div className="flex items-center gap-2">
                        <CharacterPortrait
                          name={character.name}
                          portraitUrl={character.portraitUrl}
                          className="size-9 rounded-lg"
                        />
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-xs">{character.name}</strong>
                          <span className="mt-0.5 block truncate text-[0.6rem] text-[#858891]">
                            PV {character.resources.pv.current}/{character.resources.pv.maximum}
                          </span>
                        </span>
                        {visible.has(character.id) ? (
                          <Eye size={12} className="text-[#7bd5a5]" />
                        ) : (
                          <EyeOff size={12} className="text-[#d98b93]" />
                        )}
                      </div>
                    </button>
                  ))}
                  {characters.length === 0 && (
                    <p className="col-span-2 rounded border border-dashed border-[#3b3e46] p-3 text-xs text-[#858890]">
                      Os personagens aparecerão ao entrar na sala.
                    </p>
                  )}
                </div>
              </section>

              {selected ? (
                <section className="panel rounded-lg p-4" id="acoes-rapidas" aria-live="polite">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="eyebrow">ações rápidas</p>
                      <h2 className="text-lg font-extrabold">{selected.name}</h2>
                    </div>
                    <button
                      className="btn px-3"
                      type="button"
                      onClick={() => void toggleVisibility()}
                    >
                      {visible.has(selected.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                      {visible.has(selected.id) ? "Ocultar" : "Mostrar"}
                    </button>
                  </div>
                  <div className="session-selected-summary">
                    <CharacterPortrait
                      name={selected.name}
                      portraitUrl={selected.portraitUrl}
                      className="size-12 rounded-full"
                    />
                    <span>
                      <strong>{selected.name}</strong>
                      <small>{selected.status}</small>
                    </span>
                    <div>
                      {Object.entries(selected.resources).map(([resourceKey, item]) => (
                        <p key={item.kind ?? resourceKey}>
                          <span>{(item.kind ?? resourceKey).toUpperCase()}</span>
                          <i><b style={{ width: `${item.maximum > 0 ? Math.max(0, Math.min(100, (item.current / item.maximum) * 100)) : 0}%` }} /></i>
                          <strong>{item.current}/{item.maximum}</strong>
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="mt-3 rounded-lg border border-[#313943] bg-[#080c11]/70 p-3">
                    <div className="flex items-center justify-between gap-2"><strong className="text-xs">Central contextual</strong><span className={`tag ${selectedCanAct && selectedHasTurn ? "text-[#7bd5a5]" : "text-[#f0a5ad]"}`}>{selectedCanAct && selectedHasTurn ? "Ações liberadas" : "Ações restritas"}</span></div>
                    <div className="mt-2 flex flex-wrap gap-2 text-[0.65rem]"><span className="tag">{currentCombatant ? selectedHasTurn ? "Turno atual" : `Turno de ${currentCombatant.nome}` : "Fora de combate"}</span><span className="tag">PE {selected.resources.pe.current}/{selected.resources.pe.maximum}</span>{nearestThreat && <span className="tag">Ameaça a {nearestThreat.distance.toFixed(1)} quadrados</span>}{selected.conditions.map((condition) => <span className="tag text-[#e8a36b]" key={condition}>{condition}</span>)}</div>
                    {!selectedCanAct && <p className="mt-2 text-xs text-[#f0a5ad]">Este personagem está sem ações por sua condição atual.</p>}
                  </div>
                  <div className="session-character-actions">
                    <button type="button" disabled={!selectedCanAct} onClick={() => { setResource("pv"); setAmount(5); focusControl("controle-recursos-personagem"); }}>
                      <Swords size={18} /><span>Aplicar dano</span>
                    </button>
                    <button type="button" disabled={!selectedCanAct || !selectedHasTurn} onClick={() => focusControl("operacoes-sessao")}><BookOpen size={18} /><span>Solicitar teste</span></button>
                    <button type="button" onClick={() => { setMessageReview(false); focusControl("mensagem-imediata"); }}>
                      <MessageSquare size={18} /><span>Enviar mensagem</span>
                    </button>
                    <button type="button" onClick={() => { setSheetTab("rules"); focusControl("ficha-central-personagem"); }}>
                      <WandSparkles size={18} /><span>Aplicar efeito</span>
                    </button>
                    <button type="button" onClick={() => { setDeliveryKind("handout"); focusControl("entrega-central"); }}>
                      <Eye size={18} /><span>Revelar pista</span>
                    </button>
                    <button type="button" disabled={!selectedHasEnergy} onClick={() => { setSheetTab("abilities"); focusControl("ficha-central-personagem"); }}>
                      <Sparkles size={18} /><span>Liberar habilidade</span>
                    </button>
                  </div>
                  {preparedCheck && (
                    <div className="session-prepared-check">
                      <span><BookOpen size={14} /> Teste preparado</span>
                      <strong>
                        {preparedCheck.skill ?? (preparedCheck.attribute ?? "teste").toUpperCase()} · DT {preparedCheck.difficulty}
                      </strong>
                      <button type="button" onClick={() => focusControl("operacoes-sessao")}>Abrir</button>
                    </div>
                  )}
                  <div className="mt-3 flex items-center gap-2" id="controle-recursos-personagem">
                    <HeartPulse size={16} className="text-[#df4855]" />
                    <strong className="text-sm">Dano, cura e recursos</strong>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_0.65fr] gap-2">
                    <select
                      className="field"
                      value={resource}
                      onChange={(event) => setResource(event.target.value as ResourceKind)}
                    >
                      <option value="pv">PV</option>
                      <option value="pe">PE</option>
                      <option value="san">SAN</option>
                    </select>
                    <input
                      className="field"
                      type="number"
                      min="1"
                      value={amount}
                      onChange={(event) => setAmount(Number(event.target.value))}
                    />
                  </div>
                  <input
                    className="field mt-2"
                    value={reason}
                    onChange={(event) => setReason(event.target.value)}
                    aria-label="Motivo da alteração"
                  />
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      className="btn border-[#6e252e] text-[#f0949d]"
                      type="button"
                      onClick={() => void mutateResource(-1)}
                    >
                      Aplicar dano/perda
                    </button>
                    <button
                      className="btn border-[#2f6147] text-[#7bd5a5]"
                      type="button"
                      onClick={() => void mutateResource(1)}
                    >
                      Curar/recuperar
                    </button>
                  </div>
                  <div className="mt-3 rounded-lg border border-[#30333a] bg-black/15 p-3">
                    <div className="flex items-center gap-2">
                      <Backpack size={15} className="text-[#e7bd69]" />
                      <strong className="text-xs">Itens em uso</strong>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedActiveItems.map((item) => (
                        <span className="tag border-[#5b4b2c] text-[#e6c780]" key={item.id}>
                          {item.name}
                        </span>
                      ))}
                      {selectedActiveItems.length === 0 && (
                        <span className="text-xs text-[#777a82]">
                          Nenhum item equipado ou em uso.
                        </span>
                      )}
                    </div>
                  </div>
                  <CharacterLiveControls
                    campaignId={campaignId}
                    character={selected}
                    onChange={(updated) =>
                      setCharacters((items) =>
                        items.map((item) => (item.id === updated.id ? updated : item)),
                      )
                    }
                  />
                </section>
              ) : (
                <section className="panel rounded-lg border-dashed p-4 text-sm text-[#858890]">
                  As ações aparecerão quando um jogador entrar.
                </section>
              )}

              {sceneSelection && !sceneSelection.characterId && (
                <section className="panel rounded-lg p-4">
                  <p className="eyebrow">seleção do mapa</p><h2 className="mt-1 font-extrabold">{sceneSelection.nome}</h2>
                  {sceneSelection.itemId ? <><p className="mt-2 text-xs text-[#858890]">Item selecionado. A entrega ou remoção fica disponível nas ferramentas do mapa.</p><button className="btn mt-3 w-full" type="button" onClick={() => focusControl("mapa-sessao")}><Package size={14} /> Abrir ações do item</button></> : <><p className="mt-2 text-xs text-[#858890]">Entidade ou NPC selecionado. A alteração é sincronizada sem recarregar a página.</p><div className="mt-3 grid grid-cols-2 gap-2"><button className="btn" type="button" onClick={() => void actorSceneAction("hide")}><EyeOff size={14} /> Ocultar</button><button className="btn" type="button" onClick={() => void actorSceneAction("show")}><Eye size={14} /> Revelar</button><button className="btn col-span-2 text-[#f0a5ad]" type="button" onClick={() => void actorSceneAction("remove")}><Trash2 size={14} /> Retirar da cena</button></div></>}
                </section>
              )}

              {selected && selectedDetails && (
                <details className="panel session-sheet rounded-lg" open id="ficha-central-personagem">
                  <summary className="session-side-summary">
                    Ficha completa de {selected.name}
                  </summary>
                  <section className="p-4 pt-0">
                    <div className="flex items-center gap-3">
                      <CharacterPortrait
                        name={selected.name}
                        portraitUrl={selected.portraitUrl}
                        className="size-14 rounded-xl"
                      />
                      <div>
                        <p className="eyebrow">ficha na central</p>
                        <h2 className="font-extrabold">{selected.name}</h2>
                        <p className="text-xs text-[#858890]">
                          {selected.origin} · {selected.className} · {selected.path}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      {(
                        [
                          ["summary", "Resumo", UserRound],
                          ["inventory", "Inventário", Backpack],
                          ["abilities", "Habilidades", Sparkles],
                          ["rules", "Perícias e ações", BookOpen],
                        ] as const
                      ).map(([value, label, Icon]) => (
                        <button
                          className={`btn px-2 ${sheetTab === value ? "border-[#a83a45] bg-[#8a1b27]/20" : ""}`}
                          type="button"
                          key={value}
                          onClick={() => setSheetTab(value)}
                        >
                          <Icon size={14} /> {label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3">
                      <CharacterPdfActions characterId={selected.id} compact />
                    </div>
                    {sheetTab === "summary" && (
                      <div className="mt-4 space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          {Object.values(selected.resources).map((item) => (
                            <div
                              className="rounded border border-[#30333a] p-2 text-center"
                              key={item.kind}
                            >
                              <span className="text-[0.6rem] uppercase text-[#777a82]">
                                {item.kind}
                              </span>
                              <strong className="block">
                                {item.current}/{item.maximum}
                              </strong>
                            </div>
                          ))}
                        </div>
                        <div className="grid grid-cols-5 gap-1">
                          {Object.entries(selected.attributes).map(([key, value]) => (
                            <div
                              className="rounded border border-[#30333a] p-2 text-center"
                              key={key}
                            >
                              <span className="text-[0.55rem] uppercase text-[#777a82]">{key}</span>
                              <strong className="block text-sm">{value}</strong>
                            </div>
                          ))}
                        </div>
                        <p className="rounded border border-[#30333a] p-3 text-xs text-[#a3a5ab]">
                          DEF {selected.defense} · NEX {selected.nex}% · {selected.status}
                        </p>
                      </div>
                    )}
                    {sheetTab === "inventory" && (
                      <div className="mt-4 space-y-2">
                        {selectedDetails.inventory.map((item) => (
                          <div className="rounded border border-[#30333a] p-3" key={item.id}>
                            <strong className="text-sm">{item.name}</strong>
                            <p className="mt-1 text-xs text-[#858890]">
                              {item.detail} · {item.state}
                            </p>
                          </div>
                        ))}
                        {selectedDetails.inventory.length === 0 && (
                          <p className="text-xs text-[#777a82]">Inventário vazio.</p>
                        )}
                      </div>
                    )}
                    {sheetTab === "abilities" && (
                      <div className="mt-4 space-y-2">
                        {selectedDetails.abilities.map((ability) => (
                          <article className="rounded border border-[#30333a] p-3" key={ability.id}>
                            <div className="flex justify-between gap-2">
                              <strong className="text-sm">{ability.name}</strong>
                              <span className="tag">{ability.state}</span>
                            </div>
                            <p className="mt-2 text-xs leading-5 text-[#9a9da3]">
                              {ability.description}
                            </p>
                            <AbilityDetails ability={ability} />
                            <button
                              className={`btn mt-2 w-full px-2 ${ability.state === "unlocked" ? "" : "btn-primary"}`}
                              type="button"
                              onClick={() =>
                                void changeAbilityState(
                                  ability.id,
                                  ability.state === "unlocked" ? "sealed" : "unlocked",
                                )
                              }
                            >
                              {ability.state === "unlocked" ? (
                                <ShieldAlert size={14} />
                              ) : (
                                <Sparkles size={14} />
                              )}
                              {ability.state === "unlocked" ? "Selar habilidade" : "Liberar agora"}
                            </button>
                          </article>
                        ))}
                        {selectedDetails.abilities.length === 0 && (
                          <p className="text-xs text-[#777a82]">Nenhuma habilidade cadastrada.</p>
                        )}
                      </div>
                    )}
                    {sheetTab === "rules" && (
                      <div className="mt-4 space-y-4">
                        <div>
                          <p className="eyebrow">perícias</p>
                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            {selectedDetails.skills.map((skill) => (
                              <div
                                className="rounded border border-[#30333a] p-2 text-xs"
                                key={skill.id}
                              >
                                <strong>
                                  {skill.name} +{skill.bonus}
                                </strong>
                                <p className="mt-1 text-[#777a82]">
                                  {skill.attribute} · {skill.training}
                                </p>
                                {skill.notes && (
                                  <p className="mt-2 text-[#a3a5ab]">{skill.notes}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="eyebrow">ações</p>
                          <div className="mt-2 space-y-2">
                            {selectedDetails.actions.map((action) => (
                              <div
                                className="rounded border border-[#30333a] p-2 text-xs"
                                key={action.id}
                              >
                                <strong>{action.name}</strong>
                                <p className="mt-1 text-[#777a82]">
                                  {action.test} · {action.damage} · {action.range}
                                </p>
                                {action.description && (
                                  <p className="mt-2 text-[#a3a5ab]">{action.description}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="eyebrow">fraquezas</p>
                          <div className="mt-2 space-y-2">
                            {selectedDetails.weaknesses.map((weakness) => (
                              <div
                                className="rounded border border-[#5b3036] p-2 text-xs"
                                key={weakness.id}
                              >
                                <strong>{weakness.name}</strong>
                                <p className="mt-1 text-[#a08689]">{weakness.effect}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </section>
                </details>
              )}
              <details className="panel rounded-lg" id="entrega-central">
                <summary className="session-side-summary">Entregar item ou pista</summary>
                <form className="p-4 pt-0" onSubmit={deliver}>
                  <div className="flex items-center gap-2">
                    {deliveryKind === "item" ? <Package size={17} /> : <ScrollText size={17} />}
                    <h2 className="font-extrabold">Entregar item ou pista</h2>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <select
                      className="field"
                      value={deliveryKind}
                      onChange={(event) => {
                        setDeliveryKind(event.target.value as "item" | "handout");
                        setDeliveryCatalogId("new");
                        setDeliveryName("");
                        setDeliveryDetails("");
                      }}
                    >
                      <option value="item">Item</option>
                      <option value="handout">Pista</option>
                    </select>
                    <select
                      className="field"
                      value={deliveryTarget}
                      onChange={(event) =>
                        setDeliveryTarget(event.target.value as "selected" | "all")
                      }
                    >
                      <option value="selected">Somente {selected?.name}</option>
                      <option value="all">Todos os jogadores</option>
                    </select>
                  </div>
                  <select
                    className="field mt-2"
                    value={deliveryCatalogId}
                    onChange={(event) => chooseDelivery(event.target.value)}
                  >
                    <option value="new">Criar novo conteúdo</option>
                    {(deliveryKind === "item"
                      ? items.map((item) => ({ id: item.id, label: item.nome }))
                      : handouts.map((item) => ({ id: item.id, label: item.titulo }))
                    ).map((item) => (
                      <option value={item.id} key={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                  <input
                    required
                    className="field mt-2"
                    placeholder={deliveryKind === "item" ? "Nome do item" : "Título da pista"}
                    value={deliveryName}
                    onChange={(event) => setDeliveryName(event.target.value)}
                  />
                  <textarea
                    className="field mt-2 min-h-20"
                    placeholder="Descrição ou conteúdo"
                    value={deliveryDetails}
                    onChange={(event) => setDeliveryDetails(event.target.value)}
                  />
                  <button className="btn btn-primary mt-2">
                    <Send size={14} /> Entregar e notificar
                  </button>
                </form>
              </details>
              <details className="panel rounded-lg" id="mensagem-imediata">
                <summary className="session-side-summary">Mensagem imediata</summary>
                <form className="p-4 pt-0" onSubmit={sendMessage}>
                  <div className="flex items-center gap-2">
                    <MessageSquare size={17} />
                    <h2 className="font-extrabold">Mensagem imediata</h2>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <select
                      className="field"
                      value={messageSender}
                      onChange={(event) => {
                        setMessageSender(event.target.value);
                        setMessageReview(false);
                      }}
                    >
                      {senders
                        .filter((sender) => sender.ativo)
                        .map((sender) => (
                          <option key={sender.id}>{sender.nome}</option>
                        ))}
                    </select>
                    <select
                      className="field"
                      value={messageTarget}
                      onChange={(event) => {
                        setMessageTarget(event.target.value as "selected" | "all");
                        setMessageReview(false);
                      }}
                    >
                      <option value="selected">Somente {selected?.name}</option>
                      <option value="all">Todos</option>
                    </select>
                  </div>
                  <textarea
                    required
                    className="field mt-2 min-h-24"
                    value={messageBody}
                    onChange={(event) => {
                      setMessageBody(event.target.value);
                      setMessageReview(false);
                    }}
                    placeholder="Mensagem privada; o remetente real continua protegido."
                  />
                  {messageReview && (
                    <div className="mt-3 rounded border border-[#754049] bg-[#7d1a25]/10 p-3">
                      <p className="eyebrow">prévia obrigatória</p>
                      <p className="mt-2 text-xs">
                        De <strong>{messageSender}</strong> para{" "}
                        <strong>
                          {messageTarget === "all"
                            ? "todos os jogadores vinculados"
                            : selected?.name}
                        </strong>
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-[#c2c4c9]">
                        {messageBody}
                      </p>
                      <button
                        className="btn mt-3"
                        type="button"
                        onClick={() => setMessageReview(false)}
                      >
                        Continuar editando
                      </button>
                    </div>
                  )}
                  <button className="btn btn-primary mt-2">
                    <Send size={14} /> {messageReview ? "Confirmar envio" : "Revisar mensagem"}
                  </button>
                </form>
              </details>
              {notice && (
                <p
                  className="rounded border border-[#315b45] bg-[#153323]/30 p-3 text-xs text-[#7bd5a5]"
                  role="status"
                >
                  {notice}
                </p>
              )}
              <section className="panel session-recent-events rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <Radio size={15} className="text-[#a978da]" />
                  <h2 className="text-xs font-extrabold">Últimos eventos</h2>
                </div>
                <div className="mt-3 space-y-2">
                  {initialRolls.slice(0, 3).map((roll) => (
                    <article key={roll.id}>
                      <span>{new Date(roll.createdAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                      <p><strong>{roll.playerName}</strong> rolou {roll.purpose}: <b>{roll.total}</b></p>
                    </article>
                  ))}
                  {initialRolls.length === 0 && !notice && (
                    <p className="text-xs text-[#747f8c]">Os eventos da sessão aparecerão aqui.</p>
                  )}
                  {notice && <article><span>agora</span><p>{notice}</p></article>}
                </div>
              </section>
            </div>
          )}
        </aside>
      </div>
      <div className="mt-3">
        <SessionSummaryManager campaignId={campaignId} sessionId={session.id} sessionTitle={session.title} initialSummary={initialSessionSummary} />
      </div>
    </div>
  );
}
