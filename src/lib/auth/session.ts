import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import type { AuthenticatedUser, CampaignRole } from "@/types/domain";

const demoProfiles: Record<"master" | "player", AuthenticatedUser> = {
  master: {
    id: "00000000-0000-4000-8000-000000000001",
    email: "mestre@zona7.local",
    displayName: "Mestre da Convergência",
    role: "campaign_owner",
    demo: true,
  },
  player: {
    id: "00000000-0000-4000-8000-000000000002",
    email: "davi@zona7.local",
    displayName: "Davi Brito",
    role: "player",
    demo: true,
  },
};

async function loadCurrentUser(
  preferredDemoRole?: "master" | "player",
): Promise<AuthenticatedUser | null> {
  if (!isSupabaseConfigured) {
    const cookieStore = await cookies();
    const selected = cookieStore.get("z7_demo_role")?.value;
    const role = selected === "player" || selected === "master" ? selected : preferredDemoRole;
    return role ? demoProfiles[role] : null;
  }

  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const userId = claimsData?.claims.sub;
  if (error || !userId) return null;

  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name,platform_admin")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("campaign_members")
      .select("role")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);
  const roleOrder: CampaignRole[] = [
    "campaign_owner",
    "game_master",
    "co_master",
    "player",
    "spectator",
  ];
  const membershipRoles = new Set((memberships ?? []).map((membership) => membership.role));
  const campaignRole = roleOrder.find((role) => membershipRoles.has(role)) ?? "player";

  return {
    id: userId,
    email: typeof claimsData.claims.email === "string" ? claimsData.claims.email : "",
    displayName:
      profile?.display_name ??
      (typeof claimsData.claims.email === "string"
        ? claimsData.claims.email.split("@")[0]
        : "Operador"),
    role: profile?.platform_admin ? "platform_admin" : campaignRole,
    demo: false,
  };
}

// Layouts and pages often ask for the same user during one render. React.cache
// prevents repeating authentication, profile and membership network requests.
export const getCurrentUser = cache(loadCurrentUser);

export async function requireUser(returnTo: string, preferredDemoRole?: "master" | "player") {
  const user = await getCurrentUser(preferredDemoRole);
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
  return user;
}

export function roleCanAccess(role: CampaignRole, area: "master" | "player") {
  if (area === "player") return role !== "spectator";
  return ["platform_admin", "campaign_owner", "game_master", "co_master"].includes(role);
}
