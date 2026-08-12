import Link from "next/link";
import { ArrowRight, Plus, Radio, Users } from "lucide-react";
import { getCampanhasDoMestre } from "@/server/repositories/master-repository";

export default async function MasterHomePage() {
  const campanhas = await getCampanhasDoMestre();
  return (
    <div>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="eyebrow">suas campanhas</p>
          <h1 className="mt-1 text-3xl font-black">Painel do mestre</h1>
          <p className="mt-2 text-sm text-[#8f9299]">
            Os indicadores abaixo são calculados a partir dos dados atuais do servidor.
          </p>
        </div>
        <Link href="/master/campaigns/new" className="btn">
          <Plus size={15} /> Nova campanha
        </Link>
      </div>

      {campanhas.length === 0 ? (
        <section className="panel mt-6 rounded-xl p-7 text-center">
          <h2 className="text-xl font-extrabold">Nenhuma campanha cadastrada</h2>
          <p className="mt-2 text-sm text-[#8f9299]">
            Crie uma campanha para começar a adicionar sessões, personagens e jogadores.
          </p>
          <Link href="/master/campaigns/new" className="btn btn-primary mt-5">
            <Plus size={15} /> Criar primeira campanha
          </Link>
        </section>
      ) : (
        <div className="mt-6 space-y-5">
          {campanhas.map((campanha) => (
            <section className="panel overflow-hidden rounded-xl" key={campanha.id}>
              <div className="border-b border-[#2b2e34] bg-[radial-gradient(circle_at_80%_0%,rgba(181,37,50,0.18),transparent_24rem)] p-5 sm:p-7">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <span className="tag">
                      <span className="status-dot" /> {campanha.situacao.toUpperCase()}
                    </span>
                    <h2 className="mt-4 text-2xl font-black">{campanha.nome}</h2>
                    {campanha.premissa ? (
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-[#94979e]">
                        {campanha.premissa}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-[#777a82]">Premissa ainda não informada.</p>
                    )}
                  </div>
                  <Link href={`/master/campaigns/${campanha.id}`} className="btn btn-primary">
                    Abrir console <ArrowRight size={16} />
                  </Link>
                </div>
              </div>
              <div className="grid gap-px bg-[#2b2e34] sm:grid-cols-3">
                <div className="bg-[#111318] p-5">
                  <Users size={17} className="text-[#d64a56]" />
                  <strong className="mt-3 block text-2xl">{campanha.personagens}</strong>
                  <span className="text-xs text-[#777a82]">personagens cadastrados</span>
                </div>
                <div className="bg-[#111318] p-5">
                  <Radio size={17} className="text-[#d64a56]" />
                  <strong className="mt-3 block text-2xl">{campanha.conectados}</strong>
                  <span className="text-xs text-[#777a82]">participantes conectados agora</span>
                </div>
                <div className="bg-[#111318] p-5">
                  <span className="eyebrow text-[#d64a56]">ZONA</span>
                  <strong className="mt-3 block text-2xl">{campanha.pressao}/7</strong>
                  <span className="text-xs text-[#777a82]">pressão narrativa configurada</span>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
