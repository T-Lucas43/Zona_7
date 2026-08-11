import { redirect } from "next/navigation";
import { TerminalShell } from "@/components/layout/terminal-shell";
import { requireUser, roleCanAccess } from "@/lib/auth/session";
import { getCharacterSheetVisibility } from "@/lib/character-visibility";
import { getAuthorizedCharacters } from "@/server/repositories/character-repository";

export const dynamic = "force-dynamic";

export default async function PlayerLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/app", "player");
  if (!roleCanAccess(user.role, "player")) redirect("/login");
  const character = (await getAuthorizedCharacters())[0];
  return (
    <TerminalShell
      user={user}
      area="player"
      playerNavigation={character ? { characterId: character.id, visibleSections: getCharacterSheetVisibility(character).sections } : undefined}
    >
      {children}
    </TerminalShell>
  );
}
