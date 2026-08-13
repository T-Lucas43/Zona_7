import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const querySchema = z.object({ campaignId: z.uuid() });

export async function GET(request: Request, context: { params: Promise<{ scriptId: string }> }) {
  try {
    const { scriptId } = await context.params;
    const campaignId = querySchema.parse({ campaignId: new URL(request.url).searchParams.get("campaignId") }).campaignId;
    await requireCampaignMaster(campaignId);
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("script_packages")
      .select("id,name,current_version_id,script_versions!script_versions_script_package_id_fkey(id,version_number,source_format,canonical_document)")
      .eq("id", scriptId).eq("campaign_id", campaignId).is("deleted_at", null).single();
    if (error) throw new Error(error.message);
    const version = data.script_versions.find((item) => item.id === data.current_version_id) ?? data.script_versions.sort((a, b) => b.version_number - a.version_number)[0];
    if (!version) throw new Error("Este roteiro ainda não possui uma versão editável.");
    return NextResponse.json({ id: data.id, title: data.name, version: version.version_number, format: "json", source: JSON.stringify(version.canonical_document, null, 2) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível abrir o roteiro." }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ scriptId: string }> }) {
  try {
    const { scriptId } = await context.params;
    const campaignId = querySchema.parse(await request.json()).campaignId;
    const user = await requireCampaignMaster(campaignId);
    const supabase = await createClient();
    const versions = await supabase.from("script_versions").select("id").eq("script_package_id", scriptId);
    if (versions.error) throw new Error(versions.error.message);
    const versionIds = versions.data.map((item) => item.id);
    const active = versionIds.length
      ? await supabase.from("script_runs").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).in("status", ["preparing", "running", "paused", "improvising"]).in("script_version_id", versionIds)
      : { count: 0, error: null };
    if (active.error) throw new Error(active.error.message);
    if ((active.count ?? 0) > 0) throw new Error("Encerre a execução ativa antes de excluir este roteiro.");
    const { error } = await supabase.from("script_packages").update({ deleted_at: new Date().toISOString(), state: "archived" }).eq("id", scriptId).eq("campaign_id", campaignId);
    if (error) throw new Error(error.message);
    await supabase.from("audit_events").insert({ campaign_id: campaignId, actor_user_id: user.id, entity_type: "script_package", entity_id: scriptId, event_type: "script_deleted", visibility: "gm_only", after_data: { deleted: true }, idempotency_key: crypto.randomUUID() });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível excluir o roteiro." }, { status: 400 });
  }
}
