import { NextResponse } from "next/server";
import { z } from "zod";
import { appConfig, isAdminConfigured } from "@/lib/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { inviteMember } from "@/server/services/domain-service";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  displayName: z.string().trim().min(2).max(100),
  email: z.string().email(),
  role: z.enum(["game_master", "co_master", "player", "spectator"]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const invitation = await inviteMember({ ...input, actorUserId: user.id });
    if (isAdminConfigured && "token" in invitation) {
      const admin = createAdminClient();
      const next = `/invite/${invitation.token}`;
      const { error } = await admin.auth.admin.inviteUserByEmail(input.email, {
        data: { display_name: input.displayName },
        redirectTo: `${appConfig.appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      });
      if (error)
        throw new Error(`Convite registrado, mas o e-mail não pôde ser enviado: ${error.message}`);
    }
    return NextResponse.json({ id: invitation.id, expiresInHours: 72 }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Convite inválido." },
      { status: 400 },
    );
  }
}
