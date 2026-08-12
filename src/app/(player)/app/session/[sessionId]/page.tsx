import { Radio, Swords, Users } from "lucide-react";
import { DiceRoller } from "@/components/dice/dice-roller";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { LiveSync } from "@/components/live-sync";
import { MapStudio } from "@/components/master/map-studio";
import { SessionClock } from "@/components/master/session-clock";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { SessionPresence } from "@/components/player/session-presence";
import { isCharacterSectionVisible } from "@/lib/character-visibility";
import { getAuthorizedCharacters, getAuthorizedMessages } from "@/server/repositories/character-repository";
import { getCenaPrincipal } from "@/server/repositories/master-repository";
import { demoCampaignId, getCurrentSession, getSessionCast, getSessionInitiative, getSessionPublicState } from "@/server/repositories/session-repository";
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
  const [characters, publicState, cast, scene, authorizedMessages, initiative] = await Promise.all([
    getAuthorizedCharacters(),
    getSessionPublicState(campaignId, session.id),
    getSessionCast(campaignId),
    getCenaPrincipal(campaignId),
    getAuthorizedMessages(),
    getSessionInitiative(session.id),
  ]);
  const character = characters[0];
  if (!character) return <section className="panel rounded-lg p-5"><h1 className="text-2xl font-black">Ficha não vinculada</h1></section>;
  return (
    <div>
      <SessionPresence campaignId={campaignId} sessionId={session.id} characterId={character.id} />
      <LiveSync campaignId={publicState.campaignId} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">sala ao vivo // rodada {session.round}</p>
          <h1 className="mt-1 text-3xl font-black">{publicState.sceneTitle || session.scene}</h1>
        </div>
        <RealtimeIndicator channel={`session:${session.id}`} />
      </div>
      <div className="mt-6"><MapStudio campaignId={publicState.campaignId} initialScene={scene} collective /></div>
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
            <p className="mt-2 text-sm text-[#999ca3]">{publicState.publicSummary || "O mestre ainda não publicou um resumo para esta cena."}</p>
            <p className="mt-3 rounded border border-[#30333a] p-3 text-sm"><strong>Objetivo:</strong> {publicState.publicObjective || "Ainda não publicado."}</p>
          </section>
          <DiceRoller />
          {isCharacterSectionVisible(character, "messages") && authorizedMessages[0] && <section className="panel rounded-lg p-5">
            <p className="eyebrow">sinal recebido</p>
            <h2 className="mt-3 font-extrabold">{authorizedMessages[0].sender}</h2>
            <p className="mt-3 text-sm leading-6 text-[#b8bac0]">{authorizedMessages[0].body}</p>
          </section>}
          {isCharacterSectionVisible(character, "resources") && <section className="panel rounded-lg p-5">
            <div className="flex items-center gap-2"><Users size={17} className="text-[#d94a57]" /><h2 className="font-extrabold">Personagens visíveis</h2></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">{cast.map((member) => <div className="rounded border border-[#30333a] p-3" key={member.id}><div className="flex items-center gap-2"><span className="size-2 rounded-full" style={{ background: member.color }} /><strong className="text-sm">{member.name}</strong></div><p className="mt-1 text-xs text-[#858891]">{member.description}</p></div>)}</div>
          </section>}
        </div>
        <div className="space-y-4">
          <section className="panel rounded-lg p-5">
            <p className="eyebrow">estado atual</p>
            <div className="mt-2 flex items-center gap-3"><CharacterPortrait name={character.name} portraitUrl={character.portraitUrl} className="size-12 rounded-full" /><h2 className="text-xl font-extrabold">{character.name}</h2></div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {Object.values(character.resources).map((resource) => (
                <div
                  key={resource.kind}
                  className="rounded border border-[#30333a] p-3 text-center"
                >
                  <span className="font-mono text-[0.65rem] uppercase text-[#767980]">
                    {resource.kind}
                  </span>
                  <strong className="mt-1 block text-xl">{resource.current}</strong>
                </div>
              ))}
            </div>
          </section>
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
              {initiative.length === 0 && <li className="text-sm text-[#777a82]">Nenhum encontro ativo.</li>}
            </ol>
          </section>
          <SessionClock initialElapsedSeconds={session.elapsedSeconds ?? 0} initialTimerStartedAt={session.timerStartedAt} initialStatus={session.status} />
        </div>
      </div>
    </div>
  );
}
