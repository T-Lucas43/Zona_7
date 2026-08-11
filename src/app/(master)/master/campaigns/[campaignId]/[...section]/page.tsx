import { Archive, CheckCircle2, LockKeyhole, Radio, Shield, Swords } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { ResourceBars } from "@/components/character/resource-bars";
import { AbilityManager } from "@/components/master/ability-manager";
import { AccountManager } from "@/components/master/account-manager";
import { ActorManager } from "@/components/master/actor-manager";
import { CustomizationManager } from "@/components/master/customization-manager";
import { CharacterIdentityEditor } from "@/components/master/character-identity-editor";
import { CharacterNotesEditor } from "@/components/master/character-notes-editor";
import { CharacterRulesManager } from "@/components/master/character-rules-manager";
import { CharacterVisibilityManager } from "@/components/master/character-visibility-manager";
import { CharacterCreator } from "@/components/master/character-creator";
import { MapStudio } from "@/components/master/map-studio";
import { MessagingStudio } from "@/components/master/messaging-studio";
import { MeterControl } from "@/components/master/meter-control";
import { ResourceConsole } from "@/components/master/resource-console";
import { SessionHub } from "@/components/master/session-hub";
import { ScriptStudio } from "@/components/master/script-studio";
import { campaign, characters, liveSession, messages, threats } from "@/lib/demo-data";
import {
  getAuthorizedCharacter,
  getCampaignCharacters,
  getCharacterActions,
  getCharacterAbilities,
  getCharacterSkills,
  getCharacterWeaknesses,
} from "@/server/repositories/character-repository";
import {
  getAtores,
  getCenaPrincipal,
  getContasDaCampanha,
  getPersonalizacao,
  getRemetentes,
  getRoteiros,
} from "@/server/repositories/master-repository";
import {
  getCurrentSession,
  getSessionCast,
  getSessionPublicState,
} from "@/server/repositories/session-repository";
import { requireCampaignMaster } from "@/server/services/master-access";

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

async function SessionConsole({ campaignId, sessionId }: { campaignId: string; sessionId?: string }) {
  const session = await getCurrentSession(campaignId, sessionId);
  const [elenco, cena, contas, remetentes, roteiros, estadoPublico, atoresVisiveis] = await Promise.all([
    getCampaignCharacters(campaignId),
    getCenaPrincipal(campaignId),
    getContasDaCampanha(campaignId),
    getRemetentes(campaignId),
    getRoteiros(campaignId),
    getSessionPublicState(campaignId, session.id),
    getSessionCast(campaignId),
  ]);
  return (
    <SessionHub
      campaignId={campaignId}
      session={session}
      initialPublicState={estadoPublico}
      initialCharacters={elenco}
      scene={cena}
      accounts={contas}
      senders={remetentes}
      scripts={roteiros}
      visibleCharacterIds={atoresVisiveis.flatMap((ator) => ator.characterId ? [ator.characterId] : [])}
    />
  );
}

async function CharacterEditor({ campaignId, id }: { campaignId: string; id: string }) {
  const [loadedCharacter, elenco] = await Promise.all([
    getAuthorizedCharacter(id),
    getCampaignCharacters(campaignId),
  ]);
  const character = loadedCharacter ?? elenco[0] ?? characters[0];
  const [habilidades, pericias, acoes, fraquezas] = await Promise.all([
    getCharacterAbilities(character.id),
    getCharacterSkills(character.id),
    getCharacterActions(character.id),
    getCharacterWeaknesses(character.id),
  ]);
  return (
    <div>
      <p className="eyebrow">ficha completa // concorrência otimista</p>
      <h1 className="mt-1 text-3xl font-black">{character.name}</h1>
      <div className="mt-6 grid gap-4 xl:grid-cols-[0.72fr_1.35fr_0.85fr]">
        <aside className="panel rounded-lg p-4">
          <p className="eyebrow">elenco</p>
          {elenco.map((item) => (
            <a
              className={`mt-2 flex items-center gap-3 rounded border p-3 ${item.id === character.id ? "border-[#6c343a] bg-[#8a1b27]/10" : "border-[#30333a]"}`}
              href={`/master/campaigns/${campaignId}/characters/${item.id}`}
              key={item.id}
            >
              <CharacterPortrait name={item.name} portraitUrl={item.portraitUrl} className="size-10 rounded-full" />
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
          <section className="panel rounded-lg p-5">
            <h2 className="font-extrabold">Estado e atributos</h2>
            <div className="mt-4">
              <ResourceBars resources={character.resources} />
            </div>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {Object.entries(character.attributes).map(([key, value]) => (
                <div className="rounded border border-[#30333a] p-3 text-center" key={key}>
                  <span className="block text-[0.65rem] uppercase text-[#777a82]">{key}</span>
                  <strong>{value}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="panel rounded-lg p-5">
            <h2 className="font-extrabold">Perícias e ações</h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {pericias.map((pericia) => (
                <div
                  className="flex justify-between rounded border border-[#30333a] p-3 text-sm"
                  key={pericia.id}
                >
                  <span>
                    {pericia.name} <small className="text-[#777a82]">{pericia.attribute}</small>
                  </span>
                  <strong>+{pericia.bonus}</strong>
                </div>
              ))}
            </div>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {acoes.map((acao) => (
                <div className="rounded border border-[#30333a] p-3" key={acao.id}>
                  <strong className="text-sm">{acao.name}</strong>
                  <p className="mt-1 text-xs text-[#777a82]">
                    {acao.test} · {acao.damage} · {acao.type}
                  </p>
                </div>
              ))}
            </div>
          </section>
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
          <section className="panel rounded-lg p-4">
            <p className="eyebrow">fraquezas</p>
            {fraquezas.map((fraqueza) => (
              <div className="mt-3 rounded border border-[#5b3036] p-3" key={fraqueza.id}>
                <strong className="text-sm">{fraqueza.name}</strong>
                <p className="mt-1 text-xs text-[#a08689]">{fraqueza.effect}</p>
              </div>
            ))}
          </section>
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
    rules: "Regras da campanha",
    audit: "Auditoria",
    settings: "Configurações",
    maps: "Mapas e tokens",
    collective: "Tela coletiva",
    actors: "Atores controlados pelo mestre",
    scripts: "Roteiros e automações",
  };
  const title = titles[area] ?? "Console da campanha";
  const personagens = await getCampaignCharacters(campaignId);
  const contas =
    area === "members" || area === "messages" || area === "characters"
      ? await getContasDaCampanha(campaignId)
      : [];
  const remetentes = area === "messages" ? await getRemetentes(campaignId) : [];
  const personalizacao = area === "settings" ? await getPersonalizacao(campaignId) : null;
  const atores = area === "actors" ? await getAtores(campaignId) : [];
  const cena = area === "maps" || area === "collective" || area === "actors" ? await getCenaPrincipal(campaignId) : null;
  const roteiros = area === "scripts" ? await getRoteiros(campaignId) : [];
  return (
    <div>
      <p className="eyebrow">
        {campaign.name}
        {" // "}
        {title}
      </p>
      <h1 className="mt-1 text-3xl font-black">{title}</h1>
      {area === "characters" && (
        <>
          <CharacterCreator campaignId={campaignId} accounts={contas} />
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {personagens.map((character) => (
              <CharacterCard key={character.id} character={character} master campaignId={campaignId} />
            ))}
          </div>
        </>
      )}
      {area === "members" && <AccountManager campaignId={campaignId} initialAccounts={contas} characters={personagens} />}
      {area === "sessions" && (
        <div className="panel mt-6 rounded-lg p-5">
          <span className="tag">
            <Radio size={12} /> EM ANDAMENTO
          </span>
          <h2 className="mt-4 text-xl font-extrabold">{liveSession.title}</h2>
          <a
            className="btn btn-primary mt-4"
            href={`/master/campaigns/${campaignId}/sessions/${liveSession.id}`}
          >
            Abrir painel
          </a>
        </div>
      )}
      {area === "encounters" && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {threats.map((threat) => (
            <article className="panel rounded-lg p-5" key={threat.name}>
              <div className="flex justify-between">
                <Swords className="text-[#d54a56]" />
                <span className="tag">VD {threat.vd}</span>
              </div>
              <h2 className="mt-4 font-extrabold">{threat.name}</h2>
              <p className="mt-2 text-xs text-[#858890]">
                DEF {threat.defense} · PV {threat.pv} · {threat.state}
              </p>
            </article>
          ))}
        </div>
      )}
      {area === "messages" && (
        <div className="mt-6 space-y-4">
          <MessagingStudio campaignId={campaignId} initialSenders={remetentes} accounts={contas} />
          <section className="grid gap-3 md:grid-cols-2">
            {messages.map((message) => (
              <article className="panel rounded-lg p-4" key={message.id}>
                <p className="eyebrow">
                  {message.sender} → {message.recipient}
                </p>
                <p className="mt-2 text-sm">{message.body}</p>
                <span className="tag mt-3">{message.status}</span>
              </article>
            ))}
          </section>
        </div>
      )}
      {area === "handouts" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            "Medalha dos Oito Segundos",
            "Arquivo Branco de Thompson",
            "Agulha da Marca Ausente",
            "Espelho Imóvel",
            "Gravador das Vozes Recortadas",
            "Lente do Favorito",
            "Sentença Unânime",
          ].map((name) => (
            <article className="panel rounded-lg p-5" key={name}>
              <LockKeyhole className="text-[#cd4652]" />
              <h2 className="mt-5 font-extrabold">{name}</h2>
              <p className="mt-2 text-xs text-[#7e8188]">
                Somente mestres · revelação parcial disponível
              </p>
            </article>
          ))}
        </div>
      )}
      {area === "rules" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="panel rounded-lg p-5">
            <Shield className="text-[#d84b57]" />
            <h2 className="mt-4 font-extrabold">zona7_convergencia</h2>
            <p className="mt-2 text-sm leading-6 text-[#8f9299]">
              PV, PE, SAN, NEX, Pressão 0–7 e fail-forward configurável.
            </p>
          </section>
          <section className="panel rounded-lg p-5">
            <Archive className="text-[#999ca3]" />
            <h2 className="mt-4 font-extrabold">zona7_classic</h2>
            <p className="mt-2 text-sm leading-6 text-[#8f9299]">
              10 HP, 20 SAN, morte e absorção pela Zona configuradas.
            </p>
          </section>
        </div>
      )}
      {area === "audit" && (
        <div className="panel mt-6 rounded-lg p-5">
          <ol className="space-y-5">
            {[
              "Sessão iniciada",
              "Mensagem privada agendada",
              "Percepção DT 15 solicitada",
              "Estado Filmado aplicado",
              "Pressão alterada de 2 para 3",
            ].map((event, index) => (
              <li className="flex gap-3" key={event}>
                <CheckCircle2 className="shrink-0 text-[#5ebf89]" size={17} />
                <div>
                  <p className="text-sm font-bold">{event}</p>
                  <p className="mt-1 font-mono text-[0.65rem] text-[#696c73]">
                    {String(index + 1).padStart(4, "0")} · EVENTO IMUTÁVEL · DESFAZER CRIA
                    COMPENSAÇÃO
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
      {area === "settings" && personalizacao && (
        <CustomizationManager campaignId={campaignId} initial={personalizacao} />
      )}
      {area === "actors" && cena && <ActorManager campaignId={campaignId} initialActors={atores} sceneId={cena.id} sceneName={cena.nome} />}
      {area === "maps" && cena && <MapStudio campaignId={campaignId} initialScene={cena} />}
      {area === "scripts" && <ScriptStudio campaignId={campaignId} initialScripts={roteiros} />}
    </div>
  );
}
