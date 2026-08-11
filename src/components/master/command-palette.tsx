"use client";

import { useEffect, useMemo, useState } from "react";
import { Command, Search, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

export function CommandPalette({ enabled }: { enabled: boolean }) {
  const [aberta, setAberta] = useState(false);
  const [busca, setBusca] = useState("");
  const router = useRouter();
  const pathname = usePathname();
  const campaignId =
    pathname.match(/\/master\/campaigns\/([^/]+)/)?.[1] ?? "11111111-1111-4111-8111-111111111111";
  const campaign = `/master/campaigns/${campaignId}`;
  const commands = useMemo(
    () =>
      [
        ["Abrir personagens", `${campaign}/characters`, "/ficha"],
        ["Aplicar dano ou cura", `${campaign}/characters`, "/dano /cura"],
        ["Alterar SAN ou PE", `${campaign}/characters`, "/san /pe"],
        ["Liberar habilidade", `${campaign}/characters`, "/habilidade"],
        ["Enviar mensagem privada", `${campaign}/messages`, "/mensagem"],
        ["Abrir mapa e mover tokens", `${campaign}/maps`, "/mapa"],
        ["Controlar atores e personagens não jogáveis", `${campaign}/actors`, "/ator"],
        ["Importar ou executar roteiro", `${campaign}/scripts`, "/roteiro"],
        ["Gerenciar contas e convites", `${campaign}/members`, "/conta"],
        ["Abrir configurações", `${campaign}/settings`, "/configurar"],
      ] as const,
    [campaign],
  );
  useEffect(() => {
    if (!enabled) return;
    const listener = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAberta((valor) => !valor);
      }
      if (event.key === "Escape") setAberta(false);
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, [enabled]);
  const filtrados = useMemo(
    () =>
      commands.filter((item) =>
        `${item[0]} ${item[2]}`.toLowerCase().includes(busca.toLowerCase()),
      ),
    [busca, commands],
  );
  if (!enabled) return null;
  return (
    <>
      <button
        className="fixed bottom-20 right-4 z-40 grid size-11 place-items-center rounded-full border border-[#4a3034] bg-[#17191e] text-[#d84b57] shadow-xl md:bottom-5"
        type="button"
        title="Abrir paleta de comandos"
        onClick={() => setAberta(true)}
      >
        <Command size={19} />
      </button>
      {aberta && (
        <div
          className="fixed inset-0 z-[2000] bg-black/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Paleta de comandos"
          onClick={() => setAberta(false)}
        >
          <div
            className="panel mx-auto mt-[10vh] max-w-2xl rounded-xl p-4"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <Search size={18} className="text-[#d84b57]" />
              <input
                autoFocus
                className="field border-0 bg-transparent"
                placeholder="Busque personagem, ação ou comando..."
                value={busca}
                onChange={(event) => setBusca(event.target.value)}
              />
              <button className="btn px-2 py-2" type="button" onClick={() => setAberta(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="mt-3 max-h-[55vh] space-y-2 overflow-y-auto">
              {filtrados.map(([rotulo, href, atalho]) => (
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded border border-[#30333a] p-3 text-left hover:border-[#6c343a] hover:bg-[#8a1b27]/10"
                  key={rotulo}
                  onClick={() => {
                    setAberta(false);
                    router.push(href);
                  }}
                >
                  <span className="text-sm font-bold">{rotulo}</span>
                  <code className="text-xs text-[#777a82]">{atalho}</code>
                </button>
              ))}
            </div>
            <p className="mt-4 text-center text-xs text-[#696c73]">
              Ctrl+K ou Cmd+K para abrir · Esc para fechar
            </p>
          </div>
        </div>
      )}
    </>
  );
}
