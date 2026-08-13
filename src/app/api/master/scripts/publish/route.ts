import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isSupabaseConfigured } from "@/lib/config";
import { explainScriptError, parseZona7Script } from "@/lib/scripts/zona7-parser";
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
    const { data: existingPackage, error: packageLookupError } = await supabase
      .from("script_packages")
      .select("id")
      .eq("campaign_id", input.campaignId)
      .eq("slug", slug)
      .maybeSingle();
    if (packageLookupError) throw new Error(packageLookupError.message);
    let pacote = existingPackage;
    if (!pacote) {
      const { data, error } = await supabase
        .from("script_packages")
        .insert({
          campaign_id: input.campaignId,
          name: parsed.document.title,
          slug,
          state: "draft",
          created_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      pacote = data;
    }
    const hash = createHash("sha256").update(input.source).digest("hex");
    const { data: existingVersion, error: versionLookupError } = await supabase
      .from("script_versions")
      .select("id,version_number")
      .eq("script_package_id", pacote.id)
      .eq("source_hash", hash)
      .maybeSingle();
    if (versionLookupError) throw new Error(versionLookupError.message);
    if (existingVersion) {
      const { error: versionPublishError } = await supabase
        .from("script_versions")
        .update({ state: "published", published_at: new Date().toISOString() })
        .eq("id", existingVersion.id);
      if (versionPublishError) throw new Error(versionPublishError.message);
      const { error: packagePublishError } = await supabase
        .from("script_packages")
        .update({
          name: parsed.document.title,
          current_version_id: existingVersion.id,
          state: "published",
        })
        .eq("id", pacote.id);
      if (packagePublishError) throw new Error(packagePublishError.message);
      return NextResponse.json({
        id: pacote.id,
        version: existingVersion.version_number,
        title: parsed.document.title,
        reused: true,
      });
    }
    const { data: latestVersion, error: latestVersionError } = await supabase
      .from("script_versions")
      .select("version_number")
      .eq("script_package_id", pacote.id)
      .order("version_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestVersionError) throw new Error(latestVersionError.message);
    const version = (latestVersion?.version_number ?? 0) + 1;
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
    const { error: packagePublishError } = await supabase
      .from("script_packages")
      .update({ name: parsed.document.title, current_version_id: versao.id, state: "published" })
      .eq("id", pacote.id);
    if (packagePublishError) throw new Error(packagePublishError.message);
    return NextResponse.json({ id: pacote.id, version, title: parsed.document.title }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: explainScriptError(error) }, { status: 400 });
  }
}
