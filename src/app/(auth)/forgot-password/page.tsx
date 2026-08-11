import Link from "next/link";
import { Brand } from "@/components/brand";
import { requestPasswordResetAction } from "@/server/actions/auth";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;
  return (
    <main id="conteudo" className="grid min-h-screen place-items-center px-4">
      <section className="panel w-full max-w-md rounded-xl p-6">
        <Brand />
        <h1 className="mt-8 text-2xl font-black">Recuperar acesso</h1>
        <p className="mt-2 text-sm leading-6 text-[#92959d]">
          Informe o e-mail da conta. No modo Supabase, um link temporário será enviado sem revelar
          se o endereço participa de uma campanha.
        </p>
        {sent === "1" && (
          <p
            className="mt-4 rounded border border-[#315c45] bg-[#173324]/30 p-3 text-sm text-[#7bd5a5]"
            role="status"
          >
            Se a conta existir, o link seguro já foi enviado.
          </p>
        )}
        <form action={requestPasswordResetAction} className="mt-6 space-y-4">
          <label htmlFor="recovery-email" className="block text-xs font-bold">
            E-mail
          </label>
          <input id="recovery-email" name="email" type="email" className="field" required />
          <button type="submit" className="btn btn-primary w-full">
            Enviar link seguro
          </button>
        </form>
        <Link href="/login" className="btn btn-ghost mt-3 w-full">
          Voltar ao login
        </Link>
      </section>
    </main>
  );
}
