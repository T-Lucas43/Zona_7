import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  MessageSquare,
  Radio,
  ScrollText,
  Settings,
  Users,
} from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { ResourceConsole } from "@/components/master/resource-console";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { campaign, liveSession } from "@/lib/demo-data";
import { getCampaignCharacters } from "@/server/repositories/character-repository";

export default async function MasterCampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const characters = await getCampaignCharacters(campaignId);
  const actions = [
    ["members", "Membros", Users],
    ["sessions", "Sessões", CalendarDays],
    ["messages", "Mensagens", MessageSquare],
    ["audit", "Auditoria", ScrollText],
    ["settings", "Configurar", Settings],
  ] as const;
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">campanha // convergência</p>
          <h1 className="mt-1 text-3xl font-black">{campaign.name}</h1>
        </div>
        <RealtimeIndicator channel={`campaign:${campaignId}`} />
      </div>
      <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
        {actions.map(([slug, label, Icon]) => (
          <Link
            className="btn shrink-0"
            href={`/master/campaigns/${campaignId}/${slug}`}
            key={slug}
          >
            <Icon size={15} /> {label}
          </Link>
        ))}
      </div>
      <section className="mt-5 grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel rounded-xl border-[#59232b] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="tag border-[#66313a] text-[#ed8f99]">
              <Radio size={12} /> SESSÃO EM ANDAMENTO
            </span>
            <span className="font-mono text-xs">PRESSÃO {liveSession.pressure}/7</span>
          </div>
          <h2 className="mt-5 text-2xl font-black">{liveSession.scene}</h2>
          <p className="mt-2 text-sm text-[#92959c]">
            Rodada {liveSession.round} · turno de {liveSession.currentTurn}
          </p>
          <Link
            className="btn btn-primary mt-5"
            href={`/master/campaigns/${campaignId}/sessions/${liveSession.id}`}
          >
            Abrir painel ao vivo <ArrowRight size={15} />
          </Link>
        </div>
        <ResourceConsole initialCharacters={characters} />
      </section>
      <div className="mb-3 mt-7 flex items-center justify-between">
        <h2 className="font-extrabold">Personagens monitorados</h2>
        <Link
          className="text-xs text-[#dc5a66]"
          href={`/master/campaigns/${campaignId}/characters`}
        >
          Gerenciar fichas
        </Link>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {characters.map((character) => (
          <CharacterCard key={character.id} character={character} master campaignId={campaignId} />
        ))}
      </div>
    </div>
  );
}
