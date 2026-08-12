"use client";

import { useEffect, useState } from "react";
import { CircleStop, Pause, Play, RadioTower, Route, Sparkles } from "lucide-react";
import type { RoteiroDaCampanha } from "@/server/repositories/master-repository";
import type { SessionScriptRun } from "@/server/repositories/script-repository";

const statusLabels: Record<string, string> = {
  preparing: "Preparando",
  running: "Em execução",
  paused: "Pausado",
  improvising: "Em improviso",
  completed: "Encerrado",
  cancelled: "Cancelado",
};

export function SessionScriptControl({
  campaignId,
  sessionId,
  sessionStatus,
  scripts,
  initialRun,
}: {
  campaignId: string;
  sessionId: string;
  sessionStatus: string;
  scripts: RoteiroDaCampanha[];
  initialRun: SessionScriptRun | null;
}) {
  const [selectedScript, setSelectedScript] = useState(scripts[0]?.id ?? "");
  const [run, setRun] = useState(initialRun);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  useEffect(() => {
    const reset = (event: Event) => {
      const detail = (event as CustomEvent<{ scriptStatus?: string }>).detail;
      if (detail?.scriptStatus === "awaiting_new_run") {
        setRun(null);
        setSelectedScript(scripts[0]?.id ?? "");
      }
    };
    window.addEventListener("z7:session-control", reset);
    return () => window.removeEventListener("z7:session-control", reset);
  }, [scripts]);

  async function control(
    action: "start" | "advance" | "pause" | "resume" | "improvise" | "complete",
    targetNodeKey?: string,
  ) {
    setPending(true);
    setNotice("");
    const response = await fetch("/api/master/scripts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sessionId,
        action,
        scriptPackageId: action === "start" ? selectedScript : undefined,
        runId: action === "start" ? undefined : run?.runId,
        targetNodeKey,
        reason: "Controle executado na Central da Sessão",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json()) as SessionScriptRun & { error?: string };
    setPending(false);
    if (!response.ok) return setNotice(result.error ?? "Não foi possível controlar o roteiro.");
    setRun(result);
    setNotice(`Roteiro ${statusLabels[result.status]?.toLowerCase() ?? "atualizado"}. Jogadores sincronizados.`);
  }

  const canStart = sessionStatus === "active" && Boolean(selectedScript) && !run;
  return (
    <section className="session-script-panel rounded-lg border border-[#6a2d36] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-[#8a1b27]/25 text-[#ff7885]"><Route size={19} /></span>
          <div>
            <p className="eyebrow">roteiro operacional // somente mestre</p>
            <h2 className="font-extrabold">Controle integrado da narrativa</h2>
          </div>
        </div>
        <span className="tag"><RadioTower size={12} /> {run ? statusLabels[run.status] ?? run.status : "Aguardando início"}</span>
      </div>

      {!run ? (
        <div className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]">
          <label className="text-xs font-bold">
            Roteiro publicado
            <select className="field mt-1" value={selectedScript} onChange={(event) => setSelectedScript(event.target.value)}>
              {scripts.map((script) => <option value={script.id} key={script.id}>{script.nome} · v{script.versao}</option>)}
            </select>
          </label>
          <button className="btn btn-primary self-end" type="button" disabled={!canStart || pending} onClick={() => void control("start")}>
            <Play size={15} /> Iniciar roteiro
          </button>
          {scripts.length === 0 && <p className="text-xs text-[#f0a5ad] md:col-span-2">Publique um roteiro antes de iniciar a execução.</p>}
          {sessionStatus !== "active" && <p className="text-xs text-[#e2b341] md:col-span-2">Inicie a sessão para liberar o roteiro ao mestre.</p>}
        </div>
      ) : (
        <div className="mt-4">
          <div className="rounded-lg border border-[#4c2a30] bg-black/25 p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{run.node?.title ?? "Execução sem nó atual"}</strong>
              <span className="tag">sequência {run.sequence}</span>
            </div>
            {run.node && <>
              <p className="mt-2 text-xs uppercase tracking-wider text-[#9c777c]">{run.node.type} · {run.node.key}</p>
              <p className="mt-3 text-sm leading-6 text-[#b6b8bd]">{run.node.text}</p>
            </>}
          </div>
          {run.options.length > 0 && run.status !== "completed" && (
            <div className="mt-3 flex flex-wrap gap-2">
              {run.options.map((option) => (
                <button className="btn" type="button" disabled={pending || run.status === "paused"} key={option.key} onClick={() => void control("advance", option.key)}>
                  <Sparkles size={14} /> {option.label}
                </button>
              ))}
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {run.status === "paused" || run.status === "improvising" ? (
              <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void control("resume")}><Play size={14} /> Retomar</button>
            ) : (
              <button className="btn" type="button" disabled={pending || run.status === "completed"} onClick={() => void control("pause")}><Pause size={14} /> Pausar</button>
            )}
            <button className="btn" type="button" disabled={pending || run.status === "completed"} onClick={() => void control("improvise")}><Sparkles size={14} /> Improvisar</button>
            <button className="btn" type="button" disabled={pending || run.status === "completed"} onClick={() => void control("complete")}><CircleStop size={14} /> Encerrar roteiro</button>
            {run.status === "completed" && <button className="btn btn-primary" type="button" onClick={() => { setRun(null); setSelectedScript(scripts[0]?.id ?? ""); setNotice("Selecione o roteiro publicado mais recente para a próxima execução."); }}><Play size={14} /> Iniciar nova execução</button>}
          </div>
        </div>
      )}
      {notice && <p className="session-notice mt-3" role="status">{notice}</p>}
    </section>
  );
}
