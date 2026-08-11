import "server-only";

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
};

export type CenaDaCampanha = {
  id: string;
  nome: string;
  descricao: string;
  estado: string;
  modoGrade: string;
  backgroundUrl?: string;
  tokens: Array<{
    id: string;
    atorId: string;
    characterId?: string;
    actorType?: string;
    portraitUrl?: string;
    nome: string;
    cor: string;
    x: number;
    y: number;
    visivel: boolean;
  }>;
};

export type RoteiroDaCampanha = {
  id: string;
  nome: string;
  descricao: string;
  estado: string;
  versao: number;
};

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

export async function getContasDaCampanha(campaignId: string): Promise<ContaDaCampanha[]> {
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
    }));
  }
  if (!isAdminConfigured) {
    throw new Error(
      "A chave de serviço do Supabase é necessária para consultar os e-mails com segurança.",
    );
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("campaign_members")
    .select("id,user_id,role,status,profiles(display_name)")
    .eq("campaign_id", campaignId)
    .order("created_at");
  if (error) throw new Error(`Falha ao carregar membros: ${error.message}`);
  const { data: vinculos, error: vinculosError } = await supabase
    .from("character_owners")
    .select("user_id,characters(name)")
    .eq("campaign_id", campaignId);
  if (vinculosError) throw new Error(`Falha ao carregar vínculos: ${vinculosError.message}`);
  const admin = createAdminClient();
  return Promise.all(
    (
      data as unknown as Array<{
        id: string;
        user_id: string;
        role: string;
        status: string;
        profiles: { display_name: string } | null;
      }>
    ).map(async (membro) => {
      const { data: authData } = await admin.auth.admin.getUserById(membro.user_id);
      const personagem = (
        vinculos as unknown as Array<{
          user_id: string;
          characters: { name: string } | null;
        }>
      ).find((vinculo) => vinculo.user_id === membro.user_id)?.characters?.name;
      return {
        membroId: membro.id,
        usuarioId: membro.user_id,
        nome: membro.profiles?.display_name ?? "Participante",
        email: authData.user?.email ?? "E-mail indisponível",
        papel: roleLabels[membro.role] ?? membro.role,
        situacao: statusLabels[membro.status] ?? membro.status,
        ultimoAcesso: authData.user?.last_sign_in_at ?? null,
        personagem: personagem ?? null,
      };
    }),
  );
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
    .select("id,name,actor_type,public_description,color,state,visibility,public_portrait_path,scene_tokens(id)")
    .eq("campaign_id", campaignId)
    .neq("actor_type", "player_character")
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Falha ao carregar atores: ${error.message}`);
  return Promise.all(data.map(async (ator) => {
    const portrait = ator.public_portrait_path
      ? await supabase.storage.from("actor-portraits").createSignedUrl(ator.public_portrait_path, 3600)
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
    };
  }));
}

export async function getCenaPrincipal(campaignId: string): Promise<CenaDaCampanha> {
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
      visivel: true,
    })),
  };
  if (!isSupabaseConfigured) return demonstracao;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_scenes")
    .select(
      "id,name,description,state,grid_type,media_assets!game_scenes_map_asset_id_fkey(storage_bucket,storage_path),scene_tokens(id,actor_id,label,x,y,visible,actors(color,character_id,actor_type,public_portrait_path))",
    )
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("created_at")
    .limit(1)
    .single();
  if (error) throw new Error(`Falha ao carregar cena: ${error.message}`);
  const media = data.media_assets as unknown as {
    storage_bucket: string;
    storage_path: string;
  } | null;
  const signed = media
    ? await supabase.storage.from(media.storage_bucket).createSignedUrl(media.storage_path, 3600)
    : null;
  const tokens = await Promise.all(
    (
      data.scene_tokens as unknown as Array<{
        id: string;
        actor_id: string;
        label: string;
        x: number;
        y: number;
        visible: boolean;
        actors: {
          color: string;
          character_id: string | null;
          actor_type: string;
          public_portrait_path: string | null;
        } | null;
      }>
    ).map(async (token) => {
      const portrait = token.actors?.public_portrait_path
        ? await supabase.storage.from(token.actors.character_id ? "portraits" : "actor-portraits").createSignedUrl(token.actors.public_portrait_path, 3600)
        : null;
      return {
        id: token.id,
        atorId: token.actor_id,
        characterId: token.actors?.character_id ?? undefined,
        actorType: token.actors?.actor_type,
        portraitUrl: portrait?.data?.signedUrl,
        nome: token.label,
        cor: token.actors?.color ?? "#ffffff",
        x: Number(token.x),
        y: Number(token.y),
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
    tokens,
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
    .select("id,name,description,state,script_versions(version_number)")
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
