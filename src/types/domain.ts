export type CampaignRole =
  "platform_admin" | "campaign_owner" | "game_master" | "co_master" | "player" | "spectator";

export type Visibility = "public" | "campaign" | "selected" | "owner_only" | "gm_only";
export type ResourceKind = "pv" | "pe" | "san";
export type AbilityState =
  "sealed" | "masked" | "discovered" | "unlocked" | "altered" | "disabled" | "lost";

export interface CharacterResource {
  kind: ResourceKind;
  current: number;
  maximum: number;
}

export interface CharacterSheetVisibility {
  fields: string[];
  sections: string[];
}

export interface CharacterSummary {
  id: string;
  name: string;
  codename?: string;
  origin: string;
  className: string;
  path: string;
  status: string;
  role: string;
  nex: number;
  defense: number;
  movement?: number;
  mainDc?: number;
  version?: number;
  portraitUrl?: string;
  resources: Record<ResourceKind, CharacterResource>;
  attributes: Record<"agi" | "for" | "int" | "pre" | "vig", number>;
  meter: {
    name: string;
    value: number;
    stages: string[];
  };
  conditions: string[];
  sheetVisibility?: CharacterSheetVisibility;
}

export interface AbilitySummary {
  id: string;
  characterId: string;
  name: string;
  actionType: string;
  description: string;
  state: AbilityState;
  costs: Partial<Record<ResourceKind, string>>;
  limit?: string;
  recommendedNex: number;
}

export interface SessionSummary {
  id: string;
  title: string;
  status: "draft" | "scheduled" | "open" | "active" | "paused" | "ended" | "archived";
  scene: string;
  round: number;
  currentTurn: string;
  connected: number;
  pressure: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: CampaignRole;
  demo: boolean;
}
