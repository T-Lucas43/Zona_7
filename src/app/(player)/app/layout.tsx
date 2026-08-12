import { redirect } from "next/navigation";
import { TerminalShell } from "@/components/layout/terminal-shell";
import { SessionPresence } from "@/components/player/session-presence";
import { LiveNotificationOverlay } from "@/components/player/live-notification-overlay";
import { requireUser, roleCanAccess } from "@/lib/auth/session";
import { getCharacterSheetVisibility } from "@/lib/character-visibility";
import { getAuthorizedCharacters, getAuthorizedNotifications } from "@/server/repositories/character-repository";
import { getCurrentSession } from "@/server/repositories/session-repository";

export const dynamic = "force-dynamic";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app", "player");
  if (!roleCanAccess(user.role, "player")) redirect("/login");
  const [authorizedCharacters, notifications] = await Promise.all([getAuthorizedCharacters(), getAuthorizedNotifications()]);
  const character = authorizedCharacters[0];
  const session = character?.campaignId ? await getCurrentSession(character.campaignId) : null;
  return (
    <TerminalShell
      user={user}
      area="player"
      playerNavigation={character ? { characterId: character.id, visibleSections: getCharacterSheetVisibility(character).sections, sessionId: session?.id } : undefined}
      notifications={notifications}
    >
      {character?.campaignId && session && (
        <SessionPresence
          campaignId={character.campaignId}
          sessionId={session.id}
          characterId={character.id}
        />
      )}
      <LiveNotificationOverlay notifications={notifications} />
      {children}
    </TerminalShell>
  );
}
