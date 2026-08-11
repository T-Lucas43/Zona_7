import type { CampaignRole, Visibility } from "@/types/domain";

const MASTER_ROLES: CampaignRole[] = [
  "platform_admin",
  "campaign_owner",
  "game_master",
  "co_master",
];

export function isMasterRole(role: CampaignRole) {
  return MASTER_ROLES.includes(role);
}

export function canViewContent(input: {
  visibility: Visibility;
  role: CampaignRole;
  isOwner?: boolean;
  isSelected?: boolean;
  isCampaignMember?: boolean;
}) {
  if (isMasterRole(input.role)) return true;
  if (input.visibility === "public") return true;
  if (input.visibility === "campaign") return Boolean(input.isCampaignMember);
  if (input.visibility === "selected") return Boolean(input.isSelected);
  if (input.visibility === "owner_only") return Boolean(input.isOwner);
  return false;
}
