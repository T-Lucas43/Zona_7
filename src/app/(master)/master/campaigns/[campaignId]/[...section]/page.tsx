import { CheckCircle2, Shield } from "lucide-react";
import { notFound } from "next/navigation";
import { CharacterCard } from "@/components/character/character-card";
import { LiveSync } from "@/components/live-sync";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { CharacterPdfActions } from "@/components/character/character-pdf-actions";
import { CharacterSheetOverview } from "@/components/character/character-sheet-overview";
import { AbilityManager } from "@/components/master/ability-manager";
import { AccountManager } from "@/components/master/account-manager";
import { ActorManager } from "@/components/master/actor-manager";
import { CustomizationManager } from "@/components/master/customization-manager";
import { CharacterIdentityEditor } from "@/components/master/character-identity-editor";
import { CharacterNotesEditor } from "@/components/master/character-notes-editor";
import { CharacterRulesManager } from "@/components/master/character-rules-manager";
import { CharacterVisibilityManager } from "@/components/master/character-visibility-manager";
import { CharacterCreator } from "@/components/master/character-creator";
import { CreateSessionForm } from "@/components/master/create-session-form";
import { EncounterManager } from "@/components/master/encounter-manager";
import { HandoutManager } from "@/components/master/handout-manager";
import { InvestigationBoard } from "@/components/master/investigation-board";
import { MapStudio } from "@/components/master/map-studio";
import { MessagingStudio } from "@/components/master/messaging-studio";
import { MeterControl } from "@/components/master/meter-control";
import { NotebookManager } from "@/components/master/notebook-manager";
import { ResourceConsole } from "@/components/master/resource-console";
import { RuleCatalogManager } from "@/components/master/rule-catalog-manager";
import { SessionHub } from "@/components/master/session-hub";
import { SessionItemManager } from "@/components/master/session-item-manager";
import { ScriptStudio } from "@/components/master/script-studio";
import {
  getCampaignCharacters,
  getSessionCharacterDetails,
  getSessionCharacters,
  getCharacterActions,
  getCharacterAbilities,
  getCharacterSkills,
  getCharacterWeaknesses,
  getCharacterInventory,
  getSessionAbilityRequests,
  getSessionCheckRequests,
  getSessionDiceRolls,
} from "@/server/repositories/character-repository";
import {
  getAtores,
  getCenaPrincipal,
  getCadernosDaCampanha,
  getContasDaCampanha,
  getEncontros,
  getEventosAuditoria,
  getMensagensDaCampanha,
  getNomeCampanha,
  getPersonalizacao,
  getPistas,
  getConexoesDoMural,
  getItensDaCampanha,
  getSessionSceneState,
  getRegras,
  getRemetentes,
  getRoteiros,
} from "@/server/repositories/master-repository";
import {
  getCurrentSession,
  getSessionCast,
  getSessionPublicState,
} from "@/server/repositories/session-repository";
import { requireCampaignMaster } from "@/server/services/master-access";
import { getSessionScriptRun } from "@/server/repositories/script-repository";
import { getRuleCatalog } from "@/server/repositories/rules-repository";
import { getLatestSessionSummary, getSessionTimeline } from "@/server/repositories/session-history-repository";

async function optionalSessionModule<T>(
  label: string,
  operation: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    console.error(`[Central da sessao] ${label} indisponivel`, error);
    return fallback;
  }
}

export default async function MasterSectionPage({
  params,
}: {
  params: Promise<{ campaignId: string; section: string[] }>;
}) {
  const { campaignId, section } = await params;
  await requireCampaignMaster(campaignId);
  const [area, id] = section;
  if (area === "sessions" || area === "collective")
    return <SessionConsole campaignId={campaignId} sessionId={id} />;
  if (area === "characters" && id) return <CharacterEditor campaignId={campaignId} id={id} />;
  return <SectionIndex area={area} campaignId={campaignId} />;
}

async function SessionConsole({
  campaignId,
  sessionId,
}: {
  campaignId: string;
  sessionId?: string;
}) {
  const session = await getCurrentSession(campaignId, sessionId);
  if (!session) {
    const nomeCampanha = await getNomeCampanha(campaignId);
    return (
      <div>
        <p className="eyebrow">{`${nomeCampanha} // central da sessão`}</p>
        <h1 className="mt-1 text-3xl font-black">Nenhuma sessão cadastrada</h1>
        <section className="panel mt-6 rounded-lg p-6">
          <p className="text-sm text-[#92959c]">
            Esta campanha ainda não possui uma sessão real. Crie uma sessão para abrir a central ao
            vivo.
          </p>
          <CreateSessionForm campaignId={campaignId} />
        </section>
      </div>
    );
  }
  const sceneState = await optionalSessionModule(
    "sincronizacao da cena",
    () => getSessionSceneState(session.id),
    { enabled: true, sceneId: null },
  );
  const [
    elenco,
    cena,
    contas,
    remetentes,
    roteiros,
    estadoPublico,
    atoresVisiveis,
    execucaoRoteiro,
    encontros,
    atores,
    itens,
    pistas,
    solicitacoes,
    testesSolicitados,
    rolagens,
    timeline,
    latestSummary,
  ] = await Promise.all([
    optionalSessionModule(
      "personagens conectados",
      () => getSessionCharacters(campaignId, session.id),
      [],
    ),
    optionalSessionModule(
      "mapa e tokens",
      () => getCenaPrincipal(campaignId, sceneState.sceneId),
      null,
    ),
    optionalSessionModule("contas vinculadas", () => getContasDaCampanha(campaignId, false), []),
    optionalSessionModule("remetentes", () => getRemetentes(campaignId), []),
    optionalSessionModule("roteiros", () => getRoteiros(campaignId), []),
    optionalSessionModule(
      "estado publico",
      () => getSessionPublicState(campaignId, session.id),
      {
        sessionId: session.id,
        campaignId,
        sceneTitle: session.scene,
        publicSummary: "",
        publicObjective: "",
        version: 0,
      },
    ),
    optionalSessionModule("elenco visivel", () => getSessionCast(campaignId, session.id), []),
    optionalSessionModule("execucao do roteiro", () => getSessionScriptRun(session.id), null),
    optionalSessionModule("encontros", () => getEncontros(campaignId), []),
    optionalSessionModule("entidades e NPCs", () => getAtores(campaignId), []),
    optionalSessionModule("itens da sessao", () => getItensDaCampanha(campaignId), []),
    optionalSessionModule("pistas", () => getPistas(campaignId), []),
    optionalSessionModule(
      "solicitacoes de habilidade",
      () => getSessionAbilityRequests(session.id),
      [],
    ),
    optionalSessionModule(
      "testes solicitados",
      () => getSessionCheckRequests(session.id),
      [],
    ),
    optionalSessionModule("rolagens publicas", () => getSessionDiceRolls(session.id), []),
    optionalSessionModule("linha do tempo", () => getSessionTimeline(campaignId, session.id), []),
    optionalSessionModule("resumo da sessao", () => getLatestSessionSummary(session.id), null),
  ]);
  if (!cena) {
    return (
      <div>
        <section className="panel rounded-lg p-6" role="alert">
          <p className="eyebrow">central da sessao // mapa indisponivel</p>
          <h1 className="mt-2 text-2xl font-black">A sessao continua acessivel</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#8f99a6]">
            O mapa atual nao respondeu. Abra Mapas e tokens para selecionar ou publicar uma cena;
            os demais dados da campanha foram preservados.
          </p>
          <a className="btn btn-primary mt-5" href={`/master/campaigns/${campaignId}/maps`}>
            Abrir Mapas e tokens
          </a>
        </section>
      </div>
    );
  }
  const detalhes = await optionalSessionModule(
    "fichas dos personagens conectados",
    () => getSessionCharacterDetails(elenco.map((character) => character.id)),
    [],
  );
  return (
    <SessionHub
      key={JSON.stringify([
        session.status,
        session.round,
        cena.backgroundKey,
        cena.tokens.map((token) => [
          token.id,
          token.x,
          token.y,
          token.visivel,
          token.characterState,
          token.portraitKey,
          token.itemImageKey,
        ]),
        cena.connections.map((connection) => [connection.fromTokenId, connection.toTokenId]),
        execucaoRoteiro?.runId,
        execucaoRoteiro?.sequence,
        elenco.map((character) => [
          character.id,
          character.version,
          character.characterState,
          character.attributes,
          character.resources,
        ]),
        solicitacoes.map((request) => [request.id, request.decision, request.rolled]),
        rolagens.map((roll) => [roll.id, roll.total]),
        timeline.map((event) => [event.id, event.reversalStatus]),
        latestSummary?.revision,
        cena.reveal.version,
        sceneState.enabled,
      ])}
      campaignId={campaignId}
      session={session}
      initialPublicState={estadoPublico}
      initialCharacters={elenco}
      characterDetails={detalhes}
      scene={cena}
      accounts={contas}
      senders={remetentes}
      scripts={roteiros.filter(
        (roteiro) => roteiro.estado === "published" || roteiro.estado === "Publicado",
      )}
      initialScriptRun={execucaoRoteiro}
      encounters={encontros}
      actors={atores}
      items={itens}
      handouts={pistas}
      initialAbilityRequests={solicitacoes}
      initialCheckRequests={testesSolicitados}
      initialRolls={rolagens}
      initialSceneSyncEnabled={sceneState.enabled}
      initialTimeline={timeline}
      initialSessionSummary={latestSummary}
      visibleCharacterIds={atoresVisiveis.flatMap((ator) =>
        ator.characterId && elenco.some((character) => character.id === ator.characterId)
          ? [ator.characterId]
          : [],
      )}
    />
  );
}

async function CharacterEditor({ campaignId, id }: { campaignId: string; id: string }) {
  const elenco = await getCampaignCharacters(campaignId);
  const character = elenco.find((item) => item.id === id);
  if (!character) notFound();
  const [habilidades, pericias, acoes, fraquezas, inventario] = await Promise.all([
    getCharacterAbilities(character.id),
    getCharacterSkills(character.id),
    getCharacterActions(character.id),
    getCharacterWeaknesses(character.id),
    getCharacterInventory(character.id),
  ]);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">ficha completa // concorrência otimista</p>
          <h1 className="mt-1 text-3xl font-black">{character.name}</h1>
        </div>
        <CharacterPdfActions characterId={character.id} />
      </div>
      <div className="mt-6">
        <CharacterSheetOverview
          character={character}
          skills={pericias}
          actions={acoes}
          abilities={habilidades}
          weaknesses={fraquezas}
          inventory={inventario}
          master
        />
      </div>
      <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.35fr_0.85fr]">
        <aside className="panel rounded-lg p-4">
          <p className="eyebrow">elenco</p>
          {elenco.map((item) => (
            <a
              className={`mt-2 flex items-center gap-3 rounded border p-3 ${item.id === character.id ? "border-[#6c343a] bg-[#8a1b27]/10" : "border-[#30333a]"}`}
              href={`/master/campaigns/${campaignId}/characters/${item.id}`}
              key={item.id}
            >
              <CharacterPortrait
                name={item.name}
                portraitUrl={item.portraitUrl}
                className="size-10 rounded-full"
              />
              <span>
                <strong className="block text-xs">{item.name}</strong>
                <span className="text-[0.65rem] text-[#777a82]">{item.status}</span>
              </span>
            </a>
          ))}
        </aside>
        <div className="space-y-4">
          <CharacterIdentityEditor campaignId={campaignId} initial={character} />
          <CharacterVisibilityManager campaignId={campaignId} character={character} />
        </div>
        <aside className="space-y-4">
          <ResourceConsole initialCharacters={[character]} />
          <MeterControl
            campaignId={campaignId}
            characterId={character.id}
            name={character.meter.name}
            initialValue={character.meter.value}
            stages={character.meter.stages}
          />
        </aside>
      </div>
      <CharacterNotesEditor campaignId={campaignId} characterId={character.id} />
      <CharacterRulesManager
        campaignId={campaignId}
        characterId={character.id}
        skills={pericias}
        actions={acoes}
        weaknesses={fraquezas}
      />
      <AbilityManager
        campaignId={campaignId}
        characterId={character.id}
        initialAbilities={habilidades}
      />
    </div>
  );
}

async function SectionIndex({ area, campaignId }: { area: string; campaignId: string }) {
  const titles: Record<string, string> = {
    members: "Membros e convites",
    characters: "Personagens",
    sessions: "Sessões",
    encounters: "Encontros",
    messages: "Mensagens",
    handouts: "Pistas e materiais",
    notebooks: "Cadernos dos jogadores",
    rules: "Regras da campanha",
    audit: "Auditoria",
    settings: "Configurações",
    maps: "Mapas e tokens",
    collective: "Tela coletiva",
    actors: "Atores controlados pelo mestre",
    items: "Itens da sessão",
    scripts: "Roteiros e automações",
  };
  const title = titles[area] ?? "Console da campanha";
  const needsCharacters = area === "characters" || area === "members" || area === "messages";
  const needsAccounts =
    area === "members" || area === "messages" || area === "characters" || area === "notebooks";
  const needsScene = area === "maps" || area === "collective" || area === "actors";
  const sectionSession =
    area === "maps" || area === "scripts" ? await getCurrentSession(campaignId) : null;
  const [mapSceneState, mapCharacters] =
    area === "maps" && sectionSession
      ? await Promise.all([
          getSessionSceneState(sectionSession.id),
          getSessionCharacters(campaignId, sectionSession.id),
        ])
      : [{ enabled: true, sceneId: null }, []];
  const [
    nomeCampanha,
    personagens,
    contas,
    remetentes,
    personalizacao,
    atores,
    cena,
    roteiros,
    encontros,
    mensagens,
    pistas,
    conexoesMural,
    itens,
    regras,
    catalogoRegras,
    auditoria,
    cadernos,
  ] = await Promise.all([
    getNomeCampanha(campaignId),
    needsCharacters ? getCampaignCharacters(campaignId) : Promise.resolve([]),
    needsAccounts ? getContasDaCampanha(campaignId, area !== "messages") : Promise.resolve([]),
    area === "messages" ? getRemetentes(campaignId) : Promise.resolve([]),
    area === "settings" ? getPersonalizacao(campaignId) : Promise.resolve(null),
    area === "actors" ? getAtores(campaignId) : Promise.resolve([]),
    needsScene
      ? getCenaPrincipal(campaignId, area === "maps" ? mapSceneState.sceneId : undefined)
      : Promise.resolve(null),
    area === "scripts" ? getRoteiros(campaignId) : Promise.resolve([]),
    area === "encounters" ? getEncontros(campaignId) : Promise.resolve([]),
    area === "messages" ? getMensagensDaCampanha(campaignId) : Promise.resolve([]),
    area === "handouts" || area === "notebooks" ? getPistas(campaignId) : Promise.resolve([]),
    area === "handouts" ? getConexoesDoMural(campaignId) : Promise.resolve([]),
    area === "items" || area === "maps" ? getItensDaCampanha(campaignId) : Promise.resolve([]),
    area === "rules" ? getRegras(campaignId) : Promise.resolve(null),
    area === "rules" ? getRuleCatalog(campaignId) : Promise.resolve([]),
    area === "audit" ? getEventosAuditoria(campaignId) : Promise.resolve([]),
    area === "notebooks" ? getCadernosDaCampanha(campaignId) : Promise.resolve([]),
  ]);
  return (
    <div>
      <p className="eyebrow">
        {nomeCampanha}
        {" // "}
        {title}
      </p>
      <h1 className="mt-1 text-3xl font-black">{title}</h1>
      {area === "characters" && (
        <>
          <CharacterCreator campaignId={campaignId} accounts={contas} />
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {personagens.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                master
                campaignId={campaignId}
              />
            ))}
          </div>
        </>
      )}
      {area === "members" && (
        <AccountManager campaignId={campaignId} initialAccounts={contas} characters={personagens} />
      )}
      {area === "encounters" && (
        <EncounterManager campaignId={campaignId} initialItems={encontros} />
      )}
      {area === "messages" && (
        <div className="mt-6 space-y-4">
          <MessagingStudio campaignId={campaignId} initialSenders={remetentes} accounts={contas} />
          <section className="grid gap-3 md:grid-cols-2">
            {mensagens.map((message) => (
              <article className="panel rounded-lg p-4" key={message.id}>
                <p className="eyebrow">
                  {message.remetente} → {message.destinatarios} destinatário(s)
                </p>
                <p className="mt-2 text-sm">{message.corpo || "Mensagem sem conteúdo textual."}</p>
                <span className="tag mt-3">{message.estado}</span>
              </article>
            ))}
            {mensagens.length === 0 && (
              <p className="text-sm text-[#777a82]">Nenhuma mensagem enviada.</p>
            )}
          </section>
        </div>
      )}
      {area === "handouts" && (
        <>
          <LiveSync campaignId={campaignId} fallbackIntervalMs={30_000} />
          <InvestigationBoard
            key={JSON.stringify([pistas.map((item) => [item.id, item.board]), conexoesMural])}
            campaignId={campaignId}
            initialItems={pistas}
            initialConnections={conexoesMural}
          />
          <HandoutManager
            key={pistas.map((item) => item.id).join("|")}
            campaignId={campaignId}
            initialItems={pistas}
          />
        </>
      )}
      {area === "notebooks" && (
        <NotebookManager
          campaignId={campaignId}
          accounts={contas}
          initialPages={cadernos}
          handouts={pistas}
        />
      )}
      {area === "items" && <SessionItemManager campaignId={campaignId} initialItems={itens} />}
      {area === "rules" &&
        (regras ? (
          <>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <section className="panel rounded-lg p-5">
              <Shield className="text-[#d84b57]" />
              <h2 className="mt-4 font-extrabold">{regras.perfil}</h2>
              <p className="mt-2 text-sm leading-6 text-[#8f9299]">
                {regras.descricao || regras.sistema}
              </p>
            </section>
            <section className="panel rounded-lg p-5">
              <Shield className="text-[#999ca3]" />
              <h2 className="mt-4 font-extrabold">Configuração aplicada</h2>
              <p className="mt-2 text-sm leading-6 text-[#8f9299]">
                PV zero: {regras.zeroPv} · SAN zero: {regras.zeroSan} · Pressão: {regras.pressao}/7
              </p>
            </section>
          </div>
          <div className="mt-5"><RuleCatalogManager campaignId={campaignId} initialRules={catalogoRegras} /></div>
          </>
        ) : (
          <EmptyState text="Nenhum perfil de regras foi configurado." />
        ))}
      {area === "audit" && (
        <div className="panel mt-6 rounded-lg p-5">
          {auditoria.length ? (
            <ol className="space-y-5">
              {auditoria.map((event) => (
                <li className="flex gap-3" key={event.id}>
                  <CheckCircle2 className="shrink-0 text-[#5ebf89]" size={17} />
                  <div>
                    <p className="text-sm font-bold">{event.tipo}</p>
                    <p className="mt-1 font-mono text-[0.65rem] text-[#696c73]">
                      {event.entidade} · {new Date(event.criadoEm).toLocaleString("pt-BR")}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-[#777a82]">Nenhum evento de auditoria registrado.</p>
          )}
        </div>
      )}
      {area === "settings" && personalizacao && (
        <CustomizationManager campaignId={campaignId} initial={personalizacao} />
      )}
      {area === "actors" && cena && (
        <ActorManager
          campaignId={campaignId}
          initialActors={atores}
          sceneId={cena.id}
          sceneName={cena.nome}
        />
      )}
      {area === "maps" && cena && (
        <>
          <LiveSync campaignId={campaignId} fallbackIntervalMs={30_000} />
          <MapStudio
            key={JSON.stringify([
              cena.id,
              cena.backgroundKey,
              cena.tokens.map((token) => [
                token.id,
                token.x,
                token.y,
                token.visivel,
                token.portraitKey,
                token.itemImageKey,
              ]),
              cena.connections.map((connection) => [connection.fromTokenId, connection.toTokenId]),
              mapCharacters.map((character) => character.id),
            ])}
            campaignId={campaignId}
            initialScene={cena}
            allowedCharacterIds={mapCharacters.map((character) => character.id)}
            items={itens}
            recipientCharacters={mapCharacters.map((character) => ({
              id: character.id,
              name: character.name,
            }))}
          />
        </>
      )}
      {area === "scripts" && (
        <ScriptStudio
          campaignId={campaignId}
          initialScripts={roteiros}
          sessionId={sectionSession?.id}
        />
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="panel mt-6 rounded-lg p-6 text-sm text-[#858890]">{text}</div>;
}
