import "server-only";

import { cache } from "react";
import { getCurrentUser, roleCanAccess } from "@/lib/auth/session";
import { isSupabaseConfigured } from "@/lib/config";
import { characters as demoCharacters } from "@/lib/demo-data";
import { abilities as demoAbilities, messages as demoMessages } from "@/lib/demo-data";
import { createClient } from "@/lib/supabase/server";
import type { AbilitySummary, CharacterSummary, ResourceKind } from "@/types/domain";

type CharacterRow = {
  id: string;
  campaign_id?: string;
  name: string;
  codename: string | null;
  pronouns: string | null;
  origin: string | null;
  class_name: string | null;
  path_name: string | null;
  narrative_status: string | null;
  team_role: string | null;
  affinities: string[] | null;
  short_description: string | null;
  tagline: string | null;
  public_history: string | null;
  character_state: string | null;
  identification_color: string | null;
  nex: number;
  defense: number;
  block_value: number | null;
  dodge_value: number | null;
  movement: number;
  main_dc: number | null;
  pe_per_turn: number | null;
  version: number;
  portrait_path: string | null;
  character_attributes: {
    agility: number;
    strength: number;
    intellect: number;
    presence: number;
    vigor: number;
    fortitude: number;
    reflexes: number;
    willpower: number;
  } | null;
  character_resources: {
    resource: ResourceKind;
    current_value: number;
    maximum_value: number;
  }[];
  character_meter_values: {
    current_value: number;
    custom_meter_definitions: { name: string; stages: string[] } | null;
  }[];
  character_conditions: {
    removed_at: string | null;
    condition_definitions: { name: string } | null;
  }[];
  character_sheet_settings: {
    visible_fields: string[];
    visible_sections: string[];
  } | null;
};

function mapCharacter(row: CharacterRow, portraitUrl?: string): CharacterSummary {
  const resource = (kind: ResourceKind) => {
    const value = row.character_resources.find((item) => item.resource === kind);
    return { kind, current: value?.current_value ?? 0, maximum: value?.maximum_value ?? 0 };
  };
  const meter = row.character_meter_values[0];
  return {
    id: row.id,
    campaignId: row.campaign_id,
    name: row.name,
    codename: row.codename ?? undefined,
    pronouns: row.pronouns ?? undefined,
    origin: row.origin ?? "Não informada",
    className: row.class_name ?? "Não informada",
    path: row.path_name ?? "Não informada",
    status: row.narrative_status ?? "sem estado",
    role: row.team_role ?? "sobrevivente",
    affinities: row.affinities ?? [],
    shortDescription: row.short_description ?? undefined,
    tagline: row.tagline ?? undefined,
    publicHistory: row.public_history ?? undefined,
    characterState: row.character_state ?? "active",
    identificationColor: row.identification_color ?? "#b52532",
    nex: row.nex,
    defense: row.defense,
    blockValue: row.block_value ?? 0,
    dodgeValue: row.dodge_value ?? 0,
    movement: Number(row.movement),
    mainDc: row.main_dc ?? undefined,
    pePerTurn: row.pe_per_turn ?? 0,
    version: row.version,
    portraitUrl,
    resources: { pv: resource("pv"), pe: resource("pe"), san: resource("san") },
    attributes: {
      agi: row.character_attributes?.agility ?? 1,
      for: row.character_attributes?.strength ?? 1,
      int: row.character_attributes?.intellect ?? 1,
      pre: row.character_attributes?.presence ?? 1,
      vig: row.character_attributes?.vigor ?? 1,
    },
    resistances: {
      fortitude: row.character_attributes?.fortitude ?? 0,
      reflexes: row.character_attributes?.reflexes ?? 0,
      willpower: row.character_attributes?.willpower ?? 0,
    },
    meter: {
      name: meter?.custom_meter_definitions?.name ?? "Medidor",
      value: meter?.current_value ?? 0,
      stages: meter?.custom_meter_definitions?.stages ?? ["Estável"],
    },
    conditions: row.character_conditions
      .filter((condition) => condition.removed_at === null)
      .flatMap((condition) =>
        condition.condition_definitions?.name ? [condition.condition_definitions.name] : [],
      ),
    sheetVisibility: row.character_sheet_settings
      ? {
          fields: row.character_sheet_settings.visible_fields,
          sections: row.character_sheet_settings.visible_sections,
        }
      : undefined,
  };
}

const select = `
  id,campaign_id,name,codename,pronouns,origin,class_name,path_name,narrative_status,team_role,affinities,short_description,tagline,public_history,character_state,identification_color,nex,defense,block_value,dodge_value,movement,main_dc,pe_per_turn,version,portrait_path,
  character_attributes(agility,strength,intellect,presence,vigor,fortitude,reflexes,willpower),
  character_resources(resource,current_value,maximum_value),
  character_meter_values(current_value,custom_meter_definitions(name,stages)),
  character_conditions(removed_at,condition_definitions(name)),
  character_sheet_settings(visible_fields,visible_sections)
`;

async function mapCharactersWithPortraits(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: CharacterRow[],
) {
  return Promise.all(
    rows.map(async (row) => {
      if (!row.portrait_path) return mapCharacter(row);
      const { data } = await supabase.storage
        .from("portraits")
        .createSignedUrl(row.portrait_path, 3600);
      return mapCharacter(row, data?.signedUrl);
    }),
  );
}

export async function getCampaignCharacters(campaignId: string) {
  if (!isSupabaseConfigured) return demoCharacters;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("characters")
    .select(select)
    .eq("campaign_id", campaignId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Falha ao carregar personagens: ${error.message}`);
  return mapCharactersWithPortraits(supabase, data as unknown as CharacterRow[]);
}

export async function getSessionCharacters(campaignId: string, sessionId: string) {
  if (!isSupabaseConfigured) return demoCharacters;
  const supabase = await createClient();
  const { data: participants, error: participantError } = await supabase
    .from("session_participants")
    .select("character_id")
    .eq("campaign_id", campaignId)
    .eq("session_id", sessionId)
    .not("character_id", "is", null);
  if (participantError)
    throw new Error(`Falha ao carregar participantes da sessão: ${participantError.message}`);
  const characterIds = [...new Set(participants.flatMap((item) => item.character_id ? [item.character_id] : []))];
  if (characterIds.length === 0) return [];
  const { data, error } = await supabase
    .from("characters")
    .select(select)
    .eq("campaign_id", campaignId)
    .in("id", characterIds)
    .is("deleted_at", null)
    .order("name");
  if (error) throw new Error(`Falha ao carregar personagens da sessão: ${error.message}`);
  return mapCharactersWithPortraits(supabase, data as unknown as CharacterRow[]);
}

async function loadAuthorizedCharacters() {
  if (!isSupabaseConfigured) return demoCharacters;
  const supabase = await createClient();
  const user = await getCurrentUser("player");
  if (!user) return [];
  const { data: owners, error: ownerError } = await supabase
    .from("character_owners")
    .select("character_id,campaign_id")
    .eq("user_id", user.id)
    .not("confirmed_at", "is", null);
  if (ownerError) throw new Error(`Falha ao localizar fichas vinculadas: ${ownerError.message}`);
  const rows = await Promise.all(
    owners.map(async ({ character_id, campaign_id }) => {
      const { data, error } = await supabase.rpc("get_player_character_sheet", {
        p_character_id: character_id,
      });
      if (error) throw new Error(`Falha ao carregar ficha autorizada: ${error.message}`);
      return { ...(data as unknown as CharacterRow), campaign_id };
    }),
  );
  return mapCharactersWithPortraits(supabase, rows);
}

export const getAuthorizedCharacters = cache(loadAuthorizedCharacters);

export async function getAuthorizedCharacter(characterId: string) {
  if (!isSupabaseConfigured) {
    return demoCharacters.find((character) => character.id === characterId) ?? demoCharacters[0];
  }
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (user && roleCanAccess(user.role, "master")) {
    const { data, error } = await supabase
      .from("characters")
      .select(select)
      .eq("id", characterId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar ficha: ${error.message}`);
    if (data) return (await mapCharactersWithPortraits(supabase, [data as unknown as CharacterRow]))[0];
  }
  const { data: protectedSheet, error: protectedError } = await supabase.rpc(
    "get_player_character_sheet",
    { p_character_id: characterId },
  );
  if (protectedError || !protectedSheet) return null;
  return (await mapCharactersWithPortraits(supabase, [protectedSheet as unknown as CharacterRow]))[0];
}

export async function getCharacterAbilities(characterId: string): Promise<AbilitySummary[]> {
  if (!isSupabaseConfigured)
    return demoAbilities.filter((ability) => ability.characterId === characterId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_abilities")
    .select(
      "id,state,character_id,public_override,abilities(id,name,public_description,action_type,costs,usage_limit,recommended_nex)",
    )
    .eq("character_id", characterId);
  if (error) throw new Error(`Falha ao carregar habilidades: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      state: AbilitySummary["state"];
      character_id: string;
      public_override: string | null;
      abilities: {
        id: string;
        name: string;
        public_description: string | null;
        action_type: string;
        costs: Partial<Record<ResourceKind, string>>;
        usage_limit: { scope?: string; count?: number } | null;
        recommended_nex: number;
      } | null;
    }>
  ).flatMap((link) =>
    link.abilities
      ? [
          {
            id: link.id,
            characterId: link.character_id,
            name: link.abilities.name,
            actionType: link.abilities.action_type,
            description: link.abilities.public_description ?? "Descrição ainda não revelada.",
            state: link.state,
            costs: link.abilities.costs ?? {},
            limit: link.abilities.usage_limit?.count
              ? `${link.abilities.usage_limit.count}/${link.abilities.usage_limit.scope ?? "cena"}`
              : undefined,
            recommendedNex: link.abilities.recommended_nex,
          },
        ]
      : link.state === "masked"
        ? [
            {
              id: link.id,
              characterId: link.character_id,
              name: "???",
              actionType: "Desconhecida",
              description: link.public_override ?? "Algo dentro de você ainda não despertou.",
              state: link.state,
              costs: {},
              limit: undefined,
              recommendedNex: 0,
            },
          ]
        : [],
  );
}

export async function getCharacterInventory(characterId: string) {
  if (!isSupabaseConfigured) {
    return [
      { id: "lanterna", name: "Lanterna tática", detail: "3 cargas", state: "equipado" },
      { id: "kit", name: "Kit de primeiros socorros", detail: "1 uso", state: "íntegro" },
      { id: "lente", name: "Lente rachada", detail: "informação oculta", state: "corrompido" },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_items")
    .select("id,quantity,charges,ammunition,state,items(name)")
    .eq("character_id", characterId);
  if (error) throw new Error(`Falha ao carregar inventário: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      quantity: number;
      charges: number | null;
      ammunition: number | null;
      state: string | null;
      items: { name: string } | null;
    }>
  ).map((item) => ({
    id: item.id,
    name: item.items?.name ?? "Item",
    detail: item.charges !== null ? `${item.charges} cargas` : `${item.quantity} unidade(s)`,
    state: item.state ?? "íntegro",
  }));
}

export async function getAuthorizedMessages() {
  if (!isSupabaseConfigured) return demoMessages;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id,apparent_sender_name,status,message_contents(body),message_recipients!inner(user_id)",
    )
    .eq("message_recipients.user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar mensagens: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      apparent_sender_name: string;
      status: string;
      message_contents: { body: string | null } | null;
    }>
  ).map((message) => ({
    id: message.id,
    sender: message.apparent_sender_name,
    body: message.message_contents?.body ?? "Conteúdo indisponível.",
    status: message.status,
    recipient: "Você",
  }));
}

export async function getAuthorizedHandouts() {
  if (!isSupabaseConfigured) {
    return [
      {
        id: "registro",
        title: "Registro 07-C",
        locked: false,
        excerpt: "A gravação começa antes do evento.",
        content: "Sete segundos foram removidos do arquivo original.",
      },
      {
        id: "mapa",
        title: "Mapa do corredor sem saída",
        locked: false,
        excerpt: "Uma rota marcada a lápis.",
        content: "A saída muda quando ninguém está olhando.",
      },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("handouts")
    .select("id,title,state,public_excerpt,handout_contents(protected_text)")
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar pistas: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      title: string;
      state: string;
      public_excerpt: string | null;
      handout_contents: { protected_text: string | null } | null;
    }>
  ).map((handout) => ({
    id: handout.id,
    title: handout.title,
    locked: handout.state === "hidden",
    excerpt: handout.public_excerpt ?? "Pista recebida durante a sessão.",
    content: handout.handout_contents?.protected_text ?? "",
  }));
}

export type PlayerNotification = {
  id: string;
  type: string;
  title: string;
  preview: string;
  read: boolean;
  acknowledged: boolean;
  createdAt: string;
};

export async function getAuthorizedNotifications(): Promise<PlayerNotification[]> {
  if (!isSupabaseConfigured)
    return [
      {
        id: "demo-session-open",
        type: "session",
        title: "Sessão aberta",
        preview: "A transmissão impossível está no ar.",
        read: false,
        acknowledged: false,
        createdAt: new Date().toISOString(),
      },
    ];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,safe_preview,read_at,acknowledged_at,created_at")
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) throw new Error(`Falha ao carregar notificações: ${error.message}`);
  return data.map((item) => ({
    id: item.id,
    type: item.type,
    title: item.title,
    preview: item.safe_preview,
    read: Boolean(item.read_at),
    acknowledged: Boolean(item.acknowledged_at),
    createdAt: item.created_at,
  }));
}

const demoSkills: Record<
  string,
  Array<{ id: string; name: string; attribute: string; bonus: number; training: string }>
> = {
  davi: [
    "Diplomacia",
    "Enganação",
    "Intuição",
    "Artes",
    "Atualidades",
    "Intimidação",
    "Percepção",
    "Reflexos",
    "Tecnologia",
    "Vontade",
  ].map((name, index) => ({
    id: `davi-skill-${index}`,
    name,
    attribute:
      ["PRE", "PRE", "PRE", "PRE", "INT", "PRE", "PRE", "AGI", "INT", "PRE"][index] ?? "INT",
    bonus: index < 5 || index === 9 ? 10 : 5,
    training: index < 5 || index === 9 ? "Veterano" : "Treinado",
  })),
  magnus: [
    "Luta",
    "Investigação",
    "Intuição",
    "Percepção",
    "Fortitude",
    "Reflexos",
    "Atletismo",
    "Iniciativa",
    "Crime",
    "Vontade",
  ].map((name, index) => ({
    id: `magnus-skill-${index}`,
    name,
    attribute:
      ["FOR", "INT", "PRE", "PRE", "VIG", "AGI", "FOR", "AGI", "AGI", "PRE"][index] ?? "INT",
    bonus: index < 6 ? 10 : 5,
    training: index < 6 ? "Veterano" : "Treinado",
  })),
  arya: [
    "Furtividade",
    "Crime",
    "Pontaria",
    "Artes",
    "Acrobacia",
    "Reflexos",
    "Iniciativa",
    "Percepção",
    "Intuição",
    "Enganação",
  ].map((name, index) => ({
    id: `arya-skill-${index}`,
    name,
    attribute: index < 3 || (index >= 4 && index <= 6) ? "AGI" : "PRE",
    bonus: index < 8 ? 10 : 5,
    training: index < 8 ? "Veterano" : "Treinado",
  })),
  lize: [
    "Medicina",
    "Ciências",
    "Intuição",
    "Investigação",
    "Ocultismo",
    "Vontade",
    "Diplomacia",
    "Percepção",
    "Reflexos",
    "Tecnologia",
  ].map((name, index) => ({
    id: `lize-skill-${index}`,
    name,
    attribute:
      ["INT", "INT", "PRE", "INT", "INT", "PRE", "PRE", "PRE", "AGI", "INT"][index] ?? "INT",
    bonus: index < 6 ? 10 : 5,
    training: index < 6 ? "Veterano" : "Treinado",
  })),
  amber: [
    "Pontaria",
    "Tática",
    "Investigação",
    "Percepção",
    "Fortitude",
    "Reflexos",
    "Iniciativa",
    "Sobrevivência",
    "Tecnologia",
    "Vontade",
  ].map((name, index) => ({
    id: `amber-skill-${index}`,
    name,
    attribute:
      ["AGI", "INT", "INT", "PRE", "VIG", "AGI", "AGI", "INT", "INT", "PRE"][index] ?? "INT",
    bonus: index < 7 ? 10 : 5,
    training: index < 7 ? "Veterano" : "Treinado",
  })),
  gragas: [
    "Luta",
    "Pontaria",
    "Fortitude",
    "Reflexos",
    "Vontade",
    "Atletismo",
    "Iniciativa",
    "Sobrevivência",
  ].map((name, index) => ({
    id: `gragas-skill-${index}`,
    name,
    attribute: ["FOR", "AGI", "VIG", "AGI", "PRE", "FOR", "AGI", "INT"][index] ?? "FOR",
    bonus: [10, 10, 10, 5, 5, 10, 5, 5][index] ?? 5,
    training: index < 3 || index === 5 ? "Veterano" : "Treinado",
  })),
};

const demoActions: Record<
  string,
  Array<{ id: string; name: string; test: string; damage: string; range: string; type: string }>
> = {
  davi: [
    {
      id: "pistola",
      name: "Pistola leve",
      test: "1d20+5",
      damage: "1d12",
      range: "Curto",
      type: "Balístico",
    },
    {
      id: "faca",
      name: "Faca",
      test: "1d20",
      damage: "1d4+1",
      range: "Corpo a corpo",
      type: "Corte",
    },
    {
      id: "improviso",
      name: "Improviso",
      test: "1d20",
      damage: "1d6+1",
      range: "Corpo a corpo",
      type: "Impacto",
    },
    {
      id: "pulso",
      name: "Pulso da Lente",
      test: "4d20+10",
      damage: "2d6",
      range: "Audiência 3+",
      type: "Mental",
    },
  ],
  magnus: [
    {
      id: "golpe",
      name: "Golpe técnico",
      test: "3d20+10",
      damage: "1d8+3",
      range: "Corpo a corpo",
      type: "Impacto",
    },
    {
      id: "chute",
      name: "Chute lateral",
      test: "3d20+10",
      damage: "1d10+3",
      range: "Corpo a corpo",
      type: "Impacto",
    },
    {
      id: "bastao",
      name: "Bastão retrátil",
      test: "3d20+10",
      damage: "1d6+3",
      range: "Corpo a corpo",
      type: "Impacto",
    },
    {
      id: "interrupcao",
      name: "Interrupção Precisa",
      test: "3d20+12",
      damage: "2d8+3",
      range: "Alvo analisado",
      type: "Reação",
    },
  ],
  arya: [
    {
      id: "pistola",
      name: "Pistola silenciada",
      test: "4d20+10",
      damage: "1d12",
      range: "Curto",
      type: "Balístico",
    },
    {
      id: "adaga",
      name: "Adaga",
      test: "4d20+10",
      damage: "1d4+1",
      range: "Corpo a corpo",
      type: "Corte",
    },
    {
      id: "agulha",
      name: "Agulha de tatuagem",
      test: "4d20+10",
      damage: "1d6+1",
      range: "Corpo a corpo",
      type: "Perfuração",
    },
    {
      id: "furtivo",
      name: "Ataque furtivo",
      test: "4d20+10",
      damage: "+3d6",
      range: "Alvo desprevenido",
      type: "Adicional",
    },
  ],
  lize: [
    {
      id: "pistola",
      name: "Pistola compacta",
      test: "1d20+5",
      damage: "1d12",
      range: "Curto",
      type: "Balístico",
    },
    {
      id: "bisturi",
      name: "Bisturi",
      test: "1d20+5",
      damage: "1d4+1",
      range: "Corpo a corpo",
      type: "Corte",
    },
    {
      id: "sedacao",
      name: "Sedação de urgência",
      test: "4d20+10",
      damage: "Especial",
      range: "Toque",
      type: "Fortitude DT 20",
    },
    {
      id: "incisao",
      name: "Incisão de memória",
      test: "4d20+10",
      damage: "2d6",
      range: "Curto",
      type: "Mental",
    },
  ],
  amber: [
    {
      id: "fuzil",
      name: "Fuzil de assalto",
      test: "3d20+10",
      damage: "2d10",
      range: "Médio",
      type: "Balístico",
    },
    {
      id: "pistola",
      name: "Pistola de serviço",
      test: "3d20+10",
      damage: "1d12",
      range: "Curto",
      type: "Balístico",
    },
    {
      id: "faca",
      name: "Faca de campanha",
      test: "1d20+5",
      damage: "1d4+1",
      range: "Corpo a corpo",
      type: "Corte",
    },
    {
      id: "supressao",
      name: "Fogo de supressão",
      test: "3d20+10",
      damage: "2d10",
      range: "Cone",
      type: "Controle",
    },
  ],
  gragas: [
    {
      id: "metralhadora",
      name: "Metralhadora de apoio",
      test: "2d20+10",
      damage: "2d10+5",
      range: "Médio",
      type: "Balístico",
    },
    {
      id: "faca-combate",
      name: "Faca de combate",
      test: "3d20+10",
      damage: "1d4+3",
      range: "Corpo a corpo",
      type: "Corte",
    },
    {
      id: "punhos",
      name: "Punhos",
      test: "3d20+10",
      damage: "1d6+3",
      range: "Corpo a corpo",
      type: "Impacto",
    },
    {
      id: "golpe-rivaldo",
      name: "Golpe de Rivaldo",
      test: "3d20+12",
      damage: "2d8+3",
      range: "Controle 3+",
      type: "Sangue",
    },
  ],
};

const demoWeaknessList = (characterId: string, entries: Array<[string, string]>) =>
  entries.map(([name, effect], index) => ({
    id: `${characterId}-weakness-${index + 1}`,
    name,
    effect,
    active: true,
  }));

const demoWeaknesses: Record<
  string,
  Array<{ id: string; name: string; effect: string; active: boolean }>
> = {
  davi: demoWeaknessList("davi", [
    ["Imagem Distorcida", "Falhas sociais preservam a pior interpretação."],
    ["Sempre Observado", "O Facilitador pode localizar Davi."],
    ["Sem Audiência", "Poderes narrativos sofrem -1d20 sem observadores."],
    ["Vontade sem Culpa", "Confissão não reduz Audiência."],
    ["Gragas Contradiz", "Poderes custam +1 PE na presença de Gragas."],
    ["Lente-Conduto", "O Facilitador pode impor uma regra curta."],
  ]),
  magnus: demoWeaknessList("magnus", [
    ["Ação Imprevisível", "Vontade DT 20 quando um aliado rompe o padrão."],
    ["Comando Paterno", "Ordens de punição podem retirar a reação."],
    ["Mapa do Estranho", "Rotas desconhecidas exigem referência física."],
    ["Rotina como Âncora", "Interromper o tratamento reduz a recuperação de SAN."],
    ["Excesso de Análise", "Um alvo sem padrão deixa de estar analisado."],
    ["Pai Dentro do Vidro", "Reflexos podem apresentar pistas falsas."],
  ]),
  arya: demoWeaknessList("arya", [
    ["Desconfiança Absoluta", "A primeira ajuda de cada aliado precisa ser verificada."],
    ["Dor do Marcado", "Críticos sofridos pelo marcado custam SAN."],
    ["Marca Revertida", "Traição inverte o rastreio."],
    ["Pedido de Socorro", "Recusar ajuda aprofunda a Marca."],
    ["Tinta Vulnerável", "Água, solvente e Energia apagam marcas."],
    ["Agulha Quer um Corpo", "A última saída pode deixar de ser escolha."],
  ]),
  lize: demoWeaknessList("lize", [
    ["A Dor Permanece", "Depois do segundo Compartimentar, Vontade DT 20."],
    ["Empatia Removida", "Ajudar sem explicação sofre -1d20."],
    ["Voz Contaminada", "A própria voz pode implantar memória falsa."],
    ["Compulsão Clínica", "Lize precisa tentar estabilizar quem está morrendo."],
    ["Procedimento Verbal", "Silêncio paranormal bloqueia procedimentos."],
    ["Identidade Arquivada", "O Gravador pode substituir uma memória."],
  ]),
  amber: demoWeaknessList("amber", [
    ["Mapa Não Confirmado", "Linha Segura exige um Marco confirmado."],
    ["Voz de Thompson", "A voz de Thompson pode retirar a reação."],
    ["Fé na Instituição", "Documento oficial falso aumenta Ruptura."],
    ["Pessoas sem Registro", "Ignorar um civil apagado aumenta Ruptura."],
    ["Comando Depende de Voz", "Silêncio bloqueia habilidades de comando."],
    ["Responsabilidade Reescrita", "O Arquivo atribui a Amber uma ação alheia."],
  ]),
  gragas: demoWeaknessList("gragas", [
    ["Responsabilidade Sincera", "Assumir a decisão reduz Controle."],
    ["Misericórdia Deliberada", "Poupar um alvo reduz Controle."],
    ["Memória dos Oito Segundos", "A ordem de fogo pode retirar a reação."],
    ["Consciência Compartilhada", "Dano mental atinge as duas consciências."],
    ["Verdade sobre o Facilitador", "Provas enfraquecem a Proteção do Rancor."],
    ["Custo do Retorno", "Em 0 SAN Rivaldo assume o corpo."],
  ]),
};

export async function getCharacterSkills(characterId: string) {
  if (!isSupabaseConfigured)
    return (demoSkills[characterId] ?? demoSkills.davi ?? []).map((skill) => ({
      ...skill,
      notes: "",
    }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_skills")
    .select("id,name,related_attribute,bonus,training_degree,notes")
    .eq("character_id", characterId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(`Falha ao carregar perícias: ${error.message}`);
  return data.map((skill) => ({
    id: skill.id,
    name: skill.name,
    attribute: (skill.related_attribute ?? "").toUpperCase(),
    bonus: skill.bonus,
    training: skill.training_degree,
    notes: skill.notes ?? "",
  }));
}

export async function getCharacterActions(characterId: string) {
  if (!isSupabaseConfigured)
    return (demoActions[characterId] ?? demoActions.davi ?? []).map((action) => ({
      ...action,
      description: "",
    }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attacks")
    .select("id,name,attack_formula,damage_formula,range_text,damage_type,description")
    .eq("character_id", characterId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(`Falha ao carregar ações: ${error.message}`);
  return data.map((action) => ({
    id: action.id,
    name: action.name,
    test: action.attack_formula,
    damage: action.damage_formula,
    range: action.range_text ?? "—",
    type: action.damage_type ?? "—",
    description: action.description ?? "",
  }));
}

export async function getCharacterWeaknesses(characterId: string) {
  if (!isSupabaseConfigured) return demoWeaknesses[characterId] ?? demoWeaknesses.davi ?? [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_weaknesses")
    .select("id,name,mechanical_effect,is_active")
    .eq("character_id", characterId)
    .eq("is_active", true)
    .is("deleted_at", null)
    .order("sort_order");
  if (error) throw new Error(`Falha ao carregar fraquezas: ${error.message}`);
  return data.map((weakness) => ({
    id: weakness.id,
    name: weakness.name,
    effect: weakness.mechanical_effect,
    active: weakness.is_active,
  }));
}

export type SessionCharacterDetails = {
  characterId: string;
  inventory: Awaited<ReturnType<typeof getCharacterInventory>>;
  abilities: Awaited<ReturnType<typeof getCharacterAbilities>>;
  skills: Awaited<ReturnType<typeof getCharacterSkills>>;
  actions: Awaited<ReturnType<typeof getCharacterActions>>;
  weaknesses: Awaited<ReturnType<typeof getCharacterWeaknesses>>;
};

export async function getSessionCharacterDetails(
  characterIds: string[],
): Promise<SessionCharacterDetails[]> {
  return Promise.all(
    characterIds.map(async (characterId) => {
      const [inventory, abilities, skills, actions, weaknesses] = await Promise.all([
        getCharacterInventory(characterId),
        getCharacterAbilities(characterId),
        getCharacterSkills(characterId),
        getCharacterActions(characterId),
        getCharacterWeaknesses(characterId),
      ]);
      return { characterId, inventory, abilities, skills, actions, weaknesses };
    }),
  );
}
