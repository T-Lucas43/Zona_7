import Image from "next/image";
import {
  Archive,
  CheckCircle2,
  EyeOff,
  LockKeyhole,
  MessageSquare,
  Package,
  Sparkles,
} from "lucide-react";
import { AbilityDetails } from "@/components/character/ability-details";
import { AbilityRequestButton } from "@/components/player/ability-request-button";
import { InventoryActions } from "@/components/player/inventory-actions";
import { InvestigationBoard } from "@/components/master/investigation-board";
import { LiveSync } from "@/components/live-sync";
import { NotificationCenter } from "@/components/player/notification-center";
import { isCharacterSectionVisible } from "@/lib/character-visibility";
import {
  getAuthorizedCharacter,
  getAuthorizedHandouts,
  getAuthorizedMessages,
  getCharacterActions,
  getCharacterAbilities,
  getCharacterInventory,
  getCharacterSkills,
  getCharacterWeaknesses,
  getAuthorizedNotifications,
  getAuthorizedInvestigationBoard,
  getSessionAbilityRequests,
} from "@/server/repositories/character-repository";
import {
  demoCampaignId,
  getCurrentSession,
  getSessionCast,
} from "@/server/repositories/session-repository";

export default async function CharacterSectionPage({
  params,
}: {
  params: Promise<{ characterId: string; section: string }>;
}) {
  const { characterId, section } = await params;
  const character = await getAuthorizedCharacter(characterId);
  if (!character) {
    return (
      <section className="panel rounded-xl p-6">
        <h1 className="text-2xl font-black">Acesso negado</h1>
        <p className="mt-2 text-sm text-[#91949b]">Esta ficha não pertence à sua conta.</p>
      </section>
    );
  }
  if (!isCharacterSectionVisible(character, section)) {
    return (
      <section className="panel rounded-xl p-6">
        <EyeOff className="text-[#d27a84]" />
        <h1 className="mt-4 text-2xl font-black">Conteúdo ainda não disponibilizado</h1>
        <p className="mt-2 text-sm text-[#91949b]">
          O mestre ainda não liberou esta parte da ficha para a sua conta.
        </p>
      </section>
    );
  }
  const campaignId = character.campaignId ?? demoCampaignId;
  const session = await getCurrentSession(campaignId);
  const [cast, notifications, abilityRequests] = await Promise.all([
    section === "inventory" && session
      ? getSessionCast(character.campaignId, session.id)
      : Promise.resolve([]),
    section === "messages" ? getAuthorizedNotifications() : Promise.resolve([]),
    section === "abilities" && session
      ? getSessionAbilityRequests(session.id)
      : Promise.resolve([]),
  ]);
  const donationTargets = cast.flatMap((member) =>
    member.characterId && member.characterId !== character.id
      ? [{ id: member.characterId, name: member.name }]
      : [],
  );
  const [abilities, inventory, messages, handouts, skills, actions, weaknesses] = await Promise.all(
    [
      section === "abilities" ? getCharacterAbilities(character.id) : Promise.resolve([]),
      section === "inventory" ? getCharacterInventory(character.id) : Promise.resolve([]),
      section === "messages" ? getAuthorizedMessages() : Promise.resolve([]),
      section === "handouts" ? getAuthorizedHandouts() : Promise.resolve([]),
      section === "skills" ? getCharacterSkills(character.id) : Promise.resolve([]),
      section === "combat" ? getCharacterActions(character.id) : Promise.resolve([]),
      section === "weaknesses" ? getCharacterWeaknesses(character.id) : Promise.resolve([]),
    ],
  );
  const title =
    {
      abilities: "Habilidades",
      weaknesses: "Fraquezas conhecidas",
      inventory: "Inventário",
      messages: "Mensagens",
      handouts: "Pistas e documentos",
      history: "Histórico auditável",
      skills: "Perícias",
      combat: "Combate e ações",
    }[section] ?? "Anotações";
  return (
    <div>
      <p className="eyebrow">
        {character.name}
        {" // acesso do proprietário"}
      </p>
      <h1 className="mt-1 text-3xl font-black">{title}</h1>
      {section === "abilities" && (
        <div className="mt-6 space-y-5">
          <div className="grid gap-4 md:grid-cols-2">
            {abilities.map((ability) => (
              <article
                key={ability.id}
                className={`panel rounded-lg p-5 ${ability.state === "sealed" ? "opacity-65" : ""}`}
              >
                <div className="flex items-center justify-between">
                  <span className="tag">{ability.actionType}</span>
                  {ability.state === "sealed" ? (
                    <LockKeyhole size={16} />
                  ) : (
                    <Sparkles size={16} className="text-[#d84c58]" />
                  )}
                </div>
                <AbilityDetails ability={ability} />
                <h2 className="mt-4 text-lg font-extrabold">
                  {ability.state === "sealed" ? "█ ████ ███████" : ability.name}
                </h2>
                <div className="mt-3 rounded border border-[#30333a] bg-black/25 p-3">
                  <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#d27882]">
                    Informações da habilidade
                  </span>
                  <p className="mt-2 text-sm leading-6 text-[#91949b]">
                    {ability.state === "sealed"
                      ? "A cicatriz ainda não despertou."
                      : ability.description}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  {Object.entries(ability.costs).map(([key, value]) => (
                    <span className="tag" key={key}>
                      {value} {key.toUpperCase()}
                    </span>
                  ))}
                  {ability.limit && <span className="tag">{ability.limit}</span>}
                </div>
                {ability.state === "unlocked" &&
                  session &&
                  !["dying", "dead"].includes(character.characterState ?? "") && (
                    <AbilityRequestButton
                      campaignId={campaignId}
                      sessionId={session.id}
                      characterId={character.id}
                      abilityId={ability.id}
                      pendingRequest={(() => {
                        const request = abilityRequests.find(
                          (item) => item.characterAbilityId === ability.id,
                        );
                        return request
                          ? { id: request.id, decision: request.decision, rolled: request.rolled }
                          : undefined;
                      })()}
                    />
                  )}
              </article>
            ))}
          </div>
        </div>
      )}
      {section === "weaknesses" && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {weaknesses.map((weakness) => (
            <article
              className="rounded-lg border border-[#663039] bg-[#6f1722]/10 p-4"
              key={weakness.id}
            >
              <div className="flex justify-between gap-2">
                <strong>{weakness.name}</strong>
                {weakness.active && <span className="tag">Ativa</span>}
              </div>
              <div className="mt-3 rounded border border-[#663039] bg-black/20 p-3">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#d27882]">
                  Informações
                </span>
                <p className="mt-2 text-sm text-[#a4a6ac]">{weakness.effect}</p>
              </div>
            </article>
          ))}
        </div>
      )}
      {section === "skills" && (
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <article className="panel rounded-lg p-4" key={skill.id}>
              <div className="flex justify-between">
                <strong>{skill.name}</strong>
                <span className="tag">+{skill.bonus}</span>
              </div>
              <p className="mt-2 text-xs text-[#777a82]">
                {skill.attribute} · {skill.training}
              </p>
              <div className="mt-3 rounded border border-[#30333a] bg-black/20 p-3">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#d27882]">
                  Informações
                </span>
                <p className="mt-2 text-xs leading-5 text-[#92959c]">
                  {skill.notes?.trim() || "Nenhuma informação adicional disponibilizada."}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
      {section === "combat" && (
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          {actions.map((action) => (
            <article className="panel rounded-lg p-5" key={action.id}>
              <div className="flex justify-between gap-3">
                <strong>{action.name}</strong>
                <span className="tag">{action.type}</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <p>
                  <span className="block text-xs text-[#777a82]">Teste</span>
                  <code>{action.test}</code>
                </p>
                <p>
                  <span className="block text-xs text-[#777a82]">Dano ou efeito</span>
                  <code>{action.damage}</code>
                </p>
              </div>
              <p className="mt-3 text-xs text-[#8f9299]">Alcance: {action.range}</p>
              <div className="mt-3 rounded border border-[#30333a] bg-black/20 p-3">
                <span className="text-[0.65rem] font-bold uppercase tracking-wide text-[#d27882]">
                  Informações
                </span>
                <p className="mt-2 text-xs leading-5 text-[#92959c]">
                  {action.description?.trim() || "Nenhuma informação adicional disponibilizada."}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}
      {section === "inventory" && (
        <div className="mt-6 space-y-3">
          {inventory.map(({ id, name, detail, description, state, imageUrl }) => (
            <article className="panel flex items-center gap-4 rounded-lg p-4" key={id}>
              {imageUrl ? (
                <Image
                  className="size-16 rounded-xl object-cover"
                  src={imageUrl}
                  alt={`Imagem de ${name}`}
                  width={64}
                  height={64}
                />
              ) : (
                <Package className="text-[#c84854]" />
              )}
              <div className="flex-1">
                <h2 className="font-extrabold">{name}</h2>
                <p className="mt-1 text-xs text-[#83868e]">{detail}</p>
                {description && <p className="mt-2 text-xs text-[#a5a7ad]">{description}</p>}
                {!["dying", "dead"].includes(character.characterState ?? "") && (
                  <InventoryActions characterItemId={id} targets={donationTargets} />
                )}
              </div>
              <span className="tag">{state}</span>
            </article>
          ))}
        </div>
      )}
      {section === "messages" && (
        <div className="mt-6 space-y-3">
          <NotificationCenter initial={notifications} authorizedCharacterIds={[character.id]} />
          {messages.map((message) => (
            <article className="panel rounded-lg p-5" key={message.id}>
              <div className="flex items-center gap-2 text-xs font-bold text-[#dd5965]">
                <MessageSquare size={14} /> {message.sender}
              </div>
              <p className="mt-3 text-sm leading-6">{message.body}</p>
              <p className="mt-3 font-mono text-[0.65rem] text-[#666971]">
                {message.status.toUpperCase()}
                {" // CONTEÚDO PROTEGIDO"}
              </p>
            </article>
          ))}
        </div>
      )}
      {section === "handouts" && (
        <div>
          <LiveSync campaignId={character.campaignId ?? "11111111-1111-4111-8111-111111111111"} />
          <PlayerInvestigationBoard />
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {handouts.map((item) => (
              <article className="panel rounded-lg p-5" key={item.id}>
                {item.locked ? (
                  <LockKeyhole className="text-[#777a81]" />
                ) : (
                  <Archive className="text-[#cf4551]" />
                )}
                <h2 className="mt-5 font-extrabold">
                  {item.locked ? "ARQUIVO BLOQUEADO" : item.title}
                </h2>
                <p className="mt-2 text-xs text-[#858891]">
                  {item.locked ? "Acesso exclusivo do mestre." : item.excerpt}
                </p>
                {!item.locked && item.content && (
                  <p className="mt-3 rounded border border-[#30333a] bg-black/20 p-3 text-sm leading-6">
                    {item.content}
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>
      )}
      {section === "history" && (
        <div className="panel mt-6 rounded-lg p-5">
          <div className="flex items-center gap-3 text-sm">
            <CheckCircle2 size={17} className="text-[#5ebf89]" />
            <p>Nenhum evento público foi disponibilizado pelo mestre.</p>
          </div>
        </div>
      )}
    </div>
  );
}

async function PlayerInvestigationBoard() {
  const board = await getAuthorizedInvestigationBoard();
  return (
    <InvestigationBoard
      readOnly
      initialItems={board.items}
      initialConnections={board.connections}
    />
  );
}
