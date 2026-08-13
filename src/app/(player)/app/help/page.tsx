import { HelpCenter } from "@/components/help/help-center";
import { getAuthorizedCharacters } from "@/server/repositories/character-repository";
import { getHelpIndex } from "@/server/repositories/rules-repository";

export default async function PlayerHelpPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string }> }) {
  const params = await searchParams;
  const characters = await getAuthorizedCharacters();
  const campaignId = characters[0]?.campaignId ?? "11111111-1111-4111-8111-111111111111";
  const articles = await getHelpIndex({ campaignId, audience: "player", query: params.q, category: params.category });
  return <HelpCenter campaignId={campaignId} articles={articles} audience="player" query={params.q} category={params.category} />;
}

