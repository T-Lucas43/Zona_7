import { Eye, Radio } from "lucide-react";
import { Brand } from "@/components/brand";
import { LoginForm } from "@/components/auth/login-form";
import { isSupabaseConfigured } from "@/lib/config";
import { demoSignInAction } from "@/server/actions/auth";

export default function LoginPage() {
  return (
    <main id="conteudo" className="terminal-grid grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <Brand />
        </div>
        <section className="panel overflow-hidden rounded-xl">
          <div className="border-b border-[#292c32] px-6 py-5">
            <p className="eyebrow">autorização obrigatória</p>
            <h1 className="mt-2 text-2xl font-black">Identifique-se, operador.</h1>
            <p className="mt-2 text-sm text-[#8f929a]">
              O canal seguro não revela o conteúdo antes da autenticação.
            </p>
          </div>
          <div className="p-6">
            <LoginForm demoMode={!isSupabaseConfigured} />
            {!isSupabaseConfigured && (
              <div className="mt-6 border-t border-[#292c32] pt-6">
                <p className="mb-3 text-center text-xs text-[#8e9198]">
                  Acessos locais sem credenciais externas
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <form action={demoSignInAction}>
                    <input type="hidden" name="role" value="master" />
                    <button className="btn w-full" type="submit">
                      <Radio size={15} /> Mestre
                    </button>
                  </form>
                  <form action={demoSignInAction}>
                    <input type="hidden" name="role" value="player" />
                    <button className="btn w-full" type="submit">
                      <Eye size={15} /> Jogador
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </section>
        <p className="mt-5 text-center text-xs text-[#60636b]">
          Conexão protegida // América/Belém
        </p>
      </div>
    </main>
  );
}
