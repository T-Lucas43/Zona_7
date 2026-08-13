import { readFile } from "node:fs/promises";
import path from "node:path";
import { buildScriptReportPdf } from "@/lib/pdf/script-report-pdf";
import type { Zona7Script } from "@/lib/scripts/zona7-parser";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ scriptId: string }> }) {
  try {
    const { scriptId } = await context.params;
    const supabase = await createClient();
    const { data, error } = await supabase.from("script_packages").select("campaign_id,name,current_version_id,campaigns(name),script_versions!script_versions_script_package_id_fkey(id,version_number,canonical_document)").eq("id", scriptId).is("deleted_at", null).single();
    if (error) throw new Error(error.message);
    await requireCampaignMaster(data.campaign_id);
    const versions = data.script_versions as Array<{ id: string; version_number: number; canonical_document: Zona7Script }>;
    const version = versions.find((item) => item.id === data.current_version_id) ?? [...versions].sort((a, b) => b.version_number - a.version_number)[0];
    if (!version) throw new Error("O roteiro ainda não possui uma versão publicada para exportação.");
    let logo: Uint8Array | undefined;
    try { logo = new Uint8Array(await readFile(path.join(process.cwd(), "public", "zona-7-convergencia-logo.png"))); } catch { /* marca textual permanece */ }
    const campaign = data.campaigns as unknown as { name?: string } | null;
    const bytes = await buildScriptReportPdf({ campaignName: campaign?.name ?? "Zona 7", version: version.version_number, script: version.canonical_document, logo });
    const download = new URL(request.url).searchParams.get("download") === "1";
    const filename = `roteiro-${data.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "zona-7"}-v${version.version_number}.pdf`;
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${filename}"`, "Cache-Control": "private, no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Não foi possível gerar o PDF do roteiro." }, { status: 400 });
  }
}
