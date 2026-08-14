"use client";

import { useEffect, useState } from "react";
import { Dices, X } from "lucide-react";
import { CheckRequestCard } from "@/components/player/check-request-card";
import type { CharacterCheckRequest } from "@/server/repositories/character-repository";

export function CheckRequestPopup({ requests }: { requests: CharacterCheckRequest[] }) {
  const [active, setActive] = useState<CharacterCheckRequest | null>(() => requests[0] ?? null);
  const [dismissed, setDismissed] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    const next = requests.find((request) => !dismissed.has(request.id));
    if (next && next.id !== active?.id) {
      const frame = window.requestAnimationFrame(() => setActive(next));
      return () => window.cancelAnimationFrame(frame);
    }
  }, [active?.id, dismissed, requests]);

  if (!active || dismissed.has(active.id)) return null;

  function close() {
    setDismissed((current) => new Set(current).add(active!.id));
    setActive(null);
  }

  return (
    <div
      className="check-request-popup-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="check-request-popup-title"
    >
      <div className="check-request-popup-shell">
        <header>
          <span>
            <Dices size={18} />
            <strong id="check-request-popup-title">Teste solicitado pelo mestre</strong>
          </span>
          <button className="btn px-2" type="button" onClick={close} aria-label="Fechar solicitação">
            <X size={15} />
          </button>
        </header>
        <CheckRequestCard key={active.id} request={active} />
      </div>
    </div>
  );
}
