import Link from "next/link";
import { ArrowRight, Plus, Radio, Users } from "lucide-react";
import { campaign, characters, liveSession } from "@/lib/demo-data";

export default function MasterHomePage() {
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">suas campanhas</p>
          <h1 className="mt-1 text-3xl font-black">Painel do mestre</h1>
          <p className="mt-2 text-sm text-[#8f9299]">
            Toda alteração crítica é autorizada e auditada no servidor.
          </p>
        </div>
        <Link href="/master/campaigns/new" className="btn">
          <Plus size={15} /> Nova campanha
        </Link>
      </div>
      <section className="panel mt-6 overflow-hidden rounded-xl">
        <div className="border-b border-[#2b2e34] bg-[radial-gradient(circle_at_80%_0%,rgba(181,37,50,0.18),transparent_24rem)] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="tag">
                <span className="status-dot" /> CAMPANHA ATIVA
              </span>
              <h2 className="mt-4 text-2xl font-black">{campaign.name}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#94979e]">{campaign.premise}</p>
            </div>
            <Link href={`/master/campaigns/${campaign.id}`} className="btn btn-primary">
              Abrir console <ArrowRight size={16} />
            </Link>
          </div>
        </div>
        <div className="grid gap-px bg-[#2b2e34] sm:grid-cols-3">
          <div className="bg-[#111318] p-5">
            <Users size={17} className="text-[#d64a56]" />
            <strong className="mt-3 block text-2xl">{characters.length}</strong>
            <span className="text-xs text-[#777a82]">sobreviventes ativos</span>
          </div>
          <div className="bg-[#111318] p-5">
            <Radio size={17} className="text-[#d64a56]" />
            <strong className="mt-3 block text-2xl">{liveSession.connected}/5</strong>
            <span className="text-xs text-[#777a82]">conectados agora</span>
          </div>
          <div className="bg-[#111318] p-5">
            <span className="eyebrow text-[#d64a56]">ZONA</span>
            <strong className="mt-3 block text-2xl">{liveSession.pressure}/7</strong>
            <span className="text-xs text-[#777a82]">pressão narrativa</span>
          </div>
        </div>
      </section>
    </div>
  );
}
