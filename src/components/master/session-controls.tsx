"use client";

import { useState } from "react";
import { Pause, Play, SkipForward, Square } from "lucide-react";

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
  const [paused, setPaused] = useState(initialStatus === "paused");
  const [started, setStarted] = useState(!["draft", "scheduled", "open"].includes(initialStatus));
  const [turn, setTurn] = useState(initialTurn);
  const [ended, setEnded] = useState(initialStatus === "ended");
  const [notice, setNotice] = useState("");
  async function control(action: "start" | "pause" | "resume" | "end") {
    const response = await fetch("/api/master/session/control", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId, action }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao controlar a sessão.");
    if (action === "end") setEnded(true);
    else { setStarted(true); setPaused(action === "pause"); }
    setNotice(action === "end" ? "Sessão encerrada e sincronizada." : action === "pause" ? "Sessão pausada." : action === "start" ? "Sessão iniciada. A central está transmitindo." : "Sessão retomada.");
  }
  return (
    <div aria-live="polite">
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn" onClick={() => void control(!started ? "start" : paused ? "resume" : "pause")} disabled={ended}>
          {!started || paused ? <Play size={15} /> : <Pause size={15} />} {!started ? "Iniciar sessão" : paused ? "Retomar" : "Pausar"}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => setTurn((value) => value + 1)} disabled={paused || ended}>
          <SkipForward size={15} /> Avançar turno ({turn})
        </button>
        <button type="button" className="btn" onClick={() => void control("end")} disabled={ended}>
          <Square size={14} /> {ended ? "Encerrada" : "Encerrar"}
        </button>
      </div>
      {notice && <p className="mt-2 text-xs text-[#7bd5a5]">{notice}</p>}
    </div>
  );
}
