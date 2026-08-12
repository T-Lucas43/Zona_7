import Link from "next/link";
import { ArrowRight, Radio } from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { DiceRoller } from "@/components/dice/dice-roller";
import { LiveSync } from "@/components/live-sync";
import { NotificationCenter } from "@/components/player/notification-center";
import { PwaInstallCard } from "@/components/player/pwa-install-card";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { getCurrentUser } from "@/lib/auth/session";
import { getAuthorizedCharacters, getAuthorizedNotifications } from "@/server/repositories/character-repository";
import { getCurrentSession } from "@/server/repositories/session-repository";

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
  const session = await getCurrentSession(character.campaignId);
  return (
    <div>
      <LiveSync campaignId={character.campaignId} />
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">campanha ativa</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">
            Boa noite, {user?.displayName ?? character.name}.
          </h1>
          <p className="mt-2 text-sm text-[#8e9198]">
            Acompanhe sua ficha, notificações e a sessão atual.
          </p>
        </div>
        <RealtimeIndicator channel={`character:${character.id}`} />
      </div>
      <section className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="panel critical-pulse rounded-xl border-[#592129] p-5 sm:p-6">
          {session ? (
            <>
              <div className="flex items-center justify-between">
                <span className="tag border-[#69303a] text-[#ed8f99]">
                  <Radio size={12} /> {session.status.toUpperCase()}
                </span>
                <span className="font-mono text-xs text-[#8f929a]">
                  PRESSÃO {session.pressure}/7
                </span>
              </div>
              <h2 className="mt-5 text-2xl font-black">{session.title}</h2>
              <p className="mt-2 text-sm text-[#a2a5ac]">Cena atual: {session.scene}</p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href={`/app/session/${session.id}`} className="btn btn-primary">
                  Entrar na sala <ArrowRight size={16} />
                </Link>
                <span className="tag">
                  <span className="status-dot" /> {session.connected} conectados
                </span>
              </div>
            </>
          ) : (
            <>
              <span className="tag">SEM SESSÃO ATIVA</span>
              <h2 className="mt-5 text-xl font-black">A sala ainda não foi aberta</h2>
              <p className="mt-2 text-sm text-[#a2a5ac]">
                O mestre ainda não disponibilizou uma sessão para esta campanha.
              </p>
            </>
          )}
        </div>
        <DiceRoller compact />
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
      <div className="mt-6"><PwaInstallCard /></div>
    </div>
  );
}
