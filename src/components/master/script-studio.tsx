"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleStop,
  FileCode2,
  Pause,
  Play,
  RadioTower,
  Upload,
  Waypoints,
} from "lucide-react";
import type { RoteiroDaCampanha } from "@/server/repositories/master-repository";
import type { ScriptIssue, Zona7Script } from "@/lib/scripts/zona7-parser";

const exemplo = `---
zona7_script_version: 1
id: novo-roteiro
title: "Novo roteiro Zona 7"
execution_mode: semi_automatic
start: abertura
variables:
  pressao_zona: 0
---
:::zona7
id: abertura
type: narration
title: Abertura
text: |
  As luzes acendem sete segundos antes da chegada do grupo.
next: decisao
:::
:::zona7
id: decisao
type: choice
prompt: "Por onde o grupo segue?"
options:
  - id: corredor
    label: Seguir pelo corredor
    goto: encerramento
:::
:::zona7
id: encerramento
type: session_end
title: Encerramento
:::`;

const nodeTypeLabels: Record<string, string> = {
  scene_start: "Início de cena",
  location_description: "Descrição do local",
  master_speech: "Fala do mestre",
  narration: "Narração",
  player_prompt: "Pergunta ao jogador",
  free_roleplay: "Interpretação livre",
  choice: "Escolha",
  skill_test: "Teste de perícia",
  group_test: "Teste em grupo",
  dice_roll: "Rolagem de dados",
  combat_start: "Início de combate",
  combat_end: "Fim de combate",
  message: "Mensagem",
  handout: "Pista",
  media: "Mídia",
  music: "Música",
  map_change: "Troca de mapa",
  token_action: "Ação de token",
  resource_change: "Alteração de recurso",
  condition_change: "Alteração de condição",
  meter_change: "Alteração de medidor",
  ability_unlock: "Liberação de habilidade",
  inventory_change: "Alteração de inventário",
  timer: "Temporizador",
  vote: "Votação",
  checkpoint: "Ponto de restauração",
  branch: "Ramificação",
  scene_end: "Fim de cena",
  session_end: "Fim de sessão",
};

export function ScriptStudio({
  campaignId,
  initialScripts,
  sessionId,
}: {
  campaignId: string;
  initialScripts: RoteiroDaCampanha[];
  sessionId?: string;
}) {
  const [source, setSource] = useState(exemplo);
  const [format, setFormat] = useState<"markdown" | "json">("markdown");
  const [documento, setDocumento] = useState<Zona7Script | null>(null);
  const [issues, setIssues] = useState<ScriptIssue[]>([]);
  const [aviso, setAviso] = useState("");
  const [atual, setAtual] = useState<string | null>(null);
  const [importando, setImportando] = useState(false);
  const [publicando, setPublicando] = useState(false);
  const [publishedScripts, setPublishedScripts] = useState(initialScripts);
  const [publishedId, setPublishedId] = useState(initialScripts[0]?.id ?? "");
  const [runId, setRunId] = useState("");
  const [runStatus, setRunStatus] = useState("preparando");
  const [reason, setReason] = useState("Avanço confirmado pelo mestre");
  const node = useMemo(
    () => documento?.nodes.find((item) => item.id === atual) ?? documento?.nodes[0],
    [documento, atual],
  );
  async function validar() {
    const response = await fetch("/api/master/scripts/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, source, format }),
    });
    const result = (await response.json()) as {
      document?: Zona7Script;
      issues?: ScriptIssue[];
      error?: string;
    };
    if (!response.ok) {
      setDocumento(null);
      return setAviso(result.error ?? "Roteiro inválido.");
    }
    setDocumento(result.document ?? null);
    setIssues(result.issues ?? []);
    setAtual(result.document?.startNodeId ?? null);
    setAviso("Validação concluída. Nenhuma ação foi executada.");
  }
  async function publicar() {
    setPublicando(true);
    const response = await fetch("/api/master/scripts/publish", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, source, format }),
    });
    const result = (await response.json()) as { id?: string; version?: number; title?: string; reused?: boolean; error?: string };
    setPublicando(false);
    if (response.ok && result.id) {
      setPublishedId(result.id);
      setPublishedScripts((items) => {
        const next = {
          id: result.id!,
          nome: result.title ?? documento?.title ?? "Roteiro publicado",
          descricao: "Disponível na Central da Sessão",
          estado: "published",
          versao: result.version ?? 1,
        };
        return [next, ...items.filter((item) => item.id !== next.id)];
      });
    }
    setAviso(
      response.ok
        ? result.reused
          ? `Este conteúdo já era a versão ${result.version}; o roteiro foi republicado e está disponível na Central.`
          : `Roteiro publicado como versão ${result.version} e enviado à Central da Sessão.`
        : (result.error ?? "Falha ao publicar."),
    );
  }
  async function carregar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (/\.(txt|docx|pdf)$/i.test(file.name)) {
      setImportando(true);
      const form = new FormData();
      form.set("campaignId", campaignId);
      form.set("file", file);
      const response = await fetch("/api/master/scripts/extract", { method: "POST", body: form });
      const result = (await response.json()) as {
        source?: string;
        warning?: string;
        error?: string;
      };
      setImportando(false);
      if (!response.ok || !result.source)
        return setAviso(result.error ?? "Não foi possível extrair o arquivo.");
      setSource(result.source);
      setFormat("markdown");
      setDocumento(null);
      setIssues([]);
      return setAviso(result.warning ?? "Rascunho assistido criado. Revise antes de publicar.");
    }
    const text = await file.text();
    setSource(text);
    setFormat(/\.json$/i.test(file.name) ? "json" : "markdown");
    setAviso("Arquivo carregado como rascunho. Valide antes de publicar.");
  }
  function proximo(target?: string) {
    if (target) return setAtual(target);
    const edge = documento?.edges.find((item) => item.source === node?.id);
    if (edge) setAtual(edge.target);
  }
  async function controlar(
    action: "start" | "advance" | "pause" | "resume" | "improvise" | "complete",
    targetNodeKey?: string,
  ) {
    const response = await fetch("/api/master/scripts/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sessionId,
        action,
        scriptPackageId: action === "start" ? publishedId : undefined,
        runId: action === "start" ? undefined : runId,
        targetNodeKey,
        reason,
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const result = (await response.json()) as {
      runId?: string;
      status?: string;
      currentNodeKey?: string;
      error?: string;
    };
    if (!response.ok) return setAviso(result.error ?? "Falha no controle do roteiro.");
    if (result.runId) setRunId(result.runId);
    const translated =
      {
        running: "em execução",
        paused: "pausado",
        improvising: "em improviso",
        completed: "encerrado",
      }[result.status ?? ""] ??
      result.status ??
      "atualizado";
    setRunStatus(translated);
    if (result.currentNodeKey) setAtual(result.currentNodeKey);
    else if (targetNodeKey) setAtual(targetNodeKey);
    setAviso(`Execução ${translated}. O evento foi distribuído em sequência e auditado.`);
  }
  return (
    <div className="mt-6 space-y-4">
      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <div className="space-y-4">
          <section className="panel rounded-lg p-5">
            <div className="flex items-center gap-2">
              <Waypoints size={18} className="text-[#d84b57]" />
              <h2 className="font-extrabold">Roteiros cadastrados</h2>
            </div>
            {publishedScripts.map((roteiro) => (
              <button
                type="button"
                className={`mt-3 w-full rounded border p-3 text-left ${publishedId === roteiro.id ? "border-[#6c343a] bg-[#8a1b27]/10" : "border-[#30333a]"}`}
                key={roteiro.id}
                onClick={() => setPublishedId(roteiro.id)}
              >
                <div className="flex justify-between gap-2">
                  <strong className="text-sm">{roteiro.nome}</strong>
                  <span className="tag">versão {roteiro.versao}</span>
                </div>
                <p className="mt-2 text-xs text-[#777a82]">{roteiro.descricao}</p>
              </button>
            ))}
          </section>
          <section className="panel rounded-lg p-5">
            <Upload size={18} className="text-[#d84b57]" />
            <h2 className="mt-3 font-extrabold">Importar roteiro</h2>
            <label className="btn mt-3 cursor-pointer">
              <Upload size={14} /> {importando ? "Extraindo..." : "Selecionar arquivo"}
              <input
                className="sr-only"
                type="file"
                accept=".z7.md,.md,.z7.json,.json,.txt,.docx,.pdf"
                disabled={importando}
                onChange={(event) => void carregar(event)}
              />
            </label>
            <p className="mt-3 text-xs text-[#777a82]">
              Markdown Zona 7 e JSON canônico são determinísticos. TXT, DOCX e PDF sempre passam por
              revisão humana.
            </p>
          </section>
        </div>
        <section className="panel rounded-lg p-5">
          <div className="flex flex-wrap justify-between gap-3">
            <div>
              <p className="eyebrow">rascunho seguro</p>
              <h2 className="font-extrabold">Editor do roteiro</h2>
            </div>
            <select
              className="field w-auto"
              value={format}
              onChange={(event) => setFormat(event.target.value as "markdown" | "json")}
            >
              <option value="markdown">Markdown Zona 7</option>
              <option value="json">JSON canônico</option>
            </select>
          </div>
          <textarea
            className="field mt-4 min-h-[520px] font-mono text-xs leading-5"
            value={source}
            onChange={(event) => setSource(event.target.value)}
            spellCheck={false}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn" type="button" onClick={() => void validar()}>
              <CheckCircle2 size={14} /> Validar sem executar
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={source.trim().length < 10 || importando || publicando}
              onClick={() => void publicar()}
            >
              <FileCode2 size={14} /> {publicando ? "Publicando..." : "Validar e publicar"}
            </button>
          </div>
        </section>
      </section>
      {documento && (
        <section className="panel rounded-lg p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="eyebrow">simulação controlada</p>
              <h2 className="font-extrabold">{node?.title ?? node?.id}</h2>
            </div>
            <span className="tag">{nodeTypeLabels[node?.type ?? ""] ?? node?.type}</span>
          </div>
          <p className="mt-4 text-sm leading-6 text-[#a4a6ac]">
            {String(node?.text ?? node?.prompt ?? "Nó sem texto público.")}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {documento.edges
              .filter((edge) => edge.source === node?.id)
              .map((edge) => (
                <button
                  className="btn"
                  type="button"
                  key={`${edge.type}-${edge.target}`}
                  onClick={() =>
                    runId && runStatus !== "encerrado"
                      ? void controlar("advance", edge.target)
                      : proximo(edge.target)
                  }
                >
                  <Play size={13} /> {runId ? "Avançar" : "Simular"}: {edge.label ?? edge.target}
                </button>
              ))}
          </div>
          <p className="mt-4 text-xs text-[#777a82]">
            A simulação não altera fichas, recursos, mapa ou mensagens. Consequências sensíveis
            exigem confirmação durante a execução real.
          </p>
        </section>
      )}
      <section className="panel rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">execução real e sequenciada</p>
            <h2 className="font-extrabold">Controle do roteiro publicado</h2>
            <p className="mt-2 text-xs text-[#777a82]">
              Estado: {runStatus} · mudanças sensíveis exigem confirmação do mestre.
            </p>
          </div>
          <span className="tag">
            <RadioTower size={12} /> Tempo real
          </span>
        </div>
        <label className="mt-4 block text-xs font-bold">
          Justificativa da operação
          <input
            className="field mt-1"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </label>
        <div className="mt-4 flex flex-wrap gap-2">
          {!runId ? (
            <button
              className="btn btn-primary"
              type="button"
              disabled={!publishedId || !sessionId || reason.trim().length < 2}
              onClick={() => void controlar("start")}
            >
              <Play size={14} /> Executar versão publicada
            </button>
          ) : (
            <>
              {runStatus === "pausado" || runStatus === "em improviso" ? (
                <button
                  className="btn btn-primary"
                  type="button"
                  onClick={() => void controlar("resume")}
                >
                  <Play size={14} /> Retomar
                </button>
              ) : (
                <button
                  className="btn"
                  type="button"
                  disabled={runStatus === "encerrado"}
                  onClick={() => void controlar("pause")}
                >
                  <Pause size={14} /> Pausar
                </button>
              )}
              <button
                className="btn"
                type="button"
                disabled={runStatus === "encerrado"}
                onClick={() => void controlar("improvise")}
              >
                Improvisar
              </button>
              <button
                className="btn"
                type="button"
                disabled={runStatus === "encerrado"}
                onClick={() => void controlar("complete")}
              >
                <CircleStop size={14} /> Encerrar execução
              </button>
            </>
          )}
        </div>
        {!sessionId && <p className="mt-3 text-xs text-[#e2b341]">Crie uma sessão antes de executar este roteiro. A publicação continua disponível na Central.</p>}
      </section>
      {issues.length > 0 && (
        <section className="panel rounded-lg p-4">
          <h3 className="font-extrabold">Resultado da validação</h3>
          {issues.map((issue, index) => (
            <p
              className={
                issue.severity === "error"
                  ? "mt-2 text-xs text-[#f0a5ad]"
                  : "mt-2 text-xs text-[#e2b341]"
              }
              key={`${issue.code}-${index}`}
            >
              {issue.severity === "error" ? "Erro" : "Aviso"}: {issue.message}
            </p>
          ))}
        </section>
      )}
      {aviso && (
        <p className="text-xs text-[#7bd5a5]" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
