import { Brand } from "@/components/brand";
import { resetPasswordAction } from "@/server/actions/auth";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; required?: string }>;
}) {
  const { error, required } = await searchParams;
  return (
    <main id="conteudo" className="grid min-h-screen place-items-center px-4">
      <section className="panel w-full max-w-md rounded-xl p-6">
        <Brand />
        <h1 className="mt-8 text-2xl font-black">Definir nova senha</h1>
        {required && <p className="mt-3 text-sm leading-6 text-[#a4a7ad]">Por segurança, substitua a senha temporária antes de entrar na campanha.</p>}
        {error && (
          <p
            className="mt-4 rounded border border-[#6f2630] bg-[#6f1722]/20 p-3 text-sm text-[#f0a5ad]"
            role="alert"
          >
            As senhas precisam ser iguais e ter pelo menos 12 caracteres. Solicite outro link se a
            sessão tiver expirado.
          </p>
        )}
        <form action={resetPasswordAction} className="mt-6 space-y-4">
          <label htmlFor="new-password" className="block text-xs font-bold">
            Nova senha
          </label>
          <input
            id="new-password"
            name="password"
            type="password"
            minLength={12}
            className="field"
            required
          />
          <label htmlFor="confirm-password" className="block text-xs font-bold">
            Confirmar senha
          </label>
          <input
            id="confirm-password"
            name="confirmation"
            type="password"
            minLength={12}
            className="field"
            required
          />
          <button type="submit" className="btn btn-primary w-full">
            Atualizar acesso
          </button>
        </form>
      </section>
    </main>
  );
}
