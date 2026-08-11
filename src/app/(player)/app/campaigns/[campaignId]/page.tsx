import Link from "next/link";
import { ArrowRight, Calendar, ShieldCheck } from "lucide-react";
import { campaign, liveSession } from "@/lib/demo-data";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ campaignId: string }>;
}) {
  await params;
  return (
    <div>
      <p className="eyebrow">arquivo de campanha</p>
      <h1 className="mt-1 text-3xl font-black">{campaign.name}</h1>
      <p className="mt-4 max-w-3xl text-sm leading-7 text-[#aaaeb5]">{campaign.premise}</p>
      <div className="mt-7 grid gap-4 md:grid-cols-2">
        <section className="panel rounded-lg p-5">
          <Calendar className="text-[#d24653]" />
          <h2 className="mt-4 font-extrabold">{liveSession.title}</h2>
          <p className="mt-2 text-sm text-[#888b93]">Sala aberta · cena {liveSession.scene}</p>
          <Link className="btn btn-primary mt-5" href={`/app/session/${liveSession.id}`}>
            Entrar <ArrowRight size={15} />
          </Link>
        </section>
        <section className="panel rounded-lg p-5">
          <ShieldCheck className="text-[#66bd8b]" />
          <h2 className="mt-4 font-extrabold">Protocolos da mesa</h2>
          <p className="mt-2 text-sm leading-6 text-[#888b93]">
            Fail-forward ativo. Sons opcionais. Conteúdo secreto protegido por destinatário.
          </p>
        </section>
      </div>
    </div>
  );
}
