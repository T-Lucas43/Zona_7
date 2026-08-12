import { redirect } from "next/navigation";
import { TerminalShell } from "@/components/layout/terminal-shell";
import { requireUser, roleCanAccess } from "@/lib/auth/session";
import { getAuthorizedNotifications } from "@/server/repositories/character-repository";

export const dynamic = "force-dynamic";

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser("/master", "master");
  if (!roleCanAccess(user.role, "master")) redirect("/app");
  const notifications = await getAuthorizedNotifications();
  return (
    <TerminalShell user={user} area="master" notifications={notifications}>
      {children}
    </TerminalShell>
  );
}
