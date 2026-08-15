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

function mapCharacter(
  row: CharacterRow,
  portraitUrl?: string,
  mapPortraitUrl?: string,
): CharacterSummary {
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
    mapPortraitUrl,
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
  const characterIds = rows.map((row) => row.id);
  const { data: actors } = characterIds.length
    ? await supabase
        .from("actors")
        .select("character_id,map_portrait_path")
        .in("character_id", characterIds)
        .is("deleted_at", null)
    : { data: [] };
  const mapPortraitByCharacter = new Map(
    (actors ?? []).flatMap((actor) =>
      actor.character_id && actor.map_portrait_path
        ? [[actor.character_id, actor.map_portrait_path] as const]
        : [],
    ),
  );
  return Promise.all(
    rows.map(async (row) => {
      const mapPortraitPath = mapPortraitByCharacter.get(row.id);
      const [portrait, mapPortrait] = await Promise.all([
        row.portrait_path
          ? supabase.storage.from("portraits").createSignedUrl(row.portrait_path, 3600)
          : Promise.resolve(null),
        mapPortraitPath
          ? supabase.storage.from("actor-portraits").createSignedUrl(mapPortraitPath, 3600)
          : Promise.resolve(null),
      ]);
      return mapCharacter(
        row,
        portrait?.data?.signedUrl,
        mapPortrait?.data?.signedUrl,
      );
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
    .eq("status", "online")
    .gte("last_seen_at", new Date(Date.now() - 60_000).toISOString())
    .not("character_id", "is", null);
  if (participantError)
    throw new Error(`Falha ao carregar participantes da sessão: ${participantError.message}`);
  const characterIds = [
    ...new Set(participants.flatMap((item) => (item.character_id ? [item.character_id] : []))),
  ];
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
    if (data)
      return (await mapCharactersWithPortraits(supabase, [data as unknown as CharacterRow]))[0];
  }
  const { data: protectedSheet, error: protectedError } = await supabase.rpc(
    "get_player_character_sheet",
    { p_character_id: characterId },
  );
  if (protectedError || !protectedSheet) return null;
  return (
    await mapCharactersWithPortraits(supabase, [protectedSheet as unknown as CharacterRow])
  )[0];
}

export async function getCharacterAbilities(characterId: string): Promise<AbilitySummary[]> {
  if (!isSupabaseConfigured)
    return demoAbilities.filter((ability) => ability.characterId === characterId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_abilities")
    .select(
      "id,state,character_id,public_override,abilities(id,name,public_description,action_type,costs,usage_limit,recommended_nex,use_criteria,application_text,test_formula,difficulty,success_effect,partial_effect,failure_effect,target_scope,target_min,target_max)",
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
        use_criteria: string | null;
        application_text: string | null;
        test_formula: string | null;
        difficulty: number | null;
        success_effect: string | null;
        partial_effect: string | null;
        failure_effect: string | null;
        target_scope: "self" | "ally" | "enemy" | "any";
        target_min: number;
        target_max: number;
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
            useCriteria: link.abilities.use_criteria ?? undefined,
            application: link.abilities.application_text ?? undefined,
            testFormula: link.abilities.test_formula ?? undefined,
            difficulty: link.abilities.difficulty ?? undefined,
            successEffect: link.abilities.success_effect ?? undefined,
            partialEffect: link.abilities.partial_effect ?? undefined,
            failureEffect: link.abilities.failure_effect ?? undefined,
            targetScope: link.abilities.target_scope,
            targetMin: link.abilities.target_min,
            targetMax: link.abilities.target_max,
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
              useCriteria: undefined,
              application: undefined,
              testFormula: undefined,
              difficulty: undefined,
              successEffect: undefined,
              partialEffect: undefined,
              failureEffect: undefined,
              targetScope: "any",
              targetMin: 0,
              targetMax: 1,
            },
          ]
        : [],
  );
}

export async function getCharacterInventory(characterId: string) {
  if (!isSupabaseConfigured) {
    return [
      {
        id: "lanterna",
        itemId: "lanterna",
        name: "Lanterna tática",
        description: "Iluminação portátil.",
        detail: "3 cargas",
        quantity: 1,
        charges: 3,
        ammunition: null,
        state: "equipado",
        imageUrl: undefined,
      },
      {
        id: "kit",
        itemId: "kit",
        name: "Kit de primeiros socorros",
        description: "Material médico.",
        detail: "1 uso",
        quantity: 1,
        charges: 1,
        ammunition: null,
        state: "íntegro",
        imageUrl: undefined,
      },
      {
        id: "lente",
        itemId: "lente",
        name: "Lente rachada",
        description: "Informação ainda protegida.",
        detail: "informação oculta",
        quantity: 1,
        charges: null,
        ammunition: null,
        state: "corrompido",
        imageUrl: undefined,
      },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("character_items")
    .select("id,item_id,quantity,charges,ammunition,state,items(name,description,image_path)")
    .eq("character_id", characterId);
  if (error) throw new Error(`Falha ao carregar inventário: ${error.message}`);
  const rows = data as unknown as Array<{
    id: string;
    item_id: string;
    quantity: number;
    charges: number | null;
    ammunition: number | null;
    state: string | null;
    items: { name: string; description: string | null; image_path: string | null } | null;
  }>;
  return Promise.all(
    rows.map(async (item) => {
      const signed = item.items?.image_path
        ? await supabase.storage
            .from("handouts-public")
            .createSignedUrl(item.items.image_path, 3600)
        : null;
      return {
        id: item.id,
        itemId: item.item_id,
        name: item.items?.name ?? "Item",
        description: item.items?.description ?? "",
        detail: item.charges !== null ? `${item.charges} cargas` : `${item.quantity} unidade(s)`,
        quantity: item.quantity,
        charges: item.charges,
        ammunition: item.ammunition,
        state: item.state ?? "íntegro",
        imageUrl: signed?.data?.signedUrl,
      };
    }),
  );
}

export async function getAuthorizedMessages() {
  if (!isSupabaseConfigured) return demoMessages;
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return [];
  const { data, error } = await supabase
    .from("messages")
    .select(
      "id,apparent_sender_name,status,created_at,message_contents(body),message_recipients!inner(user_id)",
    )
    .eq("message_recipients.user_id", userData.user.id)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Falha ao carregar mensagens: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      apparent_sender_name: string;
      status: string;
      created_at: string;
      message_contents: { body: string | null } | null;
    }>
  ).map((message) => ({
    id: message.id,
    sender: message.apparent_sender_name,
    body: message.message_contents?.body ?? "Conteúdo indisponível.",
    status: message.status,
    recipient: "Você",
    createdAt: message.created_at,
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

export type PlayerNotebookPage = {
  id: string;
  pageNumber: number;
  title: string;
  content: string;
  linkedHandoutIds: string[];
  updatedAt: string;
};

export async function getPlayerNotebookPages(characterId: string): Promise<PlayerNotebookPage[]> {
  if (!isSupabaseConfigured) {
    return [
      {
        id: "demo-notebook-page",
        pageNumber: 1,
        title: "Primeiras impressões",
        content: "Anote aqui suas teorias, suspeitos e relações entre as pistas.",
        linkedHandoutIds: ["registro"],
        updatedAt: new Date().toISOString(),
      },
    ];
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("player_notebook_pages")
    .select("id,page_number,title,content,linked_handout_ids,updated_at")
    .eq("character_id", characterId)
    .order("page_number");
  if (error) throw new Error(`Falha ao carregar o caderno: ${error.message}`);
  return data.map((page) => ({
    id: page.id,
    pageNumber: page.page_number,
    title: page.title,
    content: page.content,
    linkedHandoutIds: page.linked_handout_ids ?? [],
    updatedAt: page.updated_at,
  }));
}

export async function getAuthorizedInvestigationBoard() {
  const handouts = await getAuthorizedHandouts();
  if (!isSupabaseConfigured) {
    return {
      items: handouts.map((item, index) => ({
        ...item,
        tipo: "pista",
        estado: "descoberta",
        visibilidade: "autorizada",
        titulo: item.title,
        resumo: item.excerpt,
        conteudo: item.content,
        board: {
          x: 0.08 + (index % 3) * 0.29,
          y: 0.1 + Math.floor(index / 3) * 0.32,
          rotation: index % 2 ? 2.5 : -2.5,
          zIndex: index + 1,
          style: index % 2 ? ("postit" as const) : ("paper" as const),
          visibleToPlayers: true,
        },
      })),
      connections: [],
    };
  }
  const ids = handouts.map((item) => item.id);
  if (ids.length === 0) return { items: [], connections: [] };
  const supabase = await createClient();
  const [positionsResult, connectionsResult] = await Promise.all([
    supabase
      .from("investigation_board_items")
      .select("handout_id,x,y,rotation,z_index,display_style,visible_to_players")
      .eq("visible_to_players", true)
      .in("handout_id", ids),
    supabase
      .from("investigation_board_connections")
      .select("id,from_handout_id,to_handout_id")
      .in("from_handout_id", ids)
      .in("to_handout_id", ids),
  ]);
  if (positionsResult.error)
    throw new Error(`Falha ao carregar o mural: ${positionsResult.error.message}`);
  if (connectionsResult.error)
    throw new Error(`Falha ao carregar conexões: ${connectionsResult.error.message}`);
  const positions = new Map(positionsResult.data.map((item) => [item.handout_id, item]));
  const visibleHandouts = handouts.filter((item) => positions.has(item.id));
  const visibleIds = new Set(visibleHandouts.map((item) => item.id));
  return {
    items: visibleHandouts.map((item) => {
      const position = positions.get(item.id);
      return {
        ...item,
        tipo: "pista",
        estado: "descoberta",
        visibilidade: "autorizada",
        titulo: item.title,
        resumo: item.excerpt,
        conteudo: item.content,
        board: position
          ? {
              x: Number(position.x),
              y: Number(position.y),
              rotation: Number(position.rotation),
              zIndex: position.z_index,
              style: position.display_style as "polaroid" | "postit" | "paper",
              visibleToPlayers: true,
            }
          : undefined,
      };
    }),
    connections: connectionsResult.data
      .filter((item) => visibleIds.has(item.from_handout_id) && visibleIds.has(item.to_handout_id))
      .map((item) => ({
        id: item.id,
        fromHandoutId: item.from_handout_id,
        toHandoutId: item.to_handout_id,
      })),
  };
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
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user) return [];
  const { data, error } = await supabase
    .from("notifications")
    .select("id,type,title,safe_preview,read_at,acknowledged_at,created_at")
    .eq("user_id", authData.user.id)
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
      targetScope: "enemy" as const,
      targetMin: 1,
      targetMax: 1,
    }));
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attacks")
    .select("id,name,attack_formula,damage_formula,range_text,damage_type,description,target_scope,target_min,target_max")
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
    targetScope: action.target_scope as "self" | "ally" | "enemy" | "any",
    targetMin: action.target_min,
    targetMax: action.target_max,
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

export type AbilityUseRequest = {
  id: string;
  characterId: string;
  characterName: string;
  characterAbilityId: string;
  abilityName: string;
  status: string;
  decision: string | null;
  context: string;
  rolled: boolean;
  createdAt: string;
  requestKind: "ability" | "attack";
  targetNames: string[];
};

export async function getSessionAbilityRequests(sessionId: string): Promise<AbilityUseRequest[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roll_requests")
    .select(
      "id,character_id,character_ability_id,character_attack_id,request_kind,target_snapshot,status,decision,context,rolled_at,created_at,characters(name),character_abilities(abilities(name)),attack:attacks!roll_requests_character_attack_id_fkey(name)",
    )
    .eq("session_id", sessionId)
    .or("character_ability_id.not.is.null,character_attack_id.not.is.null")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`Falha ao carregar solicitações: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      character_id: string;
      character_ability_id: string | null;
      character_attack_id: string | null;
      request_kind: string;
      target_snapshot: Array<{ name?: string }>;
      status: string;
      decision: string | null;
      context: string;
      rolled_at: string | null;
      created_at: string;
      characters: { name: string } | null;
      character_abilities: { abilities: { name: string } | null } | null;
      attack: { name: string } | null;
    }>
  ).map((item) => ({
    id: item.id,
    characterId: item.character_id,
    characterName: item.characters?.name ?? "Personagem",
    characterAbilityId: item.character_ability_id ?? item.character_attack_id ?? "",
    abilityName: item.character_abilities?.abilities?.name ?? item.attack?.name ?? "Ação",
    status: item.status,
    decision: item.decision,
    context: item.context,
    rolled: Boolean(item.rolled_at),
    createdAt: item.created_at,
    requestKind: item.request_kind === "attack" ? "attack" : "ability",
    targetNames: (item.target_snapshot ?? []).flatMap((target) => target.name ? [target.name] : []),
  }));
}

export type CharacterCheckRequest = {
  id: string;
  characterId: string;
  characterName: string;
  attribute: string;
  skill: string | null;
  difficulty: number;
  context: string;
  method: "roll" | "take_10" | "take_20";
  createdAt: string;
  requestKind: "check" | "initiative";
};

export async function getSessionCheckRequests(sessionId: string): Promise<CharacterCheckRequest[]> {
  if (!isSupabaseConfigured)
    return [
      {
        id: "demo-check-request",
        characterId: "magnus",
        characterName: "Magnus Sigvaldi",
        attribute: "pre",
        skill: "Vontade",
        difficulty: 15,
        context: "Resistir à influência da Zona.",
        method: "roll",
        createdAt: new Date().toISOString(),
        requestKind: "check",
      },
    ];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("roll_requests")
    .select("id,character_id,attribute_key,skill_name,difficulty,context,method,request_kind,created_at,characters(name)")
    .eq("session_id", sessionId)
    .is("character_ability_id", null)
    .eq("status", "pending")
    .is("rolled_at", null)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Falha ao carregar testes solicitados: ${error.message}`);
  return (data as unknown as Array<{
    id: string; character_id: string; attribute_key: string; skill_name: string | null;
    difficulty: number; context: string; method: "roll" | "take_10" | "take_20";
    request_kind: string; created_at: string; characters: { name: string } | null;
  }>).map((item) => ({
    id: item.id,
    characterId: item.character_id,
    characterName: item.characters?.name ?? "Personagem",
    attribute: item.attribute_key,
    skill: item.skill_name,
    difficulty: item.difficulty,
    context: item.context,
    method: item.method,
    createdAt: item.created_at,
    requestKind: item.request_kind === "initiative" ? "initiative" : "check",
  }));
}

export type PublicDiceRoll = {
  id: string;
  characterId: string | null;
  characterName: string;
  playerName: string;
  purpose: string;
  formula: string;
  rolls: number[];
  total: number;
  createdAt: string;
};

export async function getSessionDiceRolls(sessionId: string): Promise<PublicDiceRoll[]> {
  if (!isSupabaseConfigured) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("dice_rolls")
    .select("id,character_id,roller_display_name,formula,rolls,total,purpose,created_at,characters(name),profiles(display_name)")
    .eq("session_id", sessionId)
    .eq("visibility", "session")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(`Falha ao carregar rolagens: ${error.message}`);
  return (
    data as unknown as Array<{
      id: string;
      character_id: string | null;
      roller_display_name: string | null;
      formula: string;
      rolls: number[];
      total: number;
      purpose: string;
      created_at: string;
      characters: { name: string } | null;
      profiles: { display_name: string } | null;
    }>
  ).map((item) => ({
    id: item.id,
    characterId: item.character_id,
    characterName: item.characters?.name ?? item.roller_display_name ?? item.profiles?.display_name ?? "Jogador",
    playerName: item.roller_display_name ?? item.profiles?.display_name ?? item.characters?.name ?? "Jogador",
    purpose: item.purpose,
    formula: item.formula,
    rolls: item.rolls,
    total: item.total,
    createdAt: item.created_at,
  }));
}
