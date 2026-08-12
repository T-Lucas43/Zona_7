"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Backpack, BookOpen, Eye, EyeOff, HeartPulse, MessageSquare, Package, Radio, ScrollText, Send, ShieldAlert, Sparkles, Swords, UserRound, Users } from "lucide-react";
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
import { publishDemoRealtime } from "@/lib/demo-realtime";
import type { CharacterSummary, ResourceKind, SessionSummary } from "@/types/domain";
import type { AtorDaCampanha, CenaDaCampanha, ContaDaCampanha, EncontroDaCampanha, ItemDaCampanha, PistaDaCampanha, Remetente, RoteiroDaCampanha } from "@/server/repositories/master-repository";
import type { SessionPublicState } from "@/server/repositories/session-repository";
import type { SessionScriptRun } from "@/server/repositories/script-repository";
import type { AbilityUseRequest, SessionCharacterDetails } from "@/server/repositories/character-repository";

const resourceLabels: Record<ResourceKind, string> = { pv: "PV", pe: "PE", san: "SAN" };

export function SessionHub({
  campaignId, session, initialPublicState, initialCharacters, characterDetails, scene, accounts, senders, scripts, initialScriptRun, encounters, actors, items, handouts, initialAbilityRequests, initialSceneSyncEnabled, visibleCharacterIds,
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
  initialSceneSyncEnabled: boolean;
  visibleCharacterIds: string[];
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
  const [sheetTab, setSheetTab] = useState<"summary" | "inventory" | "abilities" | "rules">("summary");
  const [sceneSyncEnabled, setSceneSyncEnabled] = useState(initialSceneSyncEnabled);
  const selected = useMemo(() => characters.find((item) => item.id === selectedId) ?? characters[0], [characters, selectedId]);
  const selectedDetails = details.find((item) => item.characterId === selected?.id);
  const selectedAccount = accounts.find((account) => account.personagemId === selected?.id);
  const featuredEncounter = encounters.find((encounter) => ["active", "paused"].includes(encounter.estado)) ?? encounters[0];
  const sceneActors = actors.filter((actor) => actor.naCena);

  async function mutateResource(direction: -1 | 1) {
    if (!selected) return;
    const response = await fetch("/api/resources/mutate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: selected.id, resource, delta: direction * Math.abs(amount), operation: direction < 0 ? resource === "pv" ? "damage" : "loss" : resource === "pv" ? "healing" : "recovery", source: "Central da sessão", reason, visibility: "owner_only", sessionId: session.id.match(/^[0-9a-f-]{36}$/i) ? session.id : undefined, idempotencyKey: crypto.randomUUID() }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar recurso.");
    const before = selected.resources[resource];
    const current = Math.max(0, Math.min(before.maximum, before.current + direction * Math.abs(amount)));
    setCharacters((items) => items.map((item) => item.id === selected.id ? { ...item, resources: { ...item.resources, [resource]: { ...before, current } } } : item));
    setNotice(`${selected.name}: ${resourceLabels[resource]} alterado para ${current}. O jogador será atualizado em tempo real.`);
  }

  async function toggleVisibility() {
    if (!selected) return;
    const next = !visible.has(selected.id);
    const response = await fetch("/api/master/session/visibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, characterId: selected.id, visible: next }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar visibilidade.");
    setVisible((current) => { const copy = new Set(current); if (next) copy.add(selected.id); else copy.delete(selected.id); return copy; });
    setNotice(`${selected.name} ${next ? "voltou à" : "foi ocultado da"} tela dos jogadores.`);
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
    setDetails((items) => items.map((item) => item.characterId === selected.id
      ? { ...item, abilities: item.abilities.map((ability) => ability.id === abilityId ? { ...ability, state } : ability) }
      : item));
    setNotice(`${selected.name}: habilidade ${state === "unlocked" ? "liberada" : "selada"}. O jogador recebeu a atualização em tempo real.`);
  }

  async function deliver(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const targetCharacterIds = deliveryTarget === "all" ? characters.map((item) => item.id) : [selected.id];
    const input = deliveryKind === "item"
      ? { kind: "item", campaignId, targetCharacterIds, name: deliveryName, description: deliveryDetails, quantity: 1 }
      : { kind: "handout", campaignId, targetCharacterIds, title: deliveryName, publicExcerpt: deliveryDetails, protectedText: deliveryDetails };
    const response = await fetch("/api/master/deliveries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = (await response.json()) as { error?: string; demo?: boolean; notification?: { type: string; title: string; targetCharacterIds: string[] } };
    if (!response.ok) return setNotice(result.error ?? "Falha na entrega.");
    if (result.demo && result.notification) publishDemoRealtime(result.notification);
    setNotice(`${deliveryKind === "item" ? "Item" : "Pista"} entregue ${deliveryTarget === "all" ? "a todos" : `a ${selected.name}`}. Notificação enviada.`);
    setDeliveryName(""); setDeliveryDetails("");
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    if (!messageReview) {
      setMessageReview(true);
      setNotice("Revise remetente, destinatários e conteúdo antes de confirmar.");
      return;
    }
    const recipientUserIds = messageTarget === "all" ? accounts.filter((account) => account.papel === "Jogador").map((account) => account.usuarioId) : selectedAccount ? [selectedAccount.usuarioId] : [];
    if (recipientUserIds.length === 0) return setNotice("Vincule uma conta ao personagem antes de enviar mensagem.");
    const response = await fetch("/api/master/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, apparentSenderName: messageSender, recipientUserIds, body: messageBody, format: "text", visibility: "selected" }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao enviar mensagem.");
    setNotice(`Mensagem enviada ${messageTarget === "all" ? "a todos os jogadores" : `a ${selected?.name}`}.`); setMessageBody(""); setMessageReview(false);
  }

  async function savePublicState(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/session/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publicState) });
    const result = (await response.json()) as { error?: string };
    setNotice(response.ok ? "Cena pública atualizada para todos os jogadores." : result.error ?? "Falha ao publicar cena.");
  }

  async function toggleSceneSync() {
    const enabled = !sceneSyncEnabled;
    const response = await fetch("/api/master/session/scene-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, sessionId: session.id, sceneId: scene.id, enabled }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao sincronizar cena.");
    setSceneSyncEnabled(enabled); setNotice(enabled ? "Cena sincronizada. Mapa, entidades e movimentos estão ao vivo para os jogadores." : "Cena dessincronizada. Os jogadores veem o aviso enquanto você prepara o cenário.");
  }

  function chooseDelivery(id: string) {
    setDeliveryCatalogId(id);
    if (id === "new") { setDeliveryName(""); setDeliveryDetails(""); return; }
    if (deliveryKind === "item") {
      const item = items.find((value) => value.id === id);
      if (item) { setDeliveryName(item.nome); setDeliveryDetails(item.descricao); }
    } else {
      const handout = handouts.find((value) => value.id === id);
      if (handout) { setDeliveryName(handout.titulo); setDeliveryDetails(handout.conteudo || handout.resumo); }
    }
  }

  return (
    <div id="controle-sessao">
      <LiveSync campaignId={campaignId} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">central da sessão // tela coletiva integrada</p><h1 className="mt-1 text-3xl font-black">{session.title}</h1></div>
        <div className="flex flex-wrap gap-2">
          <Link className="btn" href={`/master/campaigns/${campaignId}/encounters`}><Swords size={15} /> Encontros</Link>
          <Link className="btn" href={`/master/campaigns/${campaignId}/actors`}><Sparkles size={15} /> Entidades e NPCs</Link>
          <Link className="btn" href={`/master/campaigns/${campaignId}/items`}><Package size={15} /> Itens da sessão</Link>
          <span className="tag"><Radio size={12} /> {session.status === "active" ? "EM ANDAMENTO" : session.status.toUpperCase()}</span>
        </div>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#32353c] bg-[#111318] p-4">
        <div><p className="text-xs text-[#7d8087]">CENA PÚBLICA ATUAL</p><strong>{publicState.sceneTitle} · Pressão {session.pressure}/7</strong></div>
        <div className="flex flex-wrap items-center gap-3">
          <SessionClock
            initialElapsedSeconds={session.elapsedSeconds ?? 0}
            initialTimerStartedAt={session.timerStartedAt}
            initialStatus={session.status}
          />
          <SessionControls initialTurn={session.round} campaignId={campaignId} sessionId={session.id} initialStatus={session.status} />
        </div>
      </div>
      <section className="mt-4 grid gap-4 md:grid-cols-2" aria-label="Operações da sessão">
        <Link className="panel central-card group rounded-lg p-5" href={`/master/campaigns/${campaignId}/encounters`}>
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-lg bg-[#8a1b27]/25 text-[#ff7784]"><Swords size={20} /></span>
            <span className="tag">{encounters.length} cadastrado(s)</span>
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div><p className="eyebrow">controle de combate</p><h2 className="mt-1 text-xl font-extrabold">Encontros</h2><p className="mt-2 text-sm text-[#92959c]">{featuredEncounter ? `${featuredEncounter.nome} · rodada ${featuredEncounter.rodada} · ${featuredEncounter.participantes} participantes` : "Crie o primeiro encontro da sessão."}</p></div>
            <ArrowRight className="shrink-0 text-[#d84b57] transition-transform group-hover:translate-x-1" size={19} />
          </div>
        </Link>
        <Link className="panel central-card group rounded-lg p-5" href={`/master/campaigns/${campaignId}/actors`}>
          <div className="flex items-start justify-between gap-4">
            <span className="grid size-11 place-items-center rounded-lg bg-[#5f3a8b]/25 text-[#b993ef]"><Sparkles size={20} /></span>
            <span className="tag">{sceneActors.length} em cena</span>
          </div>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div className="min-w-0"><p className="eyebrow">elenco do mestre</p><h2 className="mt-1 text-xl font-extrabold">Entidades e NPCs</h2><div className="mt-3 flex items-center -space-x-2">{actors.slice(0, 5).map((actor) => <CharacterPortrait name={actor.nome} portraitUrl={actor.portraitUrl} className="size-9 rounded-full border-2 border-[#111318]" key={actor.id} />)}{actors.length === 0 && <p className="text-sm text-[#92959c]">Nenhuma entidade cadastrada.</p>}</div></div>
            <ArrowRight className="shrink-0 text-[#a67ae0] transition-transform group-hover:translate-x-1" size={19} />
          </div>
        </Link>
      </section>
      <SessionOperations campaignId={campaignId} sessionId={session.id} scene={scene} initialEncounters={encounters} initialActors={actors} initialRequests={initialAbilityRequests} />
      <div className="mt-4 grid gap-4 2xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <SessionScriptControl campaignId={campaignId} sessionId={session.id} sessionStatus={session.status} scripts={scripts} initialRun={initialScriptRun} />
          <div className="flex justify-end"><button className={`btn ${sceneSyncEnabled ? "border-[#315b45] text-[#7bd5a5]" : "border-[#6d5527] text-[#e8c16d]"}`} type="button" onClick={() => void toggleSceneSync()}>{sceneSyncEnabled ? <EyeOff size={14} /> : <Eye size={14} />}{sceneSyncEnabled ? "Dessincronizar cena" : "Sincronizar cena para jogadores"}</button></div>
          <MapStudio
            campaignId={campaignId}
            initialScene={scene}
            hiddenCharacterIds={characters.filter((character) => !visible.has(character.id)).map((character) => character.id)}
            allowedCharacterIds={characters.map((character) => character.id)}
            selectedCharacterId={selected?.id}
            onSelectCharacter={(characterId) => { setSelectedId(characterId); setMessageReview(false); }}
          />
          <section className="panel rounded-lg p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Users size={17} className="text-[#d84b57]" /><h2 className="font-extrabold">Personagens da sessão</h2></div><span className="tag">clique para controlar</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {characters.map((character) => (
                <button type="button" onClick={() => { setSelectedId(character.id); setMessageReview(false); }} key={character.id} className={`central-card rounded-lg border p-4 text-left transition ${selected?.id === character.id ? "border-[#a83a45] bg-[#8a1b27]/15" : "border-[#30333a] bg-black/10"}`}>
                  <div className="flex items-center gap-3"><CharacterPortrait name={character.name} portraitUrl={character.portraitUrl} className="size-12 rounded-lg" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="truncate">{character.name}</strong>{visible.has(character.id) ? <Eye size={15} className="shrink-0 text-[#7bd5a5]" /> : <EyeOff size={15} className="shrink-0 text-[#d98b93]" />}</div><p className="mt-1 truncate text-xs text-[#858891]">{character.codename ?? character.role} · NEX {character.nex}%</p></div></div>
                  <div className="mt-3 flex flex-wrap gap-2">{Object.values(character.resources).map((item) => <span className="tag" key={item.kind}>{item.kind.toUpperCase()} {item.current}/{item.maximum}</span>)}</div>
                </button>
              ))}
              {characters.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#3b3e46] p-5 text-sm text-[#858890] sm:col-span-2 xl:col-span-3">
                  Nenhum personagem entrou nesta sessão. Assim que um jogador vinculado abrir a sala, sua ficha aparecerá aqui em tempo real.
                </div>
              )}
            </div>
          </section>
          <form className="panel rounded-lg p-5" onSubmit={savePublicState}>
            <div className="flex items-center gap-2"><Radio size={17} className="text-[#d84b57]" /><div><p className="eyebrow">somente conteúdo seguro</p><h2 className="font-extrabold">O que os jogadores veem</h2></div></div>
            <label className="mt-4 block text-xs font-bold">Título da cena<input className="field mt-1" value={publicState.sceneTitle} onChange={(event) => setPublicState((state) => ({ ...state, sceneTitle: event.target.value }))} /></label>
            <label className="mt-3 block text-xs font-bold">Resumo público<textarea className="field mt-1 min-h-24" value={publicState.publicSummary} onChange={(event) => setPublicState((state) => ({ ...state, publicSummary: event.target.value }))} /></label>
            <label className="mt-3 block text-xs font-bold">Objetivo público<input className="field mt-1" value={publicState.publicObjective} onChange={(event) => setPublicState((state) => ({ ...state, publicObjective: event.target.value }))} /></label>
            <button className="btn btn-primary mt-3">Publicar na sala ao vivo</button>
          </form>
        </div>
        <aside className="space-y-4">
          {selected && <section className="panel rounded-lg p-5" id="acoes-rapidas" aria-live="polite">
            <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">ações rápidas</p><h2 className="text-xl font-extrabold">{selected.name}</h2></div><button className="btn px-3" type="button" onClick={() => void toggleVisibility()}>{visible.has(selected.id) ? <EyeOff size={14} /> : <Eye size={14} />}{visible.has(selected.id) ? "Ocultar" : "Mostrar"}</button></div>
            <div className="mt-4 flex items-center gap-2"><HeartPulse size={16} className="text-[#df4855]" /><strong className="text-sm">Dano, cura e recursos</strong></div>
            <div className="mt-3 grid grid-cols-[1fr_0.65fr] gap-2"><select className="field" value={resource} onChange={(event) => setResource(event.target.value as ResourceKind)}><option value="pv">PV</option><option value="pe">PE</option><option value="san">SAN</option></select><input className="field" type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></div>
            <input className="field mt-2" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Motivo da alteração" />
            <div className="mt-2 grid grid-cols-2 gap-2"><button className="btn border-[#6e252e] text-[#f0949d]" type="button" onClick={() => void mutateResource(-1)}>Aplicar dano/perda</button><button className="btn border-[#2f6147] text-[#7bd5a5]" type="button" onClick={() => void mutateResource(1)}>Curar/recuperar</button></div>
            <CharacterLiveControls campaignId={campaignId} character={selected} onChange={(updated) => setCharacters((items) => items.map((item) => item.id === updated.id ? updated : item))} />
          </section>}
          {selected && selectedDetails && (
            <section className="panel session-sheet rounded-lg p-5">
              <div className="flex items-center gap-3">
                <CharacterPortrait name={selected.name} portraitUrl={selected.portraitUrl} className="size-14 rounded-xl" />
                <div><p className="eyebrow">ficha na central</p><h2 className="font-extrabold">{selected.name}</h2><p className="text-xs text-[#858890]">{selected.origin} · {selected.className} · {selected.path}</p></div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {([
                  ["summary", "Resumo", UserRound],
                  ["inventory", "Inventário", Backpack],
                  ["abilities", "Habilidades", Sparkles],
                  ["rules", "Perícias e ações", BookOpen],
                ] as const).map(([value, label, Icon]) => (
                  <button className={`btn px-2 ${sheetTab === value ? "border-[#a83a45] bg-[#8a1b27]/20" : ""}`} type="button" key={value} onClick={() => setSheetTab(value)}><Icon size={14} /> {label}</button>
                ))}
              </div>
              <div className="mt-3"><CharacterPdfActions characterId={selected.id} compact /></div>
              {sheetTab === "summary" && <div className="mt-4 space-y-3">
                <div className="grid grid-cols-3 gap-2">{Object.values(selected.resources).map((item) => <div className="rounded border border-[#30333a] p-2 text-center" key={item.kind}><span className="text-[0.6rem] uppercase text-[#777a82]">{item.kind}</span><strong className="block">{item.current}/{item.maximum}</strong></div>)}</div>
                <div className="grid grid-cols-5 gap-1">{Object.entries(selected.attributes).map(([key, value]) => <div className="rounded border border-[#30333a] p-2 text-center" key={key}><span className="text-[0.55rem] uppercase text-[#777a82]">{key}</span><strong className="block text-sm">{value}</strong></div>)}</div>
                <p className="rounded border border-[#30333a] p-3 text-xs text-[#a3a5ab]">DEF {selected.defense} · NEX {selected.nex}% · {selected.status}</p>
              </div>}
              {sheetTab === "inventory" && <div className="mt-4 space-y-2">
                {selectedDetails.inventory.map((item) => <div className="rounded border border-[#30333a] p-3" key={item.id}><strong className="text-sm">{item.name}</strong><p className="mt-1 text-xs text-[#858890]">{item.detail} · {item.state}</p></div>)}
                {selectedDetails.inventory.length === 0 && <p className="text-xs text-[#777a82]">Inventário vazio.</p>}
              </div>}
              {sheetTab === "abilities" && <div className="mt-4 space-y-2">
                {selectedDetails.abilities.map((ability) => <article className="rounded border border-[#30333a] p-3" key={ability.id}>
                  <div className="flex justify-between gap-2"><strong className="text-sm">{ability.name}</strong><span className="tag">{ability.state}</span></div>
                  <p className="mt-2 text-xs leading-5 text-[#9a9da3]">{ability.description}</p>
                  <AbilityDetails ability={ability} />
                  <button className={`btn mt-2 w-full px-2 ${ability.state === "unlocked" ? "" : "btn-primary"}`} type="button" onClick={() => void changeAbilityState(ability.id, ability.state === "unlocked" ? "sealed" : "unlocked")}>
                    {ability.state === "unlocked" ? <ShieldAlert size={14} /> : <Sparkles size={14} />}
                    {ability.state === "unlocked" ? "Selar habilidade" : "Liberar agora"}
                  </button>
                </article>)}
                {selectedDetails.abilities.length === 0 && <p className="text-xs text-[#777a82]">Nenhuma habilidade cadastrada.</p>}
              </div>}
              {sheetTab === "rules" && <div className="mt-4 space-y-4">
                <div><p className="eyebrow">perícias</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{selectedDetails.skills.map((skill) => <div className="rounded border border-[#30333a] p-2 text-xs" key={skill.id}><strong>{skill.name} +{skill.bonus}</strong><p className="mt-1 text-[#777a82]">{skill.attribute} · {skill.training}</p>{skill.notes && <p className="mt-2 text-[#a3a5ab]">{skill.notes}</p>}</div>)}</div></div>
                <div><p className="eyebrow">ações</p><div className="mt-2 space-y-2">{selectedDetails.actions.map((action) => <div className="rounded border border-[#30333a] p-2 text-xs" key={action.id}><strong>{action.name}</strong><p className="mt-1 text-[#777a82]">{action.test} · {action.damage} · {action.range}</p>{action.description && <p className="mt-2 text-[#a3a5ab]">{action.description}</p>}</div>)}</div></div>
                <div><p className="eyebrow">fraquezas</p><div className="mt-2 space-y-2">{selectedDetails.weaknesses.map((weakness) => <div className="rounded border border-[#5b3036] p-2 text-xs" key={weakness.id}><strong>{weakness.name}</strong><p className="mt-1 text-[#a08689]">{weakness.effect}</p></div>)}</div></div>
              </div>}
            </section>
          )}
          <form className="panel rounded-lg p-5" onSubmit={deliver}>
            <div className="flex items-center gap-2">{deliveryKind === "item" ? <Package size={17} /> : <ScrollText size={17} />}<h2 className="font-extrabold">Entregar item ou pista</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><select className="field" value={deliveryKind} onChange={(event) => { setDeliveryKind(event.target.value as "item" | "handout"); setDeliveryCatalogId("new"); setDeliveryName(""); setDeliveryDetails(""); }}><option value="item">Item</option><option value="handout">Pista</option></select><select className="field" value={deliveryTarget} onChange={(event) => setDeliveryTarget(event.target.value as "selected" | "all")}><option value="selected">Somente {selected?.name}</option><option value="all">Todos os jogadores</option></select></div>
            <select className="field mt-2" value={deliveryCatalogId} onChange={(event) => chooseDelivery(event.target.value)}><option value="new">Criar novo conteúdo</option>{(deliveryKind === "item" ? items.map((item) => ({ id: item.id, label: item.nome })) : handouts.map((item) => ({ id: item.id, label: item.titulo }))).map((item) => <option value={item.id} key={item.id}>{item.label}</option>)}</select>
            <input required className="field mt-2" placeholder={deliveryKind === "item" ? "Nome do item" : "Título da pista"} value={deliveryName} onChange={(event) => setDeliveryName(event.target.value)} />
            <textarea className="field mt-2 min-h-20" placeholder="Descrição ou conteúdo" value={deliveryDetails} onChange={(event) => setDeliveryDetails(event.target.value)} />
            <button className="btn btn-primary mt-2"><Send size={14} /> Entregar e notificar</button>
          </form>
          <form className="panel rounded-lg p-5" onSubmit={sendMessage}>
            <div className="flex items-center gap-2"><MessageSquare size={17} /><h2 className="font-extrabold">Mensagem imediata</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><select className="field" value={messageSender} onChange={(event) => { setMessageSender(event.target.value); setMessageReview(false); }}>{senders.filter((sender) => sender.ativo).map((sender) => <option key={sender.id}>{sender.nome}</option>)}</select><select className="field" value={messageTarget} onChange={(event) => { setMessageTarget(event.target.value as "selected" | "all"); setMessageReview(false); }}><option value="selected">Somente {selected?.name}</option><option value="all">Todos</option></select></div>
            <textarea required className="field mt-2 min-h-24" value={messageBody} onChange={(event) => { setMessageBody(event.target.value); setMessageReview(false); }} placeholder="Mensagem privada; o remetente real continua protegido." />
            {messageReview && <div className="mt-3 rounded border border-[#754049] bg-[#7d1a25]/10 p-3"><p className="eyebrow">prévia obrigatória</p><p className="mt-2 text-xs">De <strong>{messageSender}</strong> para <strong>{messageTarget === "all" ? "todos os jogadores vinculados" : selected?.name}</strong></p><p className="mt-2 whitespace-pre-wrap text-sm text-[#c2c4c9]">{messageBody}</p><button className="btn mt-3" type="button" onClick={() => setMessageReview(false)}>Continuar editando</button></div>}
            <button className="btn btn-primary mt-2"><Send size={14} /> {messageReview ? "Confirmar envio" : "Revisar mensagem"}</button>
          </form>
          {notice && <p className="rounded border border-[#315b45] bg-[#153323]/30 p-3 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
        </aside>
      </div>
    </div>
  );
}
