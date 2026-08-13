"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function MasterSectionError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <section className="panel mx-auto mt-10 max-w-xl rounded-xl p-6 text-center" role="alert">
      <AlertTriangle className="mx-auto text-[#d84b57]" size={34} />
      <p className="eyebrow mt-4">falha temporária</p>
      <h1 className="mt-2 text-2xl font-black">Não foi possível abrir este módulo</h1>
      <p className="mt-3 text-sm leading-6 text-[#8f9299]">
        Tente novamente. Se o problema continuar, informe o código abaixo ao administrador.
      </p>
      <p className="mt-3 font-mono text-xs text-[#777a82]">
        Código {error.digest ?? "SEM-CODIGO"}
      </p>
      <button className="btn btn-primary mx-auto mt-5" type="button" onClick={() => retry()}>
        <RotateCcw size={15} /> Tentar novamente
      </button>
    </section>
  );
}
