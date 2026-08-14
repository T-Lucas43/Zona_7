import { redirect } from "next/navigation";
import { TerminalShell } from "@/components/layout/terminal-shell";
import { SessionPresence } from "@/components/player/session-presence";
import { LiveNotificationOverlay } from "@/components/player/live-notification-overlay";
import { CheckRequestPopup } from "@/components/player/check-request-popup";
import { LiveSync } from "@/components/live-sync";
import { requireUser, roleCanAccess } from "@/lib/auth/session";
import { getCharacterSheetVisibility } from "@/lib/character-visibility";
import {
  getAuthorizedCharacters,
  getAuthorizedNotifications,
  getSessionCheckRequests,
} from "@/server/repositories/character-repository";
import { getCurrentSession } from "@/server/repositories/session-repository";

export const dynamic = "force-dynamic";
const demoCampaignId = "11111111-1111-4111-8111-111111111111";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app", "player");
  if (!roleCanAccess(user.role, "player")) redirect("/login");
  const [authorizedCharacters, notifications] = await Promise.all([getAuthorizedCharacters(), getAuthorizedNotifications()]);
  const character = authorizedCharacters[0];
  const campaignId = character?.campaignId ?? demoCampaignId;
  const session = character ? await getCurrentSession(campaignId) : null;
  const checkRequests = session ? await getSessionCheckRequests(session.id) : [];
  return (
    <TerminalShell
      user={user}
      area="player"
      playerNavigation={character ? { characterId: character.id, visibleSections: getCharacterSheetVisibility(character).sections, sessionId: session?.id } : undefined}
      notifications={notifications}
    >
      {character && session && (
        <SessionPresence
          campaignId={campaignId}
          sessionId={session.id}
          characterId={character.id}
        />
      )}
      <LiveSync campaignId={campaignId} />
      <LiveNotificationOverlay notifications={notifications} />
      <CheckRequestPopup
        requests={checkRequests.filter((request) => request.characterId === character?.id)}
      />
      {children}
    </TerminalShell>
  );
}
