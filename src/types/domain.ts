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
  campaignId?: string;
  name: string;
  codename?: string;
  pronouns?: string;
  origin: string;
  className: string;
  path: string;
  status: string;
  role: string;
  affinities?: string[];
  shortDescription?: string;
  tagline?: string;
  publicHistory?: string;
  characterState?: string;
  identificationColor?: string;
  nex: number;
  defense: number;
  blockValue?: number;
  dodgeValue?: number;
  movement?: number;
  mainDc?: number;
  pePerTurn?: number;
  version?: number;
  portraitUrl?: string;
  resources: Record<ResourceKind, CharacterResource>;
  attributes: Record<"agi" | "for" | "int" | "pre" | "vig", number>;
  resistances?: Record<"fortitude" | "reflexes" | "willpower", number>;
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
  useCriteria?: string;
  application?: string;
  testFormula?: string;
  difficulty?: number;
  successEffect?: string;
  partialEffect?: string;
  failureEffect?: string;
}

export interface SessionSummary {
  id: string;
  campaignId?: string;
  title: string;
  status: "draft" | "scheduled" | "open" | "active" | "paused" | "ended" | "archived";
  scene: string;
  round: number;
  currentTurn: string;
  connected: number;
  pressure: number;
  elapsedSeconds?: number;
  timerStartedAt?: string | null;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  role: CampaignRole;
  demo: boolean;
}
