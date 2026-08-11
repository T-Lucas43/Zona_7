import Link from "next/link";
import { ArrowRight, LockKeyhole, Radio, ShieldCheck, Waves } from "lucide-react";
import { Brand } from "@/components/brand";

export default function HomePage() {
  return (
    <main id="conteudo" className="terminal-grid min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-6 md:px-8">
        <Brand />
        <Link href="/login" className="btn btn-ghost">
          Acessar terminal <ArrowRight size={16} />
        </Link>
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-110px)] max-w-7xl items-center gap-12 px-5 pb-16 pt-8 md:px-8 lg:grid-cols-[1.08fr_0.92fr]">
        <div className="max-w-3xl">
          <div className="eyebrow mb-5 flex items-center gap-2">
            <span className="status-dot" /> transmissão autenticada // pressão 03
          </div>
          <h1 className="glitch-title max-w-3xl text-5xl font-black leading-[0.92] tracking-[-0.065em] sm:text-7xl lg:text-[6.8rem]">
            SETE SEGUNDOS <span className="text-[#c42e3c]">ANTES.</span>
          </h1>
          <p className="mt-7 max-w-2xl text-base leading-7 text-[#b4b6bc] sm:text-lg">
            O terminal da Convergência conecta mestre e sobreviventes em tempo real. Fichas vivas,
            decisões auditadas e segredos entregues somente a quem deve recebê-los.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/login" className="btn btn-primary px-5">
              Inicializar terminal <ArrowRight size={17} />
            </Link>
            <Link href="/privacy" className="btn">
              Protocolos de segurança
            </Link>
          </div>
          <div className="mt-12 grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              [Radio, "Tempo real", "Ficha, turno e sinais sincronizados."],
              [ShieldCheck, "Sem vazamentos", "Segredos isolados por autorização."],
              [Waves, "Narrativa viva", "Eventos, dados e manifestações."],
            ].map(([Icon, title, description]) => {
              const Component = Icon as typeof Radio;
              return (
                <article key={String(title)} className="border-l border-[#373a41] pl-4">
                  <Component size={18} className="mb-3 text-[#d13a48]" />
                  <h2 className="text-sm font-extrabold">{String(title)}</h2>
                  <p className="mt-1 text-xs leading-5 text-[#858891]">{String(description)}</p>
                </article>
              );
            })}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl">
          <div className="absolute -inset-10 rounded-full bg-[#8d1d28]/10 blur-3xl" />
          <div className="panel relative overflow-hidden rounded-xl">
            <div className="flex items-center justify-between border-b border-[#292c32] px-5 py-4">
              <span className="eyebrow">canal // z7-001</span>
              <LockKeyhole size={15} className="text-[#6f727a]" />
            </div>
            <div className="space-y-5 p-5 sm:p-7">
              <div className="font-mono text-xs text-[#747780]">07:14:52 — PACOTE RECEBIDO</div>
              <div className="rounded-md border border-[#71202a] bg-[#6f1722]/15 p-5">
                <div className="eyebrow mb-3 text-[#ef5362]">remetente // desconhecido</div>
                <p className="text-2xl font-black tracking-[-0.035em] sm:text-3xl">
                  VOCÊ AINDA É O FAVORITO.
                </p>
              </div>
              <div className="grid grid-cols-7 gap-2" aria-label="Pressão da Zona: 3 de 7">
                {Array.from({ length: 7 }, (_, index) => (
                  <span
                    key={index}
                    className={`h-12 rounded-sm border ${index < 3 ? "border-[#b32a37] bg-[#8d1d28]/50" : "border-[#2d3036] bg-[#121419]"}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between text-xs text-[#858891]">
                <span>Realidade instável</span>
                <span className="font-mono">3 / 7</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
