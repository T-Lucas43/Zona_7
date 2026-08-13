import Link from "next/link";
import {
  ArrowRight,
  BookOpen,
  Boxes,
  Dices,
  Gauge,
  MessageSquare,
  Radio,
} from "lucide-react";
import { CharacterCard } from "@/components/character/character-card";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { DiceRoller } from "@/components/dice/dice-roller";
import { LiveSync } from "@/components/live-sync";
import { NotificationCenter } from "@/components/player/notification-center";
import { PwaInstallCard } from "@/components/player/pwa-install-card";
import { RealtimeIndicator } from "@/components/realtime-indicator";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getAuthorizedCharacters,
  getAuthorizedNotifications,
} from "@/server/repositories/character-repository";
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
  const base = `/app/characters/${character.id}`;

  return (
    <div className="player-home">
      <LiveSync campaignId={character.campaignId} />
      <header className="player-home-heading">
        <div>
          <p className="eyebrow">campanha ativa</p>
          <h1>Boa noite, {user?.displayName ?? character.name}.</h1>
          <p>Sua sessão e sua ficha estão sincronizadas.</p>
        </div>
        <RealtimeIndicator channel={`character:${character.id}`} />
      </header>

      <section className="panel player-session-hero">
        <div className="player-session-hero-overlay" />
        <div className="player-session-status">
          <span className="tag"><Radio size={12} /> {session ? session.status.toUpperCase() : "AGUARDANDO"}</span>
          <span><span className="status-dot" /> {session?.connected ?? 0} conectados</span>
        </div>
        <h2>{session?.title ?? "A sala ainda não foi aberta"}</h2>
        {session ? (
          <>
            <div className="player-pressure-summary">
              <span>Pressão {session.pressure}/7</span>
              <div>{Array.from({ length: 7 }, (_, index) => <i key={index} data-active={index < session.pressure} />)}</div>
            </div>
            <p>Cena atual <strong>{session.scene}</strong></p>
            <Link href={`/app/session/${session.id}`} className="btn btn-primary">
              <Radio size={16} /> Entrar na sala ao vivo
            </Link>
          </>
        ) : (
          <p>O mestre ainda não disponibilizou uma sessão para esta campanha.</p>
        )}
      </section>

      <section className="panel player-summary-card">
        <div className="player-summary-identity">
          <CharacterPortrait
            name={character.name}
            portraitUrl={character.portraitUrl}
            className="size-16 rounded-full"
          />
          <div>
            <h2>{character.name}</h2>
            <p>{character.className} · {character.path}</p>
            <span>NEX {character.nex}% · {character.status}</span>
          </div>
          <Link href={base} aria-label="Abrir ficha completa"><ArrowRight size={17} /></Link>
        </div>
        <CharacterCard character={character} />
      </section>

      <nav className="player-quick-grid" aria-label="Ações frequentes">
        <a href="#rolar-dados"><Dices size={21} /><span>Rolar dados</span></a>
        <Link href={base}><BookOpen size={21} /><span>Ver ficha</span></Link>
        <Link href={`${base}/messages`}><MessageSquare size={21} /><span>Mensagens</span></Link>
        <Link href={`${base}/inventory`}><Boxes size={21} /><span>Inventário</span></Link>
        <Link href={`${base}/abilities`}><Gauge size={21} /><span>Habilidades</span></Link>
      </nav>

      <div className="player-home-grid">
        <section id="rolar-dados"><DiceRoller compact /></section>
        <NotificationCenter
          initial={notifications}
          authorizedCharacterIds={characters.map((item) => item.id)}
        />
      </div>
      <PwaInstallCard />
    </div>
  );
}
