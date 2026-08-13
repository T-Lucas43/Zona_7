import { HelpCenter } from "@/components/help/help-center";
import { HelpArticleEditor } from "@/components/master/help-article-editor";
import { getCampanhasDoMestre } from "@/server/repositories/master-repository";
import { getHelpIndex } from "@/server/repositories/rules-repository";

export default async function MasterHelpPage({ searchParams }: { searchParams: Promise<{ campaignId?: string; q?: string; category?: string }> }) {
  const params = await searchParams;
  const campaigns = await getCampanhasDoMestre();
  const campaignId = params.campaignId ?? campaigns[0]?.id;
  if (!campaignId) return <section className="panel rounded-xl p-6">Crie ou abra uma campanha para acessar o manual operacional.</section>;
  const articles = await getHelpIndex({ campaignId, audience: "master", query: params.q, category: params.category });
  const editableArticles = params.q || params.category ? await getHelpIndex({ campaignId, audience: "master" }) : articles;
  return <><HelpCenter campaignId={campaignId} articles={articles} audience="master" query={params.q} category={params.category} /><HelpArticleEditor campaignId={campaignId} articles={editableArticles} /></>;
}

