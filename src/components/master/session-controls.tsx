"use client";

import { useState } from "react";
import { Pause, Play, RefreshCcw, RotateCcw, SkipForward, Square, TriangleAlert, X } from "lucide-react";

export function SessionControls({
  initialTurn,
  campaignId,
  sessionId,
  initialStatus = "active",
}: {
  initialTurn: number;
  campaignId: string;
  sessionId: string;
  initialStatus?: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [turn, setTurn] = useState(initialTurn);
  const [notice, setNotice] = useState("");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const [confirmingRestart, setConfirmingRestart] = useState(false);
  const [pending, setPending] = useState(false);
  const paused = status === "paused";
  const ended = status === "ended";
  const waiting = ["draft", "scheduled", "open"].includes(status);

  async function control(action: "start" | "pause" | "resume" | "reopen" | "restart" | "advance" | "end") {
    setPending(true);
    setNotice("");
    const response = await fetch("/api/master/session/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId, action }),
    });
    const result = (await response.json()) as {
      error?: string;
      round?: number;
      scriptRunId?: string | null;
      status?: string;
      elapsedSeconds?: number;
      timerStartedAt?: string | null;
    };
    setPending(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao controlar a sessão.");
    if (action === "advance") {
      setTurn(result.round ?? turn);
      setNotice(
        `Turno avançado no servidor${result.round !== undefined ? ` · rodada ${result.round}` : ""}${
          result.scriptRunId ? " · roteiro sincronizado" : " · sem roteiro em execução"
        }.`,
      );
      return;
    }
    window.dispatchEvent(new CustomEvent("z7:session-control", { detail: result }));
    if (action === "restart") setTurn(0);
    setStatus(result.status ?? (action === "pause" ? "paused" : action === "end" ? "ended" : "active"));
    setConfirmingEnd(false);
    setConfirmingRestart(false);
    setNotice(
      action === "end" ? "Sessão encerrada e sincronizada. Você ainda pode reabri-la." :
      action === "pause" ? "Sessão pausada. O cronômetro foi preservado." :
      action === "reopen" ? "Sessão reaberta e transmissão retomada." :
      action === "restart" ? "Sessão reiniciada: cronômetro, turno e roteiro voltaram ao início." :
      action === "start" ? "Sessão iniciada. A central está transmitindo." :
      "Sessão retomada.",
    );
  }
  const primaryAction = waiting ? "start" : paused ? "resume" : ended ? "reopen" : "pause";
  return (
    <div aria-live="polite">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => void control(primaryAction)} disabled={pending}>
          {ended ? <RotateCcw size={15} /> : waiting || paused ? <Play size={15} /> : <Pause size={15} />}
          {waiting ? "Iniciar sessão" : paused ? "Retomar sessão" : ended ? "Reabrir sessão" : "Pausar"}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => void control("advance")} disabled={status !== "active" || pending}>
          <SkipForward size={15} /> Avançar turno ({turn})
        </button>
        {!confirmingRestart && <button type="button" className="btn" onClick={() => { setConfirmingRestart(true); setConfirmingEnd(false); }} disabled={pending || waiting}>
          <RefreshCcw size={14} /> Reiniciar sessão
        </button>}
        {!ended && !confirmingEnd && !confirmingRestart && <button type="button" className="btn" onClick={() => { setConfirmingEnd(true); setConfirmingRestart(false); }} disabled={pending || waiting}>
          <Square size={14} /> Encerrar sessão
        </button>}
        {confirmingRestart && <>
          <button type="button" className="btn border-[#7a5530] bg-[#734817]/25 text-[#f2c38a]" onClick={() => void control("restart")} disabled={pending}>
            <TriangleAlert size={14} /> Confirmar reinício
          </button>
          <button type="button" className="btn px-3" onClick={() => setConfirmingRestart(false)} disabled={pending}><X size={14} /> Cancelar</button>
        </>}
        {confirmingEnd && <>
          <button type="button" className="btn border-[#7a3039] bg-[#731722]/25 text-[#f6a4ad]" onClick={() => void control("end")} disabled={pending}>
            <TriangleAlert size={14} /> Confirmar encerramento
          </button>
          <button type="button" className="btn px-3" onClick={() => setConfirmingEnd(false)} disabled={pending}>
            <X size={14} /> Cancelar
          </button>
        </>}
      </div>
      {notice && <p className="mt-2 text-xs text-[#7bd5a5]">{notice}</p>}
    </div>
  );
}
