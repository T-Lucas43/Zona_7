import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { parseZona7Script } from "@/lib/scripts/zona7-parser";
import { createClient } from "@/lib/supabase/server";
import { requireCampaignMaster } from "@/server/services/master-access";

const schema = z.object({
  campaignId: z.string().uuid(),
  source: z.string().min(10).max(2_000_000),
  format: z.enum(["markdown", "json"]),
});

export async function POST(request: Request) {
  try {
    const input = schema.parse(await request.json());
    const user = await requireCampaignMaster(input.campaignId);
    const parsed = parseZona7Script(input.source, input.format);
    if (parsed.issues.some((issue) => issue.severity === "error"))
      throw new Error("Corrija os erros antes de publicar.");
    if (!isSupabaseConfigured)
      return NextResponse.json(
        { id: crypto.randomUUID(), version: 1, demo: true },
        { status: 201 },
      );
    const supabase = await createClient();
    const slug = parsed.document.id.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const { data: pacote, error: pacoteError } = await supabase
      .from("script_packages")
      .upsert(
        {
          campaign_id: input.campaignId,
          name: parsed.document.title,
          slug,
          state: "draft",
          created_by: user.id,
        },
        { onConflict: "campaign_id,slug" },
      )
      .select("id")
      .single();
    if (pacoteError) throw new Error(pacoteError.message);
    const { count } = await supabase
      .from("script_versions")
      .select("id", { count: "exact", head: true })
      .eq("script_package_id", pacote.id);
    const version = (count ?? 0) + 1;
    const hash = createHash("sha256").update(input.source).digest("hex");
    const { data: versao, error: versaoError } = await supabase
      .from("script_versions")
      .insert({
        campaign_id: input.campaignId,
        script_package_id: pacote.id,
        version_number: version,
        schema_version: parsed.document.schemaVersion,
        canonical_document: parsed.document,
        source_format: input.format,
        source_hash: hash,
        state: "published",
        published_at: new Date().toISOString(),
        created_by: user.id,
      })
      .select("id")
      .single();
    if (versaoError) throw new Error(versaoError.message);
    const nodeIds = new Map<string, string>();
    for (const [index, node] of parsed.document.nodes.entries()) {
      const { data, error } = await supabase
        .from("script_nodes")
        .insert({
          campaign_id: input.campaignId,
          script_version_id: versao.id,
          stable_key: node.id,
          node_type: node.type,
          title: node.title ?? node.id,
          public_content: node,
          gm_content: {},
          sort_order: index,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      nodeIds.set(node.id, data.id);
    }
    for (const [index, edge] of parsed.document.edges.entries()) {
      const source = nodeIds.get(edge.source);
      const target = nodeIds.get(edge.target);
      if (!source || !target) continue;
      const { error } = await supabase.from("script_edges").insert({
        campaign_id: input.campaignId,
        script_version_id: versao.id,
        source_node_id: source,
        target_node_id: target,
        edge_type: edge.type,
        label: edge.label ?? null,
        sort_order: index,
      });
      if (error) throw new Error(error.message);
    }
    await supabase
      .from("script_packages")
      .update({ current_version_id: versao.id, state: "published" })
      .eq("id", pacote.id);
    return NextResponse.json({ id: pacote.id, version }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao publicar roteiro." },
      { status: 400 },
    );
  }
}
