import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { LiveSync } from "@/components/live-sync";
import { NotificationCenter } from "@/components/player/notification-center";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { liveSession } from "@/lib/demo-data";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthorizedCharacters, getAuthorizedNotifications } from "@/server/repositories/character-repository";

export default async function PlayerHomePage() {
  const [characters, notifications, user] = await Promise.all([
    getAuthorizedCharacters(),
    getAuthorizedNotifications(),
    getCurrentUser("player"),
  ]);
  const character = characters[0];
  if (!character) {
    return (
      <section className="panel rounded-xl p-6">
        <h1 className="text-2xl font-black">Nenhuma ficha vinculada</h1>
        <p className="mt-2 text-sm text-[#91949b]">
          Aceite um convite ou peça ao mestre para confirmar o vínculo.
        </p>
      </section>
    );
  }
  return (
    <div>
      <LiveSync />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">campanha ativa</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">
            Boa noite, {user?.displayName ?? character.name}.
          </h1>
          <p className="mt-2 text-sm text-[#8e9198]">Há um sinal esperando na sala ao vivo.</p>
        </div>
        <RealtimeIndicator channel={`character:${character.id}`} />
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel critical-pulse rounded-xl border-[#592129] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <span className="tag border-[#69303a] text-[#ed8f99]">
              <Radio size={12} /> TRANSMISSÃO AO VIVO
            </span>
            <span className="font-mono text-xs text-[#8f929a]">
              PRESSÃO {liveSession.pressure}/7
            </span>
          </div>
          <h2 className="mt-5 text-2xl font-black">{liveSession.title}</h2>
          <p className="mt-2 text-sm text-[#a2a5ac]">Cena atual: {liveSession.scene}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/app/session/${liveSession.id}`} className="btn btn-primary">
              Entrar na sala <ArrowRight size={16} />
            </Link>
            <span className="tag">
              <span className="status-dot" /> {liveSession.connected} conectados
            </span>
          </div>
        </div>
        <div className="panel rounded-xl p-5">
          <p className="eyebrow">próxima instrução</p>
          <h2 className="mt-2 text-lg font-extrabold">Teste solicitado</h2>
          <p className="mt-3 text-sm leading-6 text-[#a3a6ad]">
            Percepção DT 15 · Observe a câmera sem encarar o reflexo.
          </p>
          <button type="button" className="btn mt-5 w-full">
            Rolar 1d20+5
          </button>
        </div>
      </section>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1fr_0.6fr]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-extrabold">Sua ficha</h2>
            <Link className="text-xs text-[#d85d68]" href={`/app/characters/${character.id}`}>
              Ver completa
            </Link>
          </div>
          <CharacterCard character={character} />
        </div>
        <NotificationCenter initial={notifications} authorizedCharacterIds={characters.map((item) => item.id)} />
      </section>
    </div>
  );
}
