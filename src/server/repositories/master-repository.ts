import "server-only";

import { getCurrentUser } from "@/lib/auth/session";
import { isAdminConfigured, isSupabaseConfigured } from "@/lib/config";
import { characters } from "@/lib/demo-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const roleLabels: Record<string, string> = {
  campaign_owner: "Responsável pela campanha",
  game_master: "Mestre",
  co_master: "Mestre auxiliar",
  player: "Jogador",
  spectator: "Espectador",
};
const statusLabels: Record<string, string> = {
  active: "Ativo",
  invited: "Convite pendente",
  suspended: "Suspenso",
  archived: "Arquivado",
};
const actorTypeLabels: Record<string, string> = {
  player_character: "Personagem de jogador",
  npc: "Personagem não jogável",
  entity: "Entidade",
  environment: "Ambiente",
  threat: "Ameaça",
  narrator: "Narrador",
};
const visibilityLabels: Record<string, string> = {
  public: "Público",
  campaign: "Toda a campanha",
  selected: "Pessoas selecionadas",
  owner_only: "Dono da ficha e mestres",
  gm_only: "Somente mestres",
};
const gridTypeLabels: Record<string, string> = {
  square: "Quadrada",
  hex: "Hexagonal",
  none: "Sem grade",
};

export type Remetente = {
  id: string;
  nome: string;
  tipo: "master" | "system" | "npc" | "entity" | "unknown" | "custom";
  rotuloNotificacao: string;
  cor: string;
  efeito: string;
  ativo: boolean;
};

export type ContaDaCampanha = {
  membroId: string;
  usuarioId: string;
  nome: string;
  email: string;
  papel: string;
  situacao: string;
  ultimoAcesso: string | null;
  personagem: string | null;
  personagemId: string | null;
};

export type CampoPersonalizado = {
  id: string;
  entidade: string;
  chave: string;
  rotulo: string;
  tipo: string;
  visibilidade: string;
  ativo: boolean;
};

export type PersonalizacaoCampanha = {
  nome: string;
  fusoHorario: string;
  idioma: string;
  rotulos: Record<string, string>;
  tema: { destaque: string; energia: string; fundo: string };
  modulos: Record<string, boolean>;
  regras: { zeroPv: string; zeroSan: string; pressao: number };
  campos: CampoPersonalizado[];
};

export type AtorDaCampanha = {
  id: string;
  nome: string;
  tipo: string;
  descricao: string;
  cor: string;
  estado: string;
  visibilidade: string;
  portraitUrl?: string;
  naCena: boolean;
  tokenId?: string;
  tokenVisivel?: boolean;
};

export type ItemDaCampanha = {
  id: string;
  nome: string;
  descricao: string;
  categoria: string;
  visibilidade: string;
  imagePath?: string;
  imageUrl?: string;
};

export type CenaDaCampanha = {
  id: string;
  nome: string;
  descricao: string;
  estado: string;
  modoGrade: string;
  backgroundUrl?: string;
  backgroundKey?: string;
  tokens: Array<{
    id: string;
    atorId?: string;
    itemId?: string;
    characterId?: string;
    actorType?: string;
    characterState?: string;
    portraitUrl?: string;
    portraitKey?: string;
    itemImageUrl?: string;
    itemImageKey?: string;
    nome: string;
    cor: string;
    x: number;
    y: number;
    zIndex: number;
    visivel: boolean;
  }>;
  connections: Array<{ id: string; fromTokenId: string; toTokenId: string }>;
};

export type RoteiroDaCampanha = {
  id: string;
  nome: string;
  descricao: string;
  estado: string;
  versao: number;
};

export type PaginaCadernoDaCampanha = {
  id: string;
  ownerUserId: string;
  characterId: string;
  pageNumber: number;
  title: string;
  content: string;
  linkedHandoutIds: string[];
  updatedAt: string;
};

export async function getCadernosDaCampanha(
  campaignId: string,
): Promise<PaginaCadernoDaCampanha[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_notebook_pages")
    .select("id,user_id,character_id,page_number,title,content,linked_handout_ids,updated_at")
    .eq("campaign_id", campaignId)
    .order("page_number");
  if (error) throw new Error(`Falha ao carregar cadernos: ${error.message}`);
  return data.map((page) => ({
    id: page.id,
    ownerUserId: page.user_id,
    characterId: page.character_id,
    pageNumber: page.page_number,
    title: page.title,
    content: page.content,
    linkedHandoutIds: page.linked_handout_ids ?? [],
    updatedAt: page.updated_at,
  }));
}

export type CampanhaResumo = {
  id: string;
  nome: string;
  premissa: string;
  situacao: string;
  personagens: number;
  conectados: number;
  pressao: number;
  sessao: {
    id: string;
    titulo: string;
    estado: string;
    cena: string;
  } | null;
};

export type EncontroDaCampanha = {
  id: string;
  nome: string;
  estado: string;
  rodada: number;
  participantes: number;
  observacoes: string;
  turnoAtual: number | null;
  combatentes: Array<{
    id: string;
    nome: string;
    tipo: "character" | "ally" | "npc" | "enemy";
    iniciativa: number | null;
    posicao: number;
    atual: boolean;
  }>;
};

export type MensagemDaCampanha = {
  id: string;
  remetente: string;
  corpo: string;
  estado: string;
  destinatarios: number;
  criadoEm: string;
};

export type PistaDaCampanha = {
  id: string;
  titulo: string;
  tipo: string;
  estado: string;
  visibilidade: string;
  resumo: string;
  conteudo: string;
  board?: {
    x: number;
    y: number;
    rotation: number;
    zIndex: number;
    style: "polaroid" | "postit" | "paper";
    visibleToPlayers: boolean;
  };
};

export type ConexaoDoMural = {
  id: string;
  fromHandoutId: string;
  toHandoutId: string;
};

export type SessionSceneState = {
  enabled: boolean;
  sceneId: string | null;
};

export type EventoAuditoria = {
  id: string;
  tipo: string;
  entidade: string;
  criadoEm: string;
  detalhes: Record<string, unknown>;
};

export type RegrasDaCampanha = {
  perfil: string;
  descricao: string;
  sistema: string;
  zeroPv: string;
  zeroSan: string;
  pressao: number;
};

export type PerfilDeRegras = { id: string; codigo: string; nome: string; descricao: string };

const campaignStatusLabels: Record<string, string> = {
  draft: "Rascunho",
  active: "Ativa",
  paused: "Pausada",
  archived: "Arquivada",
};

type CampaignOverviewRow = {
  id: string;
  name: string;
  public_premise: string | null;
  status: string;
  characters: Array<{ id: string }>;
  campaign_rule_settings: { pressure: number } | null;
  sessions: Array<{
    id: string;
    title: string;
    status: string;
    updated_at: string;
    session_participants: Array<{ status: string }>;
    session_scenes: { title: string } | null;
  }>;
};

function mapCampaignOverview(row: CampaignOverviewRow): CampanhaResumo {
  const sessions = [...(row.sessions ?? [])].sort((a, b) =>
    b.updated_at.localeCompare(a.updated_at),
  );
  const current =
    sessions.find((session) => !["ended", "archived"].includes(session.status)) ?? sessions[0];
  return {
    id: row.id,
    nome: row.name,
    premissa: row.public_premise ?? "",
    situacao: campaignStatusLabels[row.status] ?? row.status,
    personagens: row.characters?.length ?? 0,
    conectados:
      current?.session_participants?.filter((participant) => participant.status === "online")
        .length ?? 0,
    pressao: row.campaign_rule_settings?.pressure ?? 0,
    sessao: current
      ? {
          id: current.id,
          titulo: current.title,
          estado: current.status,
          cena: current.session_scenes?.title ?? current.title,
        }
      : null,
  };
}

const campaignOverviewSelect = `
  id,name,public_premise,status,
  characters(id),
  campaign_rule_settings(pressure),
  sessions(id,title,status,updated_at,session_participants(status),session_scenes!sessions_current_scene_fk(title))
`;

export async function getCampanhasDoMestre(): Promise<CampanhaResumo[]> {
  if (!isSupabaseConfigured) return [];
  const user = await getCurrentUser("master");
  if (!user) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(`${campaignOverviewSelect},campaign_members!inner(user_id,role,status)`)
    .eq("campaign_members.user_id", user.id)
    .eq("campaign_members.status", "active")
    .in("campaign_members.role", ["campaign_owner", "game_master", "co_master"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar campanhas: ${error.message}`);
  return (data as unknown as CampaignOverviewRow[]).map(mapCampaignOverview);
}

export async function getCampanhaResumo(campaignId: string): Promise<CampanhaResumo | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(campaignOverviewSelect)
    .eq("id", campaignId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar campanha: ${error.message}`);
  return data ? mapCampaignOverview(data as unknown as CampaignOverviewRow) : null;
}

export async function getNomeCampanha(campaignId: string): Promise<string> {
  if (!isSupabaseConfigured) return "Campanha local";
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("name")
    .eq("id", campaignId)
    .single();
  if (error) throw new Error(`Falha ao carregar campanha: ${error.message}`);
  return data.name;
}

export async function getEncontros(campaignId: string): Promise<EncontroDaCampanha[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("encounters")
    .select(
      "id,name,status,round,current_turn_position,gm_notes,encounter_combatants(id,display_name,kind,initiative,position)",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar encontros: ${error.message}`);
  return data.map((encounter) => {
    const combatentes = [...encounter.encounter_combatants].sort(
      (left, right) => left.position - right.position,
    );
    return {
      id: encounter.id,
      nome: encounter.name,
      estado: encounter.status,
      rodada: encounter.round,
      participantes: combatentes.length,
      observacoes: encounter.gm_notes ?? "",
      turnoAtual: encounter.current_turn_position,
      combatentes: combatentes.map((combatente) => ({
        id: combatente.id,
        nome: combatente.display_name,
        tipo: combatente.kind,
        iniciativa: combatente.initiative,
        posicao: combatente.position,
        atual: combatente.position === encounter.current_turn_position,
      })),
    };
  });
}

export async function getMensagensDaCampanha(campaignId: string): Promise<MensagemDaCampanha[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id,apparent_sender_name,status,created_at,message_contents(body),message_recipients(id)",
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Falha ao carregar mensagens: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      apparent_sender_name: string;
      status: string;
      created_at: string;
      message_contents: { body: string | null } | null;
      message_recipients: Array<{ id: string }>;
    }>
  ).map((message) => ({
    id: message.id,
    remetente: message.apparent_sender_name,
    corpo: message.message_contents?.body ?? "",
    estado: message.status,
    destinatarios: message.message_recipients.length,
    criadoEm: message.created_at,
  }));
}

export async function getPistas(campaignId: string): Promise<PistaDaCampanha[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handouts")
    .select(
      "id,title,type,state,visibility,public_excerpt,handout_contents(protected_text),investigation_board_items(x,y,rotation,z_index,display_style,visible_to_players)",
    )
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar pistas: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      title: string;
      type: string;
      state: string;
      visibility: string;
      public_excerpt: string | null;
      handout_contents: { protected_text: string | null } | null;
      investigation_board_items:
        | Array<{
            x: number;
            y: number;
            rotation: number;
            z_index: number;
            display_style: "polaroid" | "postit" | "paper";
            visible_to_players: boolean;
          }>
        | {
            x: number;
            y: number;
            rotation: number;
            z_index: number;
            display_style: "polaroid" | "postit" | "paper";
            visible_to_players: boolean;
          }
        | null;
    }>
  ).map((handout) => ({
    id: handout.id,
    titulo: handout.title,
    tipo: handout.type,
    estado: handout.state,
    visibilidade: visibilityLabels[handout.visibility] ?? handout.visibility,
    resumo: handout.public_excerpt ?? "",
    conteudo: handout.handout_contents?.protected_text ?? "",
    board: (() => {
      const value = Array.isArray(handout.investigation_board_items)
        ? handout.investigation_board_items[0]
        : handout.investigation_board_items;
      return value
        ? {
            x: Number(value.x),
            y: Number(value.y),
            rotation: Number(value.rotation),
            zIndex: value.z_index,
            style: value.display_style,
            visibleToPlayers: value.visible_to_players,
          }
        : undefined;
    })(),
  }));
}

export async function getConexoesDoMural(campaignId: string): Promise<ConexaoDoMural[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investigation_board_connections")
    .select("id,from_handout_id,to_handout_id")
    .eq("campaign_id", campaignId)
    .order("created_at");
  if (error) throw new Error(`Falha ao carregar conexões do mural: ${error.message}`);
  return data.map((item) => ({
    id: item.id,
    fromHandoutId: item.from_handout_id,
    toHandoutId: item.to_handout_id,
  }));
}

export async function getItensDaCampanha(campaignId: string): Promise<ItemDaCampanha[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items")
    .select("id,name,description,category,visibility,image_path")
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar itens: ${error.message}`);
  return Promise.all(
    data.map(async (item) => {
      const signed = item.image_path
        ? await supabase.storage.from("handouts-public").createSignedUrl(item.image_path, 3600)
        : null;
      return {
        id: item.id,
        nome: item.name,
        descricao: item.description ?? "",
        categoria: item.category ?? "Item de sessão",
        visibilidade: visibilityLabels[item.visibility] ?? item.visibility,
        imagePath: item.image_path ?? undefined,
        imageUrl: signed?.data?.signedUrl,
      };
    }),
  );
}

export async function getSessionSceneState(sessionId: string): Promise<SessionSceneState> {
  if (!isSupabaseConfigured) return { enabled: true, sceneId: null };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("live_sessions")
    .select("scene_sync_enabled,current_scene_id")
    .eq("session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(`Falha ao carregar sincronização da cena: ${error.message}`);
  return { enabled: data?.scene_sync_enabled ?? true, sceneId: data?.current_scene_id ?? null };
}

export async function getEventosAuditoria(campaignId: string): Promise<EventoAuditoria[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select("id,event_type,entity_type,created_at,metadata")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Falha ao carregar auditoria: ${error.message}`);
  return data.map((event) => ({
    id: event.id,
    tipo: event.event_type,
    entidade: event.entity_type,
    criadoEm: event.created_at,
    detalhes: (event.metadata ?? {}) as Record<string, unknown>,
  }));
}

export async function getRegras(campaignId: string): Promise<RegrasDaCampanha | null> {
  if (!isSupabaseConfigured) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select(
      "system_code,rule_profiles(name,description),campaign_rule_settings(zero_hp_mode,zero_sanity_mode,pressure)",
    )
    .eq("id", campaignId)
    .single();
  if (error) throw new Error(`Falha ao carregar regras: ${error.message}`);
  const profile = data.rule_profiles as unknown as {
    name: string;
    description: string | null;
  } | null;
  const settings = data.campaign_rule_settings as unknown as {
    zero_hp_mode: string;
    zero_sanity_mode: string;
    pressure: number;
  } | null;
  return {
    perfil: profile?.name ?? data.system_code,
    descricao: profile?.description ?? "",
    sistema: data.system_code,
    zeroPv: settings?.zero_hp_mode ?? "dying",
    zeroSan: settings?.zero_sanity_mode ?? "absorbed_by_zone",
    pressao: settings?.pressure ?? 0,
  };
}

export async function getPerfisDeRegras(): Promise<PerfilDeRegras[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("rule_profiles")
    .select("id,code,name,description")
    .order("name");
  if (error) throw new Error(`Falha ao carregar perfis de regras: ${error.message}`);
  return data.map((profile) => ({
    id: profile.id,
    codigo: profile.code,
    nome: profile.name,
    descricao: profile.description ?? "",
  }));
}

export async function getRemetentes(campaignId: string): Promise<Remetente[]> {
  if (!isSupabaseConfigured) {
    return [
      {
        id: "mestre",
        nome: "Mestre",
        tipo: "master",
        rotuloNotificacao: "Mensagem do mestre",
        cor: "#b52532",
        efeito: "terminal",
        ativo: true,
      },
      {
        id: "sistema",
        nome: "SISTEMA ZONA 7",
        tipo: "system",
        rotuloNotificacao: "Alerta do sistema",
        cor: "#d84b57",
        efeito: "falha",
        ativo: true,
      },
      {
        id: "desconhecido",
        nome: "DESCONHECIDO",
        tipo: "unknown",
        rotuloNotificacao: "Nova mensagem",
        cor: "#90949d",
        efeito: "estática",
        ativo: true,
      },
      {
        id: "facilitador",
        nome: "Facilitador",
        tipo: "entity",
        rotuloNotificacao: "Contato externo",
        cor: "#4b9be8",
        efeito: "pulso",
        ativo: true,
      },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("message_sender_profiles")
    .select("id,name,sender_type,notification_label,visual_style,is_active")
    .eq("campaign_id", campaignId)
    .order("name");
  if (error) throw new Error(`Falha ao carregar remetentes: ${error.message}`);
  return data.map((item) => {
    const visual = (item.visual_style ?? {}) as Record<string, string>;
    return {
      id: item.id,
      nome: item.name,
      tipo: item.sender_type as Remetente["tipo"],
      rotuloNotificacao: item.notification_label,
      cor: visual.color ?? "#b52532",
      efeito: visual.effect ?? "terminal",
      ativo: item.is_active,
    };
  });
}

export async function getContasDaCampanha(
  campaignId: string,
  includeAccessDetails = true,
): Promise<ContaDaCampanha[]> {
  if (!isSupabaseConfigured) {
    return characters.slice(0, 5).map((personagem, indice) => ({
      membroId: `20000000-0000-4000-8000-00000000000${indice + 1}`,
      usuarioId: `10000000-0000-4000-8000-00000000000${indice + 1}`,
      nome: personagem.name,
      email: `${personagem.id}@zona7.local`,
      papel: "Jogador",
      situacao: indice === 4 ? "Convite pendente" : "Ativo",
      ultimoAcesso: indice === 4 ? null : new Date(Date.now() - indice * 3_600_000).toISOString(),
      personagem: personagem.name,
      personagemId: personagem.id,
    }));
  }
  if (includeAccessDetails && !isAdminConfigured) {
    throw new Error(
      "A chave de serviço do Supabase é necessária para consultar os e-mails com segurança.",
    );
  }
  const supabase = await createClient();
  const [membersResult, ownersResult] = await Promise.all([
    supabase
      .from("campaign_members")
      .select("id,user_id,role,status,profiles(display_name)")
      .eq("campaign_id", campaignId)
      .order("created_at"),
    supabase
      .from("character_owners")
      .select("user_id,characters(id,name)")
      .eq("campaign_id", campaignId),
  ]);
  const { data, error } = membersResult;
  if (error) throw new Error(`Falha ao carregar membros: ${error.message}`);
  const { data: vinculos, error: vinculosError } = ownersResult;
  if (vinculosError) throw new Error(`Falha ao carregar vínculos: ${vinculosError.message}`);
  const authById = new Map<string, { email?: string; last_sign_in_at?: string }>();
  if (includeAccessDetails) {
    const admin = createAdminClient();
    const { data: authData, error: authError } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1_000,
    });
    if (authError) throw new Error(`Falha ao carregar acessos: ${authError.message}`);
    authData.users.forEach((user) => authById.set(user.id, user));
  }
  const links = vinculos as unknown as Array<{
    user_id: string;
    characters: { id: string; name: string } | null;
  }>;
  return (
    data as unknown as Array<{
      id: string;
      user_id: string;
      role: string;
      status: string;
      profiles: { display_name: string } | null;
    }>
  ).map((membro) => {
    const authUser = authById.get(membro.user_id);
    const personagem = links.find((vinculo) => vinculo.user_id === membro.user_id)?.characters;
    return {
      membroId: membro.id,
      usuarioId: membro.user_id,
      nome: membro.profiles?.display_name ?? "Participante",
      email: authUser?.email ?? (includeAccessDetails ? "E-mail indisponível" : "E-mail protegido"),
      papel: roleLabels[membro.role] ?? membro.role,
      situacao: statusLabels[membro.status] ?? membro.status,
      ultimoAcesso: authUser?.last_sign_in_at ?? null,
      personagem: personagem?.name ?? null,
      personagemId: personagem?.id ?? null,
    };
  });
}

export async function getPersonalizacao(campaignId: string): Promise<PersonalizacaoCampanha> {
  const padrao: PersonalizacaoCampanha = {
    nome: "Zona 7: A Convergência",
    fusoHorario: "America/Belem",
    idioma: "pt-BR",
    rotulos: {
      pv: "Pontos de Vida",
      pe: "Pontos de Esforço",
      san: "Sanidade",
      nex: "Nível de Exposição",
    },
    tema: { destaque: "#b52532", energia: "#4b9be8", fundo: "#08090b" },
    modulos: {
      combate: true,
      mensagens: true,
      pistas: true,
      dados: true,
      auditoria: true,
      sons: true,
    },
    regras: { zeroPv: "Morrendo", zeroSan: "Absorvido pela Zona", pressao: 3 },
    campos: [
      {
        id: "sinal",
        entidade: "personagem",
        chave: "sinal_da_zona",
        rotulo: "Sinal da Zona",
        tipo: "texto",
        visibilidade: "Somente mestre",
        ativo: true,
      },
    ],
  };
  if (!isSupabaseConfigured) return padrao;
  const supabase = await createClient();
  const [campanha, interfaceDados, regrasDados, camposDados] = await Promise.all([
    supabase.from("campaigns").select("name,timezone,language_code").eq("id", campaignId).single(),
    supabase
      .from("campaign_ui_settings")
      .select("labels,theme,feature_flags")
      .eq("campaign_id", campaignId)
      .maybeSingle(),
    supabase
      .from("campaign_rule_settings")
      .select("zero_hp_mode,zero_sanity_mode,pressure")
      .eq("campaign_id", campaignId)
      .maybeSingle(),
    supabase
      .from("campaign_custom_fields")
      .select("id,entity_type,field_key,label,input_type,visibility,is_active")
      .eq("campaign_id", campaignId)
      .order("position"),
  ]);
  if (campanha.error) throw new Error(`Falha ao carregar configurações: ${campanha.error.message}`);
  const tema = (interfaceDados.data?.theme ?? {}) as Record<string, string>;
  return {
    nome: campanha.data.name,
    fusoHorario: campanha.data.timezone,
    idioma: campanha.data.language_code,
    rotulos: {
      ...padrao.rotulos,
      ...((interfaceDados.data?.labels ?? {}) as Record<string, string>),
    },
    tema: {
      destaque: tema.accent ?? padrao.tema.destaque,
      energia: tema.energy ?? padrao.tema.energia,
      fundo: tema.background ?? padrao.tema.fundo,
    },
    modulos: {
      ...padrao.modulos,
      ...((interfaceDados.data?.feature_flags ?? {}) as Record<string, boolean>),
    },
    regras: {
      zeroPv: regrasDados.data?.zero_hp_mode ?? "dying",
      zeroSan: regrasDados.data?.zero_sanity_mode ?? "absorbed_by_zone",
      pressao: regrasDados.data?.pressure ?? 0,
    },
    campos: (camposDados.data ?? []).map((campo) => ({
      id: campo.id,
      entidade: campo.entity_type,
      chave: campo.field_key,
      rotulo: campo.label,
      tipo: campo.input_type,
      visibilidade: campo.visibility,
      ativo: campo.is_active,
    })),
  };
}

export async function getAtores(campaignId: string): Promise<AtorDaCampanha[]> {
  const demonstracao: AtorDaCampanha[] = [
    {
      id: "72000000-0000-4000-8000-000000000007",
      nome: "Rivaldo",
      tipo: "Entidade",
      descricao: "O Revide",
      cor: "#8b1e2d",
      estado: "Ativo",
      visibilidade: "Somente mestres",
      naCena: false,
    },
    {
      id: "72000000-0000-4000-8000-000000000008",
      nome: "Facilitador",
      tipo: "Narrador",
      descricao: "A Regra É Clara",
      cor: "#8b5cf6",
      estado: "Ativo",
      visibilidade: "Somente mestres",
      naCena: false,
    },
    {
      id: "72000000-0000-4000-8000-000000000009",
      nome: "Zona 7",
      tipo: "Ambiente",
      descricao: "Realidade paranormal ativa",
      cor: "#5d6268",
      estado: "Ativo",
      visibilidade: "Somente mestres",
      naCena: false,
    },
  ];
  if (!isSupabaseConfigured) return demonstracao;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("actors")
    .select(
      "id,name,actor_type,public_description,color,state,visibility,public_portrait_path,scene_tokens(id,visible,scene_id)",
    )
    .eq("campaign_id", campaignId)
    .neq("actor_type", "player_character")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Falha ao carregar atores: ${error.message}`);
  return Promise.all(
    data.map(async (ator) => {
      const portrait = ator.public_portrait_path
        ? await supabase.storage
            .from("actor-portraits")
            .createSignedUrl(ator.public_portrait_path, 3600)
        : null;
      return {
        id: ator.id,
        nome: ator.name,
        tipo: actorTypeLabels[ator.actor_type] ?? ator.actor_type,
        descricao: ator.public_description ?? "",
        cor: ator.color,
        estado: statusLabels[ator.state] ?? ator.state,
        visibilidade: visibilityLabels[ator.visibility] ?? ator.visibility,
        portraitUrl: portrait?.data?.signedUrl,
        naCena: ator.scene_tokens.length > 0,
        tokenId: ator.scene_tokens[0]?.id,
        tokenVisivel: ator.scene_tokens[0]?.visible,
      };
    }),
  );
}

export async function getCenaPrincipal(
  campaignId: string,
  sceneId?: string | null,
): Promise<CenaDaCampanha> {
  const demonstracao: CenaDaCampanha = {
    id: "73000000-0000-4000-8000-000000000001",
    nome: "Estúdio dos Sete Segundos",
    descricao: "Clique no mapa para mover o token selecionado.",
    estado: "Publicada",
    modoGrade: "Quadrada",
    tokens: characters.map((personagem, indice) => ({
      id: `73200000-0000-4000-8000-00000000000${indice + 1}`,
      atorId: `72000000-0000-4000-8000-00000000000${indice + 1}`,
      characterId: personagem.id,
      actorType: "player_character",
      nome: personagem.name.split(" ")[0] ?? personagem.name,
      cor: ["#b8323c", "#e2b341", "#8f74c8", "#57a773", "#3c8dff", "#7f1d2d"][indice] ?? "#fff",
      x: [0.18, 0.34, 0.48, 0.61, 0.78, 0.86][indice] ?? 0.5,
      y: [0.35, 0.62, 0.28, 0.58, 0.38, 0.7][indice] ?? 0.5,
      zIndex: indice + 1,
      visivel: true,
    })),
    connections: [],
  };
  if (!isSupabaseConfigured) return demonstracao;
  const supabase = await createClient();
  let query = supabase
    .from("game_scenes")
    .select(
      "id,name,description,state,grid_type,media_assets!game_scenes_map_asset_id_fkey(storage_bucket,storage_path),scene_tokens(id,actor_id,item_id,label,x,y,z_index,visible,actors(color,character_id,actor_type,public_portrait_path,characters(character_state)),items(name,image_path))",
    )
    .eq("campaign_id", campaignId)
    .is("deleted_at", null);
  query = sceneId ? query.eq("id", sceneId) : query.order("created_at").limit(1);
  const { data, error } = await query.single();
  if (error) throw new Error(`Falha ao carregar cena: ${error.message}`);
  const media = data.media_assets as unknown as {
    storage_bucket: string;
    storage_path: string;
  } | null;
  const signed = media
    ? await supabase.storage.from(media.storage_bucket).createSignedUrl(media.storage_path, 3600)
    : null;
  const rawTokens = data.scene_tokens as unknown as Array<{
    id: string;
    actor_id: string | null;
    item_id: string | null;
    label: string;
    x: number;
    y: number;
    z_index: number;
    visible: boolean;
    actors: {
      color: string;
      character_id: string | null;
      actor_type: string;
      public_portrait_path: string | null;
      characters: { character_state: string | null } | null;
    } | null;
    items: { name: string; image_path: string | null } | null;
  }>;
  const visibleActorIds = rawTokens.flatMap((token) => (token.actor_id ? [token.actor_id] : []));
  const visibleItemIds = rawTokens.flatMap((token) => (token.item_id ? [token.item_id] : []));
  const privilegedReader = isAdminConfigured ? createAdminClient() : null;
  const [actorDetails, itemDetails] = await Promise.all([
    privilegedReader && visibleActorIds.length > 0
      ? privilegedReader
          .from("actors")
          .select(
            "id,color,character_id,actor_type,public_portrait_path,characters(character_state)",
          )
          .eq("campaign_id", campaignId)
          .in("id", visibleActorIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
    privilegedReader && visibleItemIds.length > 0
      ? privilegedReader
          .from("items")
          .select("id,name,image_path")
          .eq("campaign_id", campaignId)
          .in("id", visibleItemIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (actorDetails.error)
    throw new Error(`Falha ao carregar imagens dos atores visíveis: ${actorDetails.error.message}`);
  if (itemDetails.error)
    throw new Error(`Falha ao carregar imagens dos itens visíveis: ${itemDetails.error.message}`);
  const actorsById = new Map((actorDetails.data ?? []).map((actor) => [actor.id, actor]));
  const itemsById = new Map((itemDetails.data ?? []).map((item) => [item.id, item]));
  const storageReader = privilegedReader ?? supabase;
  const tokens = await Promise.all(
    rawTokens.map(async (token) => {
      const actor = (token.actor_id ? actorsById.get(token.actor_id) : undefined) ?? token.actors;
      const item = (token.item_id ? itemsById.get(token.item_id) : undefined) ?? token.items;
      const actorCharacter = Array.isArray(actor?.characters)
        ? actor.characters[0]
        : actor?.characters;
      const portrait = actor?.public_portrait_path
        ? await storageReader.storage
            .from(actor.character_id ? "portraits" : "actor-portraits")
            .createSignedUrl(actor.public_portrait_path, 3600)
        : null;
      const itemImage = item?.image_path
        ? await storageReader.storage.from("handouts-public").createSignedUrl(item.image_path, 3600)
        : null;
      return {
        id: token.id,
        atorId: token.actor_id ?? undefined,
        itemId: token.item_id ?? undefined,
        characterId: actor?.character_id ?? undefined,
        actorType: actor?.actor_type,
        characterState: actorCharacter?.character_state ?? undefined,
        portraitUrl: portrait?.data?.signedUrl,
        portraitKey: actor?.public_portrait_path ?? undefined,
        itemImageUrl: itemImage?.data?.signedUrl,
        itemImageKey: item?.image_path ?? undefined,
        nome: item?.name ?? token.label,
        cor: item ? "#d9b76f" : (actor?.color ?? "#ffffff"),
        x: Number(token.x),
        y: Number(token.y),
        zIndex: token.z_index,
        visivel: token.visible,
      };
    }),
  );
  return {
    id: data.id,
    nome: data.name,
    descricao: data.description ?? "",
    estado: data.state,
    modoGrade: gridTypeLabels[String(data.grid_type)] ?? String(data.grid_type),
    backgroundUrl: signed?.data?.signedUrl,
    backgroundKey: media ? `${media.storage_bucket}/${media.storage_path}` : undefined,
    tokens,
    connections: [],
  };
}

export async function getRoteiros(campaignId: string): Promise<RoteiroDaCampanha[]> {
  if (!isSupabaseConfigured)
    return [
      {
        id: "74000000-0000-4000-8000-000000000001",
        nome: "Sete Segundos Antes",
        descricao: "Roteiro inicial com duas ramificações.",
        estado: "Publicado",
        versao: 1,
      },
    ];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("script_packages")
    .select(
      "id,name,description,state,script_versions!script_versions_script_package_id_fkey(version_number)",
    )
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar roteiros: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      name: string;
      description: string | null;
      state: string;
      script_versions: Array<{ version_number: number }>;
    }>
  ).map((roteiro) => ({
    id: roteiro.id,
    nome: roteiro.name,
    descricao: roteiro.description ?? "",
    estado: roteiro.state,
    versao: Math.max(0, ...roteiro.script_versions.map((versao) => versao.version_number)),
  }));
}
