import Image from "next/image";
import { EyeOff, Package, Radio, Skull, Sparkles, Swords, Users } from "lucide-react";
import { DiceRoller } from "@/components/dice/dice-roller";
import { AbilityDetails } from "@/components/character/ability-details";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { LiveSync } from "@/components/live-sync";
import { MapStudio } from "@/components/master/map-studio";
import { SessionClock } from "@/components/master/session-clock";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { AbilityRequestButton } from "@/components/player/ability-request-button";
import { InventoryActions } from "@/components/player/inventory-actions";
import { LiveRollFeed } from "@/components/player/live-roll-feed";
import { SafetyTools } from "@/components/player/safety-tools";
import { CheckRequestCard } from "@/components/player/check-request-card";
import { isCharacterFieldVisible, isCharacterSectionVisible } from "@/lib/character-visibility";
import { formatClockTime, formatDateTime } from "@/lib/date-time";
import {
  getAuthorizedCharacters,
  getAuthorizedMessages,
  getCharacterAbilities,
  getCharacterInventory,
  getSessionAbilityRequests,
  getSessionCheckRequests,
  getSessionDiceRolls,
} from "@/server/repositories/character-repository";
import { getCenaPrincipal, getSessionSceneState } from "@/server/repositories/master-repository";
import {
  demoCampaignId,
  getCurrentSession,
  getSessionCast,
  getSessionInitiative,
  getSessionPublicState,
} from "@/server/repositories/session-repository";
import { notFound } from "next/navigation";

export default async function PlayerSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getCurrentSession(undefined, sessionId);
  if (!session) notFound();
  const campaignId = session.campaignId ?? demoCampaignId;
  const [characters, sceneState] = await Promise.all([
    getAuthorizedCharacters(),
    getSessionSceneState(session.id),
  ]);
  const character = characters[0];
  if (!character)
    return (
      <section className="panel rounded-lg p-5">
        <h1 className="text-2xl font-black">Ficha não vinculada</h1>
      </section>
    );
  const [
    publicState,
    cast,
    scene,
    authorizedMessages,
    initiative,
    abilities,
    inventory,
    requests,
    rolls,
    checkRequests,
  ] = await Promise.all([
    getSessionPublicState(campaignId, session.id),
    getSessionCast(campaignId, session.id),
    getCenaPrincipal(campaignId, sceneState.sceneId),
    getAuthorizedMessages(),
    getSessionInitiative(session.id),
    getCharacterAbilities(character.id),
    getCharacterInventory(character.id),
    getSessionAbilityRequests(session.id),
    getSessionDiceRolls(session.id),
    getSessionCheckRequests(session.id),
  ]);
  const disabled = ["dying", "dead"].includes(character.characterState ?? "");
  const targets = cast.flatMap((member) =>
    member.characterId && member.characterId !== character.id
      ? [{ id: member.characterId, name: member.name }]
      : [],
  );
  const visibleEntities = scene.tokens.filter(
    (token) => token.actorType && token.actorType !== "player_character" && token.visivel,
  );
  return (
    <div>
      <LiveSync campaignId={campaignId} />
      <SafetyTools campaignId={campaignId} sessionId={session.id} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">sala ao vivo // rodada {session.round}</p>
          <h1 className="mt-1 text-3xl font-black">{publicState.sceneTitle || session.scene}</h1>
        </div>
        <RealtimeIndicator channel={`session:${session.id}`} />
      </div>
      {character.characterState === "dying" && (
        <section className="mt-5 rounded-xl border border-[#a46d2b] bg-[#7a4516]/20 p-6 text-center">
          <h2 className="text-3xl font-black text-[#f0bd72]">Você está quase morto</h2>
          <p className="mt-2 text-sm text-[#d7b98e]">
            Seu PV chegou a zero. Você está sem ações até a decisão do mestre.
          </p>
        </section>
      )}
      {character.characterState === "dead" && (
        <section className="mt-5 rounded-xl border border-[#a72e3b] bg-[#711722]/25 p-6 text-center">
          <Skull className="mx-auto text-[#ff6977]" size={36} />
          <h2 className="mt-3 text-3xl font-black text-[#ff7b88]">Você morreu</h2>
          <p className="mt-2 text-sm text-[#d7a4a9]">
            O mestre declarou a morte do personagem. Seu token está marcado no mapa.
          </p>
        </section>
      )}
      <div className="mt-6">
        {sceneState.enabled ? (
          <MapStudio
            campaignId={campaignId}
            initialScene={scene}
            allowedCharacterIds={cast.flatMap((member) =>
              member.characterId ? [member.characterId] : [],
            )}
            collective
          />
        ) : (
          <section className="panel grid min-h-80 place-items-center rounded-lg p-6 text-center">
            <div>
              <EyeOff className="mx-auto text-[#e8c16d]" size={36} />
              <h2 className="mt-4 text-xl font-black">Cena temporariamente dessincronizada</h2>
              <p className="mt-2 text-sm text-[#92959c]">
                O mestre está preparando o próximo cenário. A atualização aparecerá automaticamente.
              </p>
            </div>
          </section>
        )}
      </div>
      <section className="panel player-live-sheet mt-4 rounded-lg p-4 sm:p-5">
        <div className="player-live-sheet-header">
          {isCharacterFieldVisible(character, "portrait") && (
            <CharacterPortrait
              name={character.name}
              portraitUrl={character.portraitUrl}
              className="size-16 rounded-xl sm:size-20"
            />
          )}
          <div className="min-w-0 flex-1">
            <p className="eyebrow">minha ficha // atualização ao vivo</p>
            <h2 className="mt-1 truncate text-xl font-black sm:text-2xl">{character.name}</h2>
            <p className="mt-1 text-xs text-[#92959c]">
              {isCharacterFieldVisible(character, "codename") && character.codename
                ? `${character.codename} · `
                : ""}
              {isCharacterFieldVisible(character, "class") ? character.className : "Sobrevivente"}
              {isCharacterFieldVisible(character, "path") ? ` · ${character.path}` : ""}
            </p>
          </div>
          {isCharacterFieldVisible(character, "nex") && (
            <span className="tag shrink-0">NEX {character.nex}%</span>
          )}
        </div>
        {isCharacterSectionVisible(character, "resources") && (
          <div className="player-live-resources mt-4">
            {Object.values(character.resources).map((resource) => (
              <div key={resource.kind}>
                <span>{resource.kind}</span>
                <strong>
                  {resource.current}/{resource.maximum}
                </strong>
                <i>
                  <b
                    style={{
                      width: `${Math.max(0, Math.min(100, resource.maximum > 0 ? (resource.current / resource.maximum) * 100 : 0))}%`,
                    }}
                  />
                </i>
              </div>
            ))}
          </div>
        )}
        {isCharacterFieldVisible(character, "attributes") && (
          <div className="player-live-attributes mt-4">
            {Object.entries(character.attributes).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        )}
        <div className="player-live-stats mt-4">
          {isCharacterFieldVisible(character, "defense") && (
            <span>
              DEF <strong>{character.defense}</strong>
            </span>
          )}
          {isCharacterFieldVisible(character, "block") && (
            <span>
              Bloqueio <strong>{character.blockValue ?? 0}</strong>
            </span>
          )}
          {isCharacterFieldVisible(character, "dodge") && (
            <span>
              Esquiva <strong>{character.dodgeValue ?? 0}</strong>
            </span>
          )}
          {isCharacterFieldVisible(character, "movement") && (
            <span>
              Deslocamento <strong>{character.movement ?? 0}m</strong>
            </span>
          )}
          {isCharacterFieldVisible(character, "main_dc") && (
            <span>
              DT <strong>{character.mainDc ?? "—"}</strong>
            </span>
          )}
        </div>
        {isCharacterFieldVisible(character, "conditions") && character.conditions.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {character.conditions.map((condition) => (
              <span className="tag" key={condition}>
                {condition}
              </span>
            ))}
          </div>
        )}
      </section>
      {visibleEntities.length > 0 && (
        <section className="panel mt-4 rounded-lg p-4">
          <p className="eyebrow">presenças na cena</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {visibleEntities.map((token) => (
              <article
                className="flex items-center gap-3 rounded-lg border border-[#30333a] bg-black/20 p-2.5"
                key={token.id}
              >
                <CharacterPortrait
                  name={token.nome}
                  portraitUrl={token.portraitUrl}
                  className="size-11 shrink-0 rounded-full"
                />
                <div>
                  <strong className="text-sm">{token.nome}</strong>
                  <p className="mt-0.5 flex items-center gap-1 text-[0.65rem] uppercase tracking-wide text-[#8f929a]">
                    <Sparkles size={11} /> NPC ou entidade na cena
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.62fr]">
        <div className="space-y-4">
          <section className="panel rounded-lg border-[#5d2a31] p-5">
            <div className="flex items-center justify-between">
              <span className="tag border-[#63323a] text-[#ed919a]">
                <Radio size={12} /> {session.status.toUpperCase()}
              </span>
              <span className="font-mono text-xs text-[#777a81]">R{session.round}</span>
            </div>
            <h2 className="mt-5 text-2xl font-black">Informações públicas da sessão</h2>
            <p className="mt-2 text-sm text-[#999ca3]">
              {publicState.publicSummary || "O mestre ainda não publicou um resumo para esta cena."}
            </p>
            <p className="mt-3 rounded border border-[#30333a] p-3 text-sm">
              <strong>Objetivo:</strong> {publicState.publicObjective || "Ainda não publicado."}
            </p>
          </section>
          <DiceRoller
            characterId={character.id}
            sessionId={session.id}
            disabledReason={disabled ? "O personagem está sem ações neste estado." : undefined}
          />
          {checkRequests.filter((request) => request.characterId === character.id).map((request) => (
            <CheckRequestCard key={request.id} request={request} />
          ))}
          <LiveRollFeed rolls={rolls} />
          {isCharacterSectionVisible(character, "abilities") && (
            <section className="panel rounded-lg p-5">
              <div className="flex items-center gap-2">
                <Sparkles size={17} className="text-[#d94a57]" />
                <h2 className="font-extrabold">Solicitar habilidades</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {abilities
                  .filter((ability) => ability.state === "unlocked")
                  .map((ability) => {
                    const request = requests.find((item) => item.characterAbilityId === ability.id);
                    return (
                      <article className="rounded border border-[#30333a] p-4" key={ability.id}>
                        <strong>{ability.name}</strong>
                        <p className="mt-2 text-xs leading-5 text-[#92959c]">
                          {ability.description}
                        </p>
                        <AbilityDetails ability={ability} />
                        {!disabled && (
                          <AbilityRequestButton
                            campaignId={campaignId}
                            sessionId={session.id}
                            characterId={character.id}
                            abilityId={ability.id}
                            pendingRequest={
                              request
                                ? {
                                    id: request.id,
                                    decision: request.decision,
                                    rolled: request.rolled,
                                  }
                                : undefined
                            }
                          />
                        )}
                      </article>
                    );
                  })}
                {abilities.length === 0 && (
                  <p className="text-sm text-[#777a82]">Nenhuma habilidade liberada.</p>
                )}
              </div>
            </section>
          )}
          {isCharacterSectionVisible(character, "inventory") && (
            <section className="panel rounded-lg p-5">
              <div className="flex items-center gap-2">
                <Package size={17} className="text-[#d94a57]" />
                <h2 className="font-extrabold">Inventário na sessão</h2>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {inventory.map((item) => (
                  <article
                    className="item-player-card rounded border border-[#30333a] p-4"
                    key={item.id}
                  >
                    {item.imageUrl && (
                      <span className="item-player-image">
                        <Image
                          src={item.imageUrl}
                          alt={`Imagem de ${item.name}`}
                          fill
                          sizes="(max-width: 768px) 100vw, 50vw"
                        />
                      </span>
                    )}
                    <div className="flex justify-between gap-2">
                      <strong>{item.name}</strong>
                      <span className="tag">{item.state}</span>
                    </div>
                    <p className="mt-2 text-xs text-[#92959c]">{item.description || item.detail}</p>
                    {!disabled && <InventoryActions characterItemId={item.id} targets={targets} />}
                  </article>
                ))}
                {inventory.length === 0 && (
                  <p className="text-sm text-[#777a82]">Inventário vazio.</p>
                )}
              </div>
            </section>
          )}
          {isCharacterSectionVisible(character, "messages") && authorizedMessages[0] && (
            <section className="panel rounded-lg p-5">
              <p className="eyebrow">sinal recebido</p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <h2 className="font-extrabold">{authorizedMessages[0].sender}</h2>
                <time className="font-mono text-[0.65rem] text-[#969aa3]" dateTime={authorizedMessages[0].createdAt} title={formatDateTime(authorizedMessages[0].createdAt)}>
                  {formatClockTime(authorizedMessages[0].createdAt)}
                </time>
              </div>
              <p className="mt-3 text-sm leading-6 text-[#b8bac0]">{authorizedMessages[0].body}</p>
            </section>
          )}
          {isCharacterSectionVisible(character, "resources") && (
            <section className="panel rounded-lg p-5">
              <div className="flex items-center gap-2">
                <Users size={17} className="text-[#d94a57]" />
                <h2 className="font-extrabold">Personagens visíveis</h2>
              </div>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {cast.map((member) => (
                  <div className="rounded border border-[#30333a] p-3" key={member.id}>
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: member.color }} />
                      <strong className="text-sm">{member.name}</strong>
                    </div>
                    <p className="mt-1 text-xs text-[#858891]">{member.description}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
        <div className="space-y-4">
          <section className="panel rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Swords size={17} className="text-[#d94a57]" />
              <h2 className="font-extrabold">Iniciativa</h2>
            </div>
            <ol className="mt-4 space-y-2">
              {initiative.map((entry) => (
                <li
                  key={entry.id}
                  className={`flex items-center justify-between rounded px-3 py-2 text-sm ${entry.active ? "bg-[#8a1b27]/25 text-white" : "bg-white/[0.025] text-[#9b9ea5]"}`}
                >
                  <span>{entry.name}</span>
                  <strong>{entry.value ?? "—"}</strong>
                </li>
              ))}
              {initiative.length === 0 && (
                <li className="text-sm text-[#777a82]">Nenhum encontro ativo.</li>
              )}
            </ol>
          </section>
          <SessionClock
            initialElapsedSeconds={session.elapsedSeconds ?? 0}
            initialTimerStartedAt={session.timerStartedAt}
            initialStatus={session.status}
          />
        </div>
      </div>
    </div>
  );
}
