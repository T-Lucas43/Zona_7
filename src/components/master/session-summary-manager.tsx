"use client";

import { useEffect, useState } from "react";
import { ChevronDown, FileDown, FileText, RefreshCcw, Save } from "lucide-react";
import { readSessionDraft, writeSessionDraft } from "@/lib/session-draft";
import type { SessionSummaryData } from "@/server/repositories/session-history-repository";

const fields = [
  ["decisions", "Decisões tomadas"],
  ["clues", "Pistas descobertas"],
  ["items", "Itens recebidos"],
  ["conditions", "Condições"],
  ["deaths", "Mortes"],
  ["meters", "Evolução dos medidores"],
  ["pendingTopics", "Assuntos pendentes"],
] as const;

export function SessionSummaryManager({
  campaignId,
  sessionId,
  sessionTitle,
  initialSummary,
}: {
  campaignId: string;
  sessionId: string;
  sessionTitle: string;
  initialSummary: SessionSummaryData | null;
}) {
  const empty: SessionSummaryData = {
    revision: 0,
    title: "Relatório - " + sessionTitle,
    overview: "",
    decisions: [],
    clues: [],
    items: [],
    conditions: [],
    deaths: [],
    meters: [],
    pendingTopics: [],
  };
  const [summary, setSummary] = useState(initialSummary ?? empty);
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const draftKey = "zona7:session-summary:" + campaignId + ":" + sessionId;

  useEffect(() => {
    const draft = readSessionDraft<SessionSummaryData>(draftKey);
    const frame = window.requestAnimationFrame(() => {
      if (draft) setSummary(draft);
      setDraftReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [draftKey]);

  useEffect(() => {
    if (draftReady) writeSessionDraft(draftKey, summary);
  }, [draftKey, draftReady, summary]);

  async function act(action: "generate" | "save" | "publish") {
    setPending(true);
    setNotice("");
    const response = await fetch("/api/master/session/summary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId, action, summary }),
    });
    const result = await response.json() as SessionSummaryData & {
      error?: string;
      published_at?: string;
      updated_at?: string;
    };
    setPending(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao atualizar o resumo.");
    setSummary({
      ...result,
      publishedAt: result.published_at,
      updatedAt: result.updated_at,
    });
    setNotice(
      action === "generate"
        ? "Resumo criado a partir dos eventos da sessão. Revise antes de publicar."
        : action === "publish"
          ? "Resumo publicado para a campanha."
          : "Nova revisão salva.",
    );
  }

  return (
    <section className="panel rounded-lg p-4 session-summary-manager">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">pós-sessão</p>
          <h2 className="font-extrabold">Resumo automático</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="tag">revisão {summary.revision}</span>
          <button
            className="btn px-2"
            type="button"
            aria-expanded={expanded}
            aria-label={expanded ? "Recolher resumo" : "Expandir resumo"}
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              className={expanded ? "rotate-180 transition-transform" : "transition-transform"}
              size={14}
            />
          </button>
        </div>
      </div>
      {expanded && (
        <>
          <input
            className="field mt-3"
            value={summary.title}
            onChange={(event) =>
              setSummary((value) => ({ ...value, title: event.target.value }))
            }
          />
          <textarea
            className="field mt-2 min-h-24"
            placeholder="Visão geral da sessão"
            value={summary.overview}
            onChange={(event) =>
              setSummary((value) => ({ ...value, overview: event.target.value }))
            }
          />
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {fields.map(([key, label]) => (
              <label className="text-xs font-bold" key={key}>
                {label}
                <textarea
                  className="field mt-1 min-h-20"
                  value={summary[key].join("\n")}
                  onChange={(event) =>
                    setSummary((value) => ({
                      ...value,
                      [key]: event.target.value
                        .split("\n")
                        .map((item) => item.trim())
                        .filter(Boolean),
                    }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" type="button" disabled={pending} onClick={() => void act("generate")}>
              <RefreshCcw size={14} /> Gerar novamente
            </button>
            <button className="btn" type="button" disabled={pending} onClick={() => void act("save")}>
              <Save size={14} /> Salvar revisão
            </button>
            <button className="btn btn-primary" type="button" disabled={pending} onClick={() => void act("publish")}>
              <FileText size={14} /> Publicar
            </button>
            <a className="btn" href={"/api/master/session/" + sessionId + "/report.pdf"} target="_blank">
              <FileText size={14} /> Visualizar no papel
            </a>
            <a className="btn" href={"/api/master/session/" + sessionId + "/report.pdf?download=1"}>
              <FileDown size={14} /> Exportar PDF
            </a>
          </div>
          {notice && <p className="session-notice mt-3">{notice}</p>}
        </>
      )}
    </section>
  );
}
