import "server-only";

import { isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";

export type HelpArticle = {
  id: string;
  slug: string;
  category: string;
  audience: "player" | "master" | "both";
  title: string;
  summary: string;
  content: string;
  keywords: string[];
  version: number;
  updatedAt: string;
  links: Array<{ label: string; href: string }>;
  rule?: { key: string; title: string; payload: Record<string, unknown> } | null;
};

const fallbackArticles: HelpArticle[] = [
  {
    id: "demo-tests",
    slug: "como-fazer-testes",
    category: "testes",
    audience: "both",
    title: "Como fazer um teste",
    summary: "Intenção → método → atributo → perícia → modificadores → rolagem → consequência.",
    content:
      "Role um d20 por ponto do atributo e escolha o maior. Atributo 0 usa 2d20 e o pior. Some o bônus da perícia e todos os modificadores anunciados antes da confirmação.",
    keywords: ["dados", "teste", "DT", "perícia"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "demo-safety",
    slug: "seguranca-da-mesa",
    category: "seguranca",
    audience: "both",
    title: "Segurança da mesa",
    summary: "Ferramentas sem punição e sem justificativa obrigatória.",
    content:
      "Pausa interrompe; Corte remove detalhes; Rebobinar permite outra abordagem; Porta Aberta permite afastar-se; Check-in pede confirmação.",
    keywords: ["pausa", "corte", "check-in"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
];

export async function getCampaignProfile(campaignId: string) {
  if (!isSupabaseConfigured)
    return { id: "70000000-0000-4000-8000-000000000002", code: "zona7_convergencia", name: "Zona 7: A Convergência" };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("rule_profiles(id,code,name)")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar perfil: ${error.message}`);
  const profile = data?.rule_profiles as unknown as { id: string; code: string; name: string } | null;
  return profile;
}

export async function getHelpIndex(input: {
  campaignId: string;
  audience: "player" | "master";
  query?: string;
  category?: string;
}): Promise<HelpArticle[]> {
  if (!isSupabaseConfigured) return fallbackArticles.filter((article) => article.audience === "both" || article.audience === input.audience);
  const profile = await getCampaignProfile(input.campaignId);
  if (!profile) return [];
  const supabase = await createClient();
  let query = supabase
    .from("help_articles")
    .select(
      "id,slug,category,audience,current_version,updated_at,help_article_versions!inner(version,title,summary,content,keywords),help_article_links(label,href,position),rule_definitions(key,title,current_version,rule_versions(version,payload))",
    )
    .eq("profile_id", profile.id)
    .eq("published", true)
    .is("archived_at", null)
    .in("audience", input.audience === "master" ? ["master", "both", "player"] : ["player", "both"])
    .order("category")
    .order("slug");
  if (input.category) query = query.eq("category", input.category);
  const { data, error } = await query;
  if (error) throw new Error(`Falha ao carregar ajuda: ${error.message}`);
  const normalized = (data as unknown as Array<{
    id: string;
    slug: string;
    category: string;
    audience: HelpArticle["audience"];
    current_version: number;
    updated_at: string;
    help_article_versions: Array<{ version: number; title: string; summary: string; content: string; keywords: string[] }>;
    help_article_links: Array<{ label: string; href: string; position: number }>;
    rule_definitions: { key: string; title: string; current_version: number; rule_versions: Array<{ version: number; payload: Record<string, unknown> }> } | null;
  }>).flatMap((row) => {
    const version = row.help_article_versions.find((item) => item.version === row.current_version);
    if (!version) return [];
    const ruleVersion = row.rule_definitions?.rule_versions.find((item) => item.version === row.rule_definitions?.current_version);
    return [{
      id: row.id,
      slug: row.slug,
      category: row.category,
      audience: row.audience,
      title: version.title,
      summary: version.summary,
      content: version.content,
      keywords: version.keywords,
      version: version.version,
      updatedAt: row.updated_at,
      links: [...row.help_article_links].sort((a, b) => a.position - b.position).map(({ label, href }) => ({ label, href })),
      rule: row.rule_definitions ? { key: row.rule_definitions.key, title: row.rule_definitions.title, payload: ruleVersion?.payload ?? {} } : null,
    }];
  });
  const term = input.query?.trim().toLocaleLowerCase("pt-BR");
  return term
    ? normalized.filter((article) =>
        [article.title, article.summary, article.content, ...article.keywords]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(term),
      )
    : normalized;
}

export type RuleCatalogEntry = {
  id: string;
  key: string;
  category: string;
  title: string;
  playerSummary: string;
  masterSummary: string;
  version: number;
  basePayload: Record<string, unknown>;
  effectivePayload: Record<string, unknown>;
  overridden: boolean;
};

export async function getRuleCatalog(campaignId: string): Promise<RuleCatalogEntry[]> {
  if (!isSupabaseConfigured) return [];
  const profile = await getCampaignProfile(campaignId);
  if (!profile) return [];
  const supabase = await createClient();
  const [{ data, error }, overrides] = await Promise.all([
    supabase
      .from("rule_definitions")
      .select("id,key,category,title,player_summary,master_summary,current_version,rule_versions(version,payload)")
      .eq("profile_id", profile.id)
      .is("archived_at", null)
      .order("category")
      .order("title"),
    supabase
      .from("campaign_rule_overrides")
      .select("rule_definition_id,version,payload")
      .eq("campaign_id", campaignId)
      .eq("enabled", true),
  ]);
  if (error) throw new Error(`Falha ao carregar catálogo: ${error.message}`);
  if (overrides.error) throw new Error(`Falha ao carregar personalizações: ${overrides.error.message}`);
  const overrideByRule = new Map((overrides.data ?? []).map((item) => [item.rule_definition_id, item]));
  return (data as unknown as Array<{
    id: string; key: string; category: string; title: string; player_summary: string; master_summary: string;
    current_version: number; rule_versions: Array<{ version: number; payload: Record<string, unknown> }>;
  }>).map((rule) => {
    const basePayload = rule.rule_versions.find((version) => version.version === rule.current_version)?.payload ?? {};
    const override = overrideByRule.get(rule.id);
    return {
      id: rule.id,
      key: rule.key,
      category: rule.category,
      title: rule.title,
      playerSummary: rule.player_summary,
      masterSummary: rule.master_summary,
      version: override?.version ?? rule.current_version,
      basePayload,
      effectivePayload: override?.payload ?? basePayload,
      overridden: Boolean(override),
    };
  });
}

export async function getSessionRulesSnapshot(sessionId: string) {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("session_rule_snapshots")
    .select("id,revision,reason,created_at,session_rule_snapshot_items(rule_key,rule_version,source,payload)")
    .eq("session_id", sessionId)
    .order("revision", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar snapshot: ${error.message}`);
  return data;
}

