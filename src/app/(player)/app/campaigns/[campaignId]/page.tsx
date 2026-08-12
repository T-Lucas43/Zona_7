import Link from "next/link";
import { ArrowRight, Calendar, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { getCampanhaResumo, getRegras } from "@/server/repositories/master-repository";
import { getCurrentSession } from "@/server/repositories/session-repository";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  const { campaignId } = await params;
  const [campaign, session, rules] = await Promise.all([
    getCampanhaResumo(campaignId),
    getCurrentSession(campaignId),
    getRegras(campaignId),
  ]);
  if (!campaign) notFound();
  return (
    <div>
      <p className="eyebrow">arquivo de campanha</p>
      <h1 className="mt-1 text-3xl font-black">{campaign.nome}</h1>
      {campaign.premissa && <p className="mt-4 max-w-3xl text-sm leading-7 text-[#aaaeb5]">{campaign.premissa}</p>}
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <section className="panel rounded-lg p-5">
          <Calendar className="text-[#d24653]" />
          {session ? <>
            <h2 className="mt-4 font-extrabold">{session.title}</h2>
            <p className="mt-2 text-sm text-[#888b93]">{session.status} · cena {session.scene}</p>
            <Link className="btn btn-primary mt-5" href={`/app/session/${session.id}`}>
              Entrar <ArrowRight size={15} />
            </Link>
          </> : <>
            <h2 className="mt-4 font-extrabold">Nenhuma sessão disponível</h2>
            <p className="mt-2 text-sm text-[#888b93]">Aguarde o mestre abrir uma sessão.</p>
          </>}
        </section>
        <section className="panel rounded-lg p-5">
          <ShieldCheck className="text-[#66bd8b]" />
          <h2 className="mt-4 font-extrabold">Regras da mesa</h2>
          {rules ? <p className="mt-2 text-sm leading-6 text-[#888b93]">
            {rules.perfil} · pressão {rules.pressao}/7
          </p> : <p className="mt-2 text-sm text-[#888b93]">Regras ainda não configuradas.</p>}
        </section>
      </div>
    </div>
  );
}
