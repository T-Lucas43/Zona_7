import { CheckCircle2 } from "lucide-react";
import { Brand } from "@/components/brand";
import { acceptInvitationAction } from "@/server/actions/auth";

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await params;
  const { error } = await searchParams;
  return (
    <main id="conteudo" className="grid min-h-screen place-items-center px-4">
      <section className="panel w-full max-w-lg rounded-xl p-7">
        <Brand />
        <CheckCircle2 className="mt-8 text-[#5ebf89]" size={32} />
        <p className="eyebrow mt-5">convite de uso único</p>
        <h1 className="mt-2 text-3xl font-black">A Convergência espera.</h1>
        <p className="mt-4 text-sm leading-6 text-[#a5a8ae]">
          Ao aceitar, sua conta será vinculada somente à ficha liberada pelo mestre. O token será
          invalidado imediatamente.
        </p>
        {error && (
          <p
            className="mt-4 rounded border border-[#6f2630] bg-[#6f1722]/20 p-3 text-sm text-[#f0a5ad]"
            role="alert"
          >
            Não foi possível aceitar o convite. Verifique a senha ou solicite um novo convite ao
            mestre.
          </p>
        )}
        <form action={acceptInvitationAction} className="mt-7 space-y-4">
          <input type="hidden" name="token" value={token} />
          <label htmlFor="invite-password" className="block text-xs font-bold">
            Crie sua senha
          </label>
          <input
            id="invite-password"
            name="password"
            type="password"
            minLength={8}
            className="field"
            required
          />
          <button className="btn btn-primary w-full" type="submit">
            Aceitar convite
          </button>
        </form>
      </section>
    </main>
  );
}
