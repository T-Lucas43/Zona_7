"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  BookOpen,
  Boxes,
  PackageSearch,
  CircleUserRound,
  Dices,
  Gauge,
  Home,
  Mail,
  Map,
  MessageSquare,
  Radio,
  ScrollText,
  Settings,
  Sparkles,
  Swords,
  UserRoundCog,
  Users,
  Waypoints,
} from "lucide-react";
import { Brand } from "@/components/brand";
import { CommandPalette } from "@/components/master/command-palette";
import { PwaInstallCard } from "@/components/player/pwa-install-card";
import { NotificationBell } from "@/components/player/notification-bell";
import { UserProfileMenu } from "@/components/layout/user-profile-menu";
import { signOutAction } from "@/server/actions/auth";
import type { AuthenticatedUser } from "@/types/domain";
import type { PlayerNotification } from "@/server/repositories/character-repository";

const defaultCampaignId = "11111111-1111-4111-8111-111111111111";

const getMasterLinks = (campaignId: string) =>
  [
    ["/master", "Campanhas", Home],
    [`/master/campaigns/${campaignId}/sessions`, "Central da sessão", Radio],
    [`/master/campaigns/${campaignId}/members`, "Membros e usuários", UserRoundCog],
    [`/master/campaigns/${campaignId}/characters`, "Personagens", Users],
    [`/master/campaigns/${campaignId}/encounters`, "Encontros", Swords],
    [`/master/campaigns/${campaignId}/messages`, "Mensagens", MessageSquare],
    [`/master/campaigns/${campaignId}/handouts`, "Pistas", Archive],
    [`/master/campaigns/${campaignId}/items`, "Itens da sessão", PackageSearch],
    [`/master/campaigns/${campaignId}/maps`, "Mapas e tokens", Map],
    [`/master/campaigns/${campaignId}/actors`, "Entidades e NPCs", Sparkles],
    [`/master/campaigns/${campaignId}/scripts`, "Roteiros", Waypoints],
    [`/master/campaigns/${campaignId}/audit`, "Auditoria", ScrollText],
    [`/master/campaigns/${campaignId}/settings`, "Configurações", Settings],
  ] as const;

const getPlayerLinks = (characterId: string, visibleSections: string[], sessionId?: string) =>
  ([
    ["/app", "Início", Home],
    [`/app/characters/${characterId}`, "Minha ficha", CircleUserRound],
    [`/app/characters/${characterId}/inventory`, "Inventário", Boxes],
    [`/app/characters/${characterId}/abilities`, "Habilidades", Gauge],
    [`/app/characters/${characterId}/messages`, "Mensagens", Mail],
    [`/app/characters/${characterId}/handouts`, "Pistas", BookOpen],
    ...(sessionId ? [[`/app/session/${sessionId}`, "Sala ao vivo", Dices] as const] : []),
  ] as const).filter(([href]) => {
    const section = href.match(/\/characters\/[^/]+\/([^/]+)/)?.[1];
    return !section || visibleSections.includes(section);
  });

export function TerminalShell({
  user,
  area,
  children,
  playerNavigation,
  notifications = [],
}: {
  user: AuthenticatedUser;
  area: "master" | "player";
  children: React.ReactNode;
  playerNavigation?: { characterId: string; visibleSections: string[]; sessionId?: string };
  notifications?: PlayerNotification[];
}) {
  const pathname = usePathname();
  const campaignId = pathname.match(/\/master\/campaigns\/([^/]+)/)?.[1] ?? defaultCampaignId;
  const characterId = playerNavigation?.characterId ?? pathname.match(/\/app\/characters\/([^/]+)/)?.[1] ?? "davi";
  const links = area === "master" ? getMasterLinks(campaignId) : getPlayerLinks(characterId, playerNavigation?.visibleSections ?? [], playerNavigation?.sessionId);
  const mobileLinks = area === "master" ? links.slice(0, 5) : links.slice(1, 6);
  const isActive = (href: string) => {
    if (href === "/master" || href === "/app") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  return (
    <div className="app-frame terminal-grid">
      <aside className="app-sidebar" aria-label="Navegação principal">
        <Brand />
        <nav className="sidebar-nav">
          {links.map(([href, label, Icon]) => (
            <Link href={href} key={href} className="sidebar-link" data-active={isActive(href)} aria-current={isActive(href) ? "page" : undefined}>
              <Icon size={17} aria-hidden="true" /> {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto border-t border-[#292c32] pt-4">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded bg-[#7d1a25]/30 text-xs font-black text-[#ef9da5]">
              {user.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-extrabold">{user.displayName}</span>
              <span className="block truncate text-[0.65rem] text-[#777a82]">
                {user.demo ? "modo demonstração" : user.email}
              </span>
            </span>
          </div>
          <form action={signOutAction} className="mt-3">
            <button type="submit" className="btn btn-ghost w-full justify-start text-xs">
              Encerrar terminal
            </button>
          </form>
          {area === "player" && <PwaInstallCard compact />}
        </div>
      </aside>
      <main id="conteudo" className="app-main">
        <header className="app-topbar">
          <div>
            <p className="eyebrow">
              {area === "master" ? "console do mestre" : "terminal do sobrevivente"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell initial={notifications} userId={user.id} />
            <UserProfileMenu user={user} showInstall={area === "player"} />
            <span className="tag">
              <span className="status-dot" /> Canal seguro
            </span>
            <span className="tag hidden sm:inline-flex">Belém · UTC−3</span>
          </div>
        </header>
        {children}
      </main>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {mobileLinks.map(([href, label, Icon]) => (
          <Link href={href} key={href} data-active={isActive(href)} aria-current={isActive(href) ? "page" : undefined}>
            <Icon size={19} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <CommandPalette enabled={area === "master"} />
    </div>
  );
}
