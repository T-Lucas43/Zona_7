import Link from "next/link";
import { Brand } from "@/components/brand";

export default function TermsPage() {
  return (
    <main id="conteudo" className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <Brand />
      <article className="panel mt-10 rounded-xl p-6 sm:p-10">
        <p className="eyebrow">documento editável // versão inicial</p>
        <h1 className="mt-3 text-3xl font-black">Termos de uso</h1>
        <div className="mt-7 space-y-5 text-sm leading-7 text-[#b7b9bf]">
          <p>
            Use o terminal somente em campanhas das quais você participa e respeite os limites
            definidos pelo grupo.
          </p>
          <p>
            O mestre é responsável pelo conteúdo enviado, pelas permissões concedidas e pela
            conservação de arquivos originais importantes. Não use o sistema para conteúdo ilegal ou
            para assediar participantes.
          </p>
          <p>
            Recursos narrativos intensos, sons e vibração podem ser desativados nas preferências do
            perfil.
          </p>
        </div>
        <Link href="/" className="btn mt-8">
          Voltar ao início
        </Link>
      </article>
    </main>
  );
}
