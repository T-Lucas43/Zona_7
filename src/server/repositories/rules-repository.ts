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
    id: "manual-comece-aqui",
    slug: "comece-aqui",
    category: "comece_aqui",
    audience: "both",
    title: "Comece aqui",
    summary: "O fluxo essencial para preparar, entrar e conduzir uma sessão de Zona 7.",
    content:
      "Confirme a campanha, a ficha vinculada e a conexão. O mestre abre a sessão, publica a cena e fixa as regras efetivas. Jogadores declaram intenção e método antes de rolar. Mapa, mensagens, turnos, recursos e escolhas são atualizados durante a partida.",
    keywords: ["início", "sessão", "preparação"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
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
  {
    id: "manual-recursos",
    slug: "pv-pe-san",
    category: "recursos",
    audience: "both",
    title: "PV, PE e SAN",
    summary: "Recursos atuais e máximos, alertas críticos e consequências de chegar a zero.",
    content:
      "PV representa a capacidade de continuar agindo; ao chegar a zero, o personagem fica Morrendo e perde suas ações até ser estabilizado ou finalizado pelo mestre. PE paga habilidades e SAN acompanha a estabilidade mental. Alterações de valor atual ou máximo feitas pelo mestre ficam registradas e são sincronizadas com o jogador.",
    keywords: ["PV", "PE", "SAN", "morrendo", "cura", "dano"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "manual-combate",
    slug: "combate-e-iniciativa",
    category: "combate",
    audience: "both",
    title: "Combate e iniciativa",
    summary: "A iniciativa ordena os participantes e o turno define quem pode agir.",
    content:
      "Em seu turno, use uma ação padrão e uma de movimento, duas de movimento ou uma ação completa. Reações dependem de gatilho. A iniciativa considera o resultado, o bônus configurado e a Agilidade para desempates. O resultado público identifica quem rolou, os dados, o total e a consequência informada pelo mestre.",
    keywords: ["combate", "iniciativa", "turno", "ações"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "manual-habilidades",
    slug: "habilidades-e-solicitacoes",
    category: "habilidades",
    audience: "both",
    title: "Habilidades e solicitações",
    summary: "Cada habilidade informa critério, aplicação, teste, custo e efeito.",
    content:
      "O jogador solicita o uso pela ficha ou sala. O mestre pode aprovar ou recusar. A aprovação libera a rolagem quando houver teste; a recusa não consome recurso. O custo é aplicado somente na resolução confirmada, respeitando requisitos, alvo, alcance e limite por turno.",
    keywords: ["habilidade", "solicitar", "aprovar", "recusar", "teste"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "manual-mapa",
    slug: "mapa-e-tempo-real",
    category: "mapa",
    audience: "both",
    title: "Mapa, tokens e tempo real",
    summary: "A cena publicada é a mesma para mestre e jogadores, respeitando a visibilidade.",
    content:
      "O mestre move personagens, entidades, NPCs e itens no mapa. Elementos ocultos nunca são enviados para jogadores sem permissão. A cena pode ser sincronizada ou temporariamente dessincronizada durante a preparação. Atualizações chegam pelo canal em tempo real e por verificação de recuperação, sem exigir recarregar a página.",
    keywords: ["mapa", "token", "tempo real", "cena", "visibilidade"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "manual-mestre-configuracao",
    slug: "primeira-configuracao",
    category: "operação",
    audience: "master",
    title: "Primeira configuração da campanha",
    summary: "Checklist do mestre antes de abrir a primeira sessão.",
    content:
      "Confirme perfil de regras, contas, personagens atribuídos, campos visíveis da ficha, recursos, habilidades liberadas, atores, pistas, itens, mapa e roteiro. Valide quem pode entrar na sessão e mantenha conteúdo secreto marcado como somente mestre.",
    keywords: ["mestre", "configuração", "checklist", "campanha"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "manual-mestre-sessao",
    slug: "conduzir-a-sessao",
    category: "operação",
    audience: "master",
    title: "Conduzir a sessão",
    summary: "Ordem operacional para usar a central ao vivo sem perder contexto.",
    content:
      "Inicie ou retome a sessão, confirme os participantes, selecione o roteiro atualizado e publique a cena. Use o mapa central para selecionar um personagem e abrir suas ações rápidas. Solicite testes com DT e consequência, resolva habilidades, avance a iniciativa, entregue itens ou pistas e acompanhe o registro de eventos.",
    keywords: ["mestre", "sessão", "central", "roteiro"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
  {
    id: "manual-mestre-erros",
    slug: "corrigir-erros",
    category: "operação",
    audience: "master",
    title: "Corrigir erros com seguranca",
    summary: "Prefira compensações auditáveis e preserve o histórico da partida.",
    content:
      "Não apague eventos para esconder uma falha. Corrija recursos com motivo, publique uma nova versão quando uma regra mudar e reinicie somente a execução necessária. A auditoria deve permitir entender o valor anterior, o novo valor, o responsável e o motivo.",
    keywords: ["mestre", "auditoria", "erro", "correção"],
    version: 1,
    updatedAt: new Date(0).toISOString(),
    links: [],
  },
];

function filterFallbackArticles(input: {
  audience: "player" | "master";
  query?: string;
  category?: string;
}) {
  const term = input.query?.trim().toLocaleLowerCase("pt-BR");
  return fallbackArticles.filter((article) => {
    if (article.audience !== "both" && article.audience !== input.audience) return false;
    if (input.category && article.category !== input.category) return false;
    if (!term) return true;
    return [article.title, article.summary, article.content, ...article.keywords]
      .join(" ")
      .toLocaleLowerCase("pt-BR")
      .includes(term);
  });
}

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
  if (!isSupabaseConfigured) return filterFallbackArticles(input);
  const profile = await getCampaignProfile(input.campaignId);
  if (!profile) return filterFallbackArticles(input);
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
  if (error) return filterFallbackArticles(input);
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
  const filtered = term
    ? normalized.filter((article) =>
        [article.title, article.summary, article.content, ...article.keywords]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(term),
      )
    : normalized;
  return filtered.length > 0 ? filtered : filterFallbackArticles(input);
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
