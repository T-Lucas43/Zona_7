import Link from "next/link";
import { Brand } from "@/components/brand";

export default function PrivacyPage() {
  return (
    <main id="conteudo" className="mx-auto min-h-screen max-w-3xl px-5 py-10">
      <Brand />
      <article className="panel mt-10 rounded-xl p-6 sm:p-10">
        <p className="eyebrow">documento editável // versão inicial</p>
        <h1 className="mt-3 text-3xl font-black">Política de privacidade</h1>
        <div className="mt-7 space-y-5 text-sm leading-7 text-[#b7b9bf]">
          <p>
            O Zona 7 armazena dados de conta, campanha e atividade necessários para operar as
            sessões. Senhas são processadas pelo Supabase Auth e nunca ficam disponíveis ao mestre.
          </p>
          <p>
            Conteúdos privados são protegidos por políticas de acesso no banco. Registros de
            auditoria preservam alterações relevantes, sem guardar senhas, tokens ou credenciais.
          </p>
          <p>
            Arquivos privados usam URLs temporárias. Operadores da campanha podem solicitar
            exportação, correção ou exclusão compatível com a preservação do histórico de jogo.
          </p>
        </div>
        <Link href="/" className="btn mt-8">
          Voltar ao início
        </Link>
      </article>
    </main>
  );
}
