"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Archive,
  ArrowLeft,
  BadgeHelp,
  BookOpen,
  Boxes,
  PackageSearch,
  CircleUserRound,
  Dices,
  Gauge,
  Home,
  LogOut,
  Mail,
  Map,
  Menu,
  MessageSquare,
  MoreHorizontal,
  NotebookPen,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Search,
  ScrollText,
  Settings,
  Sparkles,
  Swords,
  UserRoundCog,
  Users,
  Waypoints,
  X,
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
    [`/master/campaigns/${campaignId}/notebooks`, "Cadernos dos jogadores", NotebookPen],
    [`/master/campaigns/${campaignId}/items`, "Itens da sessão", PackageSearch],
    [`/master/campaigns/${campaignId}/maps`, "Mapas e tokens", Map],
    [`/master/campaigns/${campaignId}/actors`, "Entidades e NPCs", Sparkles],
    [`/master/campaigns/${campaignId}/scripts`, "Roteiros", Waypoints],
    [`/master/help?campaignId=${campaignId}`, "Regras e ajuda", BadgeHelp],
    [`/master/campaigns/${campaignId}/audit`, "Auditoria", ScrollText],
    [`/master/campaigns/${campaignId}/settings`, "Configurações", Settings],
  ] as const;

const getPlayerLinks = (characterId: string, visibleSections: string[], sessionId?: string) =>
  (
    [
      ["/app", "Início", Home],
      [`/app/characters/${characterId}`, "Minha ficha", CircleUserRound],
      [`/app/characters/${characterId}/inventory`, "Inventário", Boxes],
      [`/app/characters/${characterId}/abilities`, "Habilidades", Gauge],
      [`/app/characters/${characterId}/messages`, "Mensagens", Mail],
      [`/app/characters/${characterId}/handouts`, "Pistas", BookOpen],
      [`/app/characters/${characterId}/notebook`, "Livro de anotações", NotebookPen],
      ["/app/help", "Ajuda e regras", BadgeHelp],
      ...(sessionId ? [[`/app/session/${sessionId}`, "Sala ao vivo", Dices] as const] : []),
    ] as const
  ).filter(([href]) => {
    const section = href.match(/\/characters\/[^/]+\/([^/]+)/)?.[1];
    return !section || section === "notebook" || visibleSections.includes(section);
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
  const router = useRouter();
  const sessionWorkspace = area === "master" && pathname.includes("/sessions");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(sessionWorkspace);
  const campaignId = pathname.match(/\/master\/campaigns\/([^/]+)/)?.[1] ?? defaultCampaignId;
  const characterId =
    playerNavigation?.characterId ?? pathname.match(/\/app\/characters\/([^/]+)/)?.[1] ?? "davi";
  const links =
    area === "master"
      ? getMasterLinks(campaignId)
      : getPlayerLinks(
          characterId,
          playerNavigation?.visibleSections ?? [],
          playerNavigation?.sessionId,
        );
  const isActive = (href: string) => {
    if (href === "/master" || href === "/app") return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  };
  const activeLabel =
    links.find(([href]) => isActive(href))?.[1] ??
    (area === "master" ? "Visão geral" : "Início");
  const playerSheetHref = `/app/characters/${characterId}`;
  const playerMessagesHref = `${playerSheetHref}/messages`;
  const playerSessionHref = playerNavigation?.sessionId
    ? `/app/session/${playerNavigation.sessionId}`
    : "/app";
  const canGoBack = pathname !== "/master" && pathname !== "/app";
  function openCommandPalette() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
  }
  return (
    <div
      className="app-frame terminal-grid"
      data-session-workspace={sessionWorkspace}
      data-sidebar-collapsed={sidebarCollapsed}
    >
      <aside className="app-sidebar" aria-label="Navegação principal">
        <div className="sidebar-brand-row">
          <Brand compact={sidebarCollapsed} />
          <button
            className="sidebar-collapse"
            type="button"
            onClick={() => setSidebarCollapsed((value) => !value)}
            aria-label={sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
            title={sidebarCollapsed ? "Expandir barra lateral" : "Recolher barra lateral"}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
        </div>
        <nav className="sidebar-nav">
          {links.map(([href, label, Icon]) => (
            <Link
              href={href}
              key={href}
              className="sidebar-link"
              data-active={isActive(href)}
              aria-current={isActive(href) ? "page" : undefined}
            >
              <Icon size={17} aria-hidden="true" />{" "}
              <span className="sidebar-link-label">{label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-footer mt-auto border-t border-[#292c32] pt-4">
          <div className="sidebar-account flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded bg-[#7d1a25]/30 text-xs font-black text-[#ef9da5]">
              {user.displayName.slice(0, 2).toUpperCase()}
            </span>
            <span className="sidebar-account-copy min-w-0 flex-1">
              <span className="block truncate text-xs font-extrabold">{user.displayName}</span>
              <span className="block truncate text-[0.65rem] text-[#777a82]">
                {user.demo ? "modo demonstração" : user.email}
              </span>
            </span>
          </div>
          <form action={signOutAction} className="mt-3">
            <button
              type="submit"
              className="btn btn-ghost sidebar-signout w-full justify-start text-xs"
            >
              <LogOut size={15} />
              <span>Encerrar terminal</span>
            </button>
          </form>
          {area === "player" && <PwaInstallCard compact />}
        </div>
      </aside>
      <main id="conteudo" className="app-main">
        <header className="app-topbar">
          <div className="app-topbar-context">
            {canGoBack && (
              <button
                className="mobile-back-button"
                type="button"
                onClick={() => router.back()}
                aria-label="Voltar para a tela anterior"
              >
                <ArrowLeft size={18} />
              </button>
            )}
            {area === "player" && <Brand compact />}
            <div className="app-topbar-breadcrumb">
              <span>{area === "master" ? "Zona 7 / A Convergência" : "Terminal seguro"}</span>
              <strong>{activeLabel}</strong>
            </div>
          </div>
          {area === "master" && (
            <button className="topbar-command-search" type="button" onClick={openCommandPalette}>
              <Search size={16} />
              <span>Buscar comando, personagem ou regra...</span>
              <kbd>Ctrl K</kbd>
            </button>
          )}
          {area === "player" && (
            <div className="player-channel-state" aria-label="Canal conectado">
              <span className="status-dot" /> conectado
            </div>
          )}
          <div className="app-topbar-actions flex items-center gap-2">
            <span className="tag desktop-channel-status">
              <span className="status-dot" /> Canal seguro
            </span>
            <NotificationBell initial={notifications} userId={user.id} />
            <UserProfileMenu user={user} showInstall={area === "player"} />
            <button
              className="mobile-menu-trigger"
              type="button"
              aria-label={mobileMenuOpen ? "Fechar menu de navegação" : "Abrir menu de navegação"}
              aria-controls="menu-navegacao-mobile"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen((open) => !open)}
            >
              {mobileMenuOpen ? <X size={19} /> : <Menu size={20} />}
            </button>
          </div>
        </header>
        {children}
      </main>
      {area === "player" && (
        <nav className="player-bottom-nav" aria-label="Atalhos principais do jogador">
          <Link href="/app" data-active={isActive("/app")}>
            <Home size={19} /><span>Início</span>
          </Link>
          <Link href={playerSheetHref} data-active={isActive(playerSheetHref)}>
            <CircleUserRound size={19} /><span>Ficha</span>
          </Link>
          <Link href={playerSessionHref} data-active={isActive(playerSessionHref)}>
            <Radio size={19} /><span>Sala</span>
          </Link>
          <Link href={playerMessagesHref} data-active={isActive(playerMessagesHref)}>
            <MessageSquare size={19} /><span>Mensagens</span>
          </Link>
          <button type="button" onClick={() => setMobileMenuOpen(true)} aria-expanded={mobileMenuOpen}>
            <MoreHorizontal size={20} /><span>Mais</span>
          </button>
        </nav>
      )}
      {mobileMenuOpen && (
        <>
          <button
            className="mobile-menu-backdrop"
            type="button"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside
            id="menu-navegacao-mobile"
            className="mobile-menu-panel"
            role="dialog"
            aria-modal="true"
            aria-label={area === "master" ? "Menu do mestre" : "Menu do jogador"}
          >
            <div className="mobile-menu-heading">
              <div>
                <p className="eyebrow">
                  {area === "master" ? "console do mestre" : "terminal do sobrevivente"}
                </p>
                <h2>{area === "master" ? "Todas as telas" : "Menu do jogador"}</h2>
              </div>
              <button
                className="btn px-3"
                type="button"
                aria-label="Fechar menu de navegação"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={17} />
              </button>
            </div>
            <nav className="mobile-menu-links" aria-label="Navegação móvel">
              {links.map(([href, label, Icon]) => (
                <Link
                  href={href}
                  key={href}
                  data-active={isActive(href)}
                  aria-current={isActive(href) ? "page" : undefined}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="mobile-menu-link-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span>{label}</span>
                  {isActive(href) && <span className="mobile-menu-current">atual</span>}
                </Link>
              ))}
            </nav>
            <div className="mobile-menu-footer">
              <span>
                <span className="status-dot" /> Canal seguro
              </span>
              <span>Belém · UTC−3</span>
            </div>
          </aside>
        </>
      )}
      <CommandPalette enabled={area === "master"} />
    </div>
  );
}
