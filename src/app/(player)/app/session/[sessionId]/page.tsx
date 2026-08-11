import { Clock3, Radio, Swords, Users } from "lucide-react";
import { DiceRoller } from "@/components/dice/dice-roller";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { LiveSync } from "@/components/live-sync";
import { MapStudio } from "@/components/master/map-studio";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { initiative } from "@/lib/demo-data";
import { isCharacterSectionVisible } from "@/lib/character-visibility";
import { getAuthorizedCharacters, getAuthorizedMessages } from "@/server/repositories/character-repository";
import { getCenaPrincipal } from "@/server/repositories/master-repository";
import { demoCampaignId, getCurrentSession, getSessionCast, getSessionPublicState } from "@/server/repositories/session-repository";

export default async function PlayerSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  const session = await getCurrentSession(demoCampaignId, sessionId);
  const [characters, publicState, cast, scene, authorizedMessages] = await Promise.all([
    getAuthorizedCharacters(),
    getSessionPublicState(demoCampaignId, session.id),
    getSessionCast(demoCampaignId),
    getCenaPrincipal(demoCampaignId),
    getAuthorizedMessages(),
  ]);
  const character = characters[0];
  if (!character) return <section className="panel rounded-lg p-5"><h1 className="text-2xl font-black">Ficha não vinculada</h1></section>;
  return (
    <div>
      <LiveSync campaignId={publicState.campaignId} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">sala ao vivo // rodada {session.round}</p>
          <h1 className="mt-1 text-3xl font-black">{publicState.sceneTitle}</h1>
        </div>
        <RealtimeIndicator channel={`session:${session.id}`} />
      </div>
      <div className="mt-6"><MapStudio campaignId={publicState.campaignId} initialScene={scene} collective /></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.62fr]">
        <div className="space-y-4">
          <section className="panel rounded-lg border-[#5d2a31] p-5">
            <div className="flex items-center justify-between">
              <span className="tag border-[#63323a] text-[#ed919a]">
                <Radio size={12} /> SEU TURNO EM BREVE
              </span>
              <span className="font-mono text-xs text-[#777a81]">R{session.round}</span>
            </div>
            <h2 className="mt-5 text-2xl font-black">Prepare uma ação.</h2>
            <p className="mt-2 text-sm text-[#999ca3]">{publicState.publicSummary}</p>
            <p className="mt-3 rounded border border-[#30333a] p-3 text-sm"><strong>Objetivo:</strong> {publicState.publicObjective}</p>
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
                  key={entry.name}
                  className={`flex items-center justify-between rounded px-3 py-2 text-sm ${entry.active ? "bg-[#8a1b27]/25 text-white" : "bg-white/[0.025] text-[#9b9ea5]"}`}
                >
                  <span>{entry.name}</span>
                  <strong>{entry.value}</strong>
                </li>
              ))}
            </ol>
          </section>
          <span className="tag">
            <Clock3 size={12} /> Reconexão preserva esta ficha
          </span>
        </div>
      </div>
    </div>
  );
}
