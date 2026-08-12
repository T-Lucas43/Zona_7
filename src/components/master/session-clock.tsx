"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3 } from "lucide-react";

type ClockState = { elapsedSeconds: number; timerStartedAt: string | null; status: string };

function formatDuration(total: number) {
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

export function SessionClock({
  initialElapsedSeconds,
  initialTimerStartedAt,
  initialStatus,
}: {
  initialElapsedSeconds: number;
  initialTimerStartedAt?: string | null;
  initialStatus: string;
}) {
  const [clock, setClock] = useState<ClockState>({
    elapsedSeconds: initialElapsedSeconds,
    timerStartedAt: initialTimerStartedAt ?? null,
    status: initialStatus,
  });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    const update = (event: Event) => {
      const detail = (event as CustomEvent<Partial<ClockState>>).detail;
      setClock((current) => ({ ...current, ...detail }));
      setNow(Date.now());
    };
    window.addEventListener("z7:session-control", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("z7:session-control", update);
    };
  }, []);

  const elapsed = useMemo(() => {
    if (clock.status !== "active" || !clock.timerStartedAt) return clock.elapsedSeconds;
    return clock.elapsedSeconds + Math.max(0, Math.floor((now - Date.parse(clock.timerStartedAt)) / 1_000));
  }, [clock, now]);

  return (
    <div className="session-clock" aria-label={`Duração da sessão ${formatDuration(elapsed)}`}>
      <Clock3 size={16} />
      <span>
        <small>DURAÇÃO</small>
        <strong>{formatDuration(elapsed)}</strong>
      </span>
      {clock.status === "active" && <i aria-label="Cronômetro em andamento" />}
    </div>
  );
}
