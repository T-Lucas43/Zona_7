"use client";

import { useMemo, useRef, useState } from "react";
import {
  ImageUp,
  Link2,
  Link2Off,
  Map,
  Move,
  PanelLeftClose,
  PanelLeftOpen,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getCharacterPortraitStyle } from "@/components/character/character-portrait";
import type { CenaDaCampanha } from "@/server/repositories/master-repository";

function tokenPortraitStyle(token: CenaDaCampanha["tokens"][number]): React.CSSProperties | null {
  return getCharacterPortraitStyle(token.nome, token.portraitUrl);
}

function tokenBodyProfile(token: CenaDaCampanha["tokens"][number]) {
  const key = token.nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .split(/\s+/)[0];
  if (["davi", "magnus", "arya", "lize", "amber", "gragas"].includes(key)) return key;
  if (token.actorType === "entity" || token.actorType === "narrator") return "entity";
  if (token.actorType === "environment") return "environment";
  if (token.actorType === "threat") return "threat";
  return "npc";
}

export function MapStudio({
  campaignId,
  initialScene,
  collective = false,
  hiddenCharacterIds = [],
  allowedCharacterIds,
  selectedCharacterId,
  onSelectCharacter,
  stackControls = false,
  workspace = false,
  sideContent,
}: {
  campaignId: string;
  initialScene: CenaDaCampanha;
  collective?: boolean;
  hiddenCharacterIds?: string[];
  allowedCharacterIds?: string[];
  selectedCharacterId?: string;
  onSelectCharacter?: (characterId: string) => void;
  stackControls?: boolean;
  workspace?: boolean;
  sideContent?: React.ReactNode;
}) {
  const [cena, setCena] = useState(initialScene);
  const [selecionado, setSelecionado] = useState(initialScene.tokens[0]?.id ?? "");
  const [motivo, setMotivo] = useState("Movimento manual do mestre");
  const [aviso, setAviso] = useState("");
  const [fundo, setFundo] = useState<string | null>(initialScene.backgroundUrl ?? null);
  const [zoom, setZoom] = useState(100);
  const [connections, setConnections] = useState(initialScene.connections);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const mapa = useRef<HTMLDivElement>(null);
  const availableTokens = useMemo(
    () =>
      cena.tokens.filter(
        (token) =>
          !token.characterId ||
          !allowedCharacterIds ||
          allowedCharacterIds.includes(token.characterId),
      ),
    [allowedCharacterIds, cena.tokens],
  );
  const effectiveSelectedTokenId = availableTokens.some((token) => token.id === selecionado)
    ? selecionado
    : (availableTokens[0]?.id ?? "");
  const renderedTokens = availableTokens.filter(
    (token) =>
      token.visivel && (!token.characterId || !hiddenCharacterIds.includes(token.characterId)),
  );
  const nextZIndex = () => Math.max(0, ...cena.tokens.map((token) => token.zIndex)) + 1;

  async function persistToken(tokenId: string, x: number, y: number, zIndex: number) {
    const response = await fetch("/api/master/map/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, tokenId, x, y, zIndex, reason: motivo }),
    });
    const result = (await response.json()) as { error?: string };
    setAviso(
      response.ok
        ? "Posição e foco salvos e distribuídos em tempo real."
        : (result.error ?? "Falha ao mover token."),
    );
    return response.ok;
  }

  async function mover(event: React.MouseEvent<HTMLDivElement>) {
    if (collective || connectionMode || !effectiveSelectedTokenId || !mapa.current) return;
    const rect = mapa.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const zIndex = nextZIndex();
    if (!(await persistToken(effectiveSelectedTokenId, x, y, zIndex))) return;
    setCena((atual) => ({
      ...atual,
      tokens: atual.tokens.map((token) =>
        token.id === effectiveSelectedTokenId ? { ...token, x, y, zIndex } : token,
      ),
    }));
  }

  function beginTokenDrag(
    event: React.PointerEvent<HTMLButtonElement>,
    token: CenaDaCampanha["tokens"][number],
  ) {
    event.stopPropagation();
    if (collective || connectionMode || !mapa.current) return;
    const rect = mapa.current.getBoundingClientRect();
    const pointerX = (event.clientX - rect.left) / rect.width;
    const pointerY = (event.clientY - rect.top) / rect.height;
    const zIndex = nextZIndex();
    setSelecionado(token.id);
    setCena((current) => ({
      ...current,
      tokens: current.tokens.map((item) => (item.id === token.id ? { ...item, zIndex } : item)),
    }));
    setDragging({ id: token.id, dx: pointerX - token.x, dy: pointerY - token.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragToken(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging || !mapa.current) return;
    const rect = mapa.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width - dragging.dx));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height - dragging.dy));
    setCena((current) => ({
      ...current,
      tokens: current.tokens.map((token) =>
        token.id === dragging.id ? { ...token, x, y } : token,
      ),
    }));
  }

  async function endTokenDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const token = cena.tokens.find((item) => item.id === dragging.id);
    setDragging(null);
    if (token) await persistToken(token.id, token.x, token.y, token.zIndex);
  }

  async function chooseConnection(tokenId: string) {
    if (!connectionMode || collective) return;
    if (!connectionSource) {
      setConnectionSource(tokenId);
      setAviso("Escolha o segundo token para criar ou remover o fio.");
      return;
    }
    if (connectionSource === tokenId) return setConnectionSource(null);
    const response = await fetch("/api/master/map/connections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sceneId: cena.id,
        fromTokenId: connectionSource,
        toTokenId: tokenId,
      }),
    });
    const result = (await response.json()) as {
      connected?: boolean;
      id?: string;
      fromTokenId?: string;
      toTokenId?: string;
      error?: string;
    };
    if (response.ok) {
      if (result.connected && result.id && result.fromTokenId && result.toTokenId) {
        setConnections((current) => [
          ...current,
          { id: result.id!, fromTokenId: result.fromTokenId!, toTokenId: result.toTokenId! },
        ]);
      } else {
        const pair = [connectionSource, tokenId].sort().join(":");
        setConnections((current) =>
          current.filter((item) => [item.fromTokenId, item.toTokenId].sort().join(":") !== pair),
        );
      }
      setAviso(
        result.connected ? "Tokens conectados com fio vermelho." : "Conexão entre tokens removida.",
      );
    } else setAviso(result.error ?? "Falha ao conectar tokens.");
    setConnectionSource(null);
  }
  async function enviarMapa(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFundo(URL.createObjectURL(file));
    const form = new FormData();
    form.set("campaignId", campaignId);
    form.set("sceneId", cena.id);
    form.set("assetType", "map");
    form.set("title", file.name);
    form.set("file", file);
    const response = await fetch("/api/master/media", { method: "POST", body: form });
    const result = (await response.json()) as { signedUrl?: string; error?: string };
    if (result.signedUrl) setFundo(result.signedUrl);
    setAviso(
      response.ok
        ? "Mapa enviado. Ajuste grade e posições antes de publicar."
        : (result.error ?? "Falha no envio do mapa."),
    );
  }
  return (
    <div
      className={
        collective
          ? "min-h-[calc(100vh-8rem)]"
          : workspace
            ? "session-map-workspace"
            : stackControls
              ? "space-y-4"
              : "mt-6 grid gap-4 xl:grid-cols-[1fr_280px]"
      }
      data-tools-collapsed={workspace && toolsCollapsed}
    >
      <section
        className={`panel overflow-hidden rounded-lg ${workspace ? "session-map-canvas" : ""}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30333a] p-4">
          <div>
            <p className="eyebrow">{collective ? "tela coletiva" : "editor de cena"}</p>
            <h2 className="font-extrabold">{cena.nome}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag">
              <Map size={12} /> {cena.modoGrade}
            </span>
            <div
              className="flex items-center rounded-full border border-[#34373e] bg-black/20 p-0.5"
              aria-label="Zoom do mapa"
            >
              <button
                className="grid size-8 place-items-center rounded-full hover:bg-white/5"
                type="button"
                aria-label="Diminuir zoom"
                onClick={() => setZoom((value) => Math.max(100, value - 25))}
              >
                <ZoomOut size={14} />
              </button>
              <span className="min-w-12 text-center font-mono text-[0.65rem]" aria-live="polite">
                {zoom}%
              </span>
              <button
                className="grid size-8 place-items-center rounded-full hover:bg-white/5"
                type="button"
                aria-label="Aumentar zoom"
                onClick={() => setZoom((value) => Math.min(250, value + 25))}
              >
                <ZoomIn size={14} />
              </button>
            </div>
          </div>
        </div>
        <div
          className={`map-viewport overflow-auto bg-[#090c10] ${workspace ? "session-map-viewport" : "aspect-video"}`}
        >
          <div
            ref={mapa}
            onClick={(event) => void mover(event)}
            className="relative min-h-full bg-[#090c10]"
            style={
              {
                width: `${zoom}%`,
                aspectRatio: "16 / 9",
                backgroundImage: fundo
                  ? `linear-gradient(#07090b66,#07090b66),url(${fundo})`
                  : "linear-gradient(#182028 1px,transparent 1px),linear-gradient(90deg,#182028 1px,transparent 1px)",
                backgroundSize: fundo ? "cover" : "6.25% 11.11%",
                "--map-scale": zoom / 100,
              } as React.CSSProperties
            }
            aria-label="Mapa interativo"
          >
            {!fundo && (
              <div className="absolute inset-0 grid place-items-center text-center text-[#5f6872]">
                <div>
                  <Map size={40} className="mx-auto mb-3" />
                  <p>
                    {collective
                      ? "Mapa aguardando transmissão"
                      : "Envie uma imagem ou use a grade de preparação"}
                  </p>
                </div>
              </div>
            )}
            <svg
              className="map-threads absolute inset-0 z-[1] size-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {connections.map((connection) => {
                const from = renderedTokens.find((token) => token.id === connection.fromTokenId);
                const to = renderedTokens.find((token) => token.id === connection.toTokenId);
                if (!from || !to) return null;
                return (
                  <line
                    key={connection.id}
                    x1={from.x * 100}
                    y1={from.y * 100}
                    x2={to.x * 100}
                    y2={to.y * 100}
                  />
                );
              })}
            </svg>
            {renderedTokens.map((token) => {
              const portraitStyle = tokenPortraitStyle(token);
              return (
                <button
                  type="button"
                  key={token.id}
                  aria-label={`Token de ${token.nome}`}
                  className={`map-token map-token-${tokenBodyProfile(token)} absolute z-10 ${effectiveSelectedTokenId === token.id || selectedCharacterId === token.characterId ? "map-token-selected" : ""}`}
                  style={
                    {
                      left: `${token.x * 100}%`,
                      top: `${token.y * 100}%`,
                      zIndex: token.zIndex,
                      "--token-color": token.cor,
                    } as React.CSSProperties
                  }
                  onPointerDown={(event) => beginTokenDrag(event, token)}
                  onPointerMove={dragToken}
                  onPointerUp={(event) => void endTokenDrag(event)}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (connectionMode) return void chooseConnection(token.id);
                    if (!collective) setSelecionado(token.id);
                    if (!collective && token.characterId) onSelectCharacter?.(token.characterId);
                  }}
                >
                  <span className="map-token-shadow" aria-hidden="true" />
                  <span className="map-token-body" aria-hidden="true">
                    <span />
                  </span>
                  <span
                    className="map-token-head"
                    style={{ backgroundColor: token.cor, ...portraitStyle }}
                    data-portrait={portraitStyle ? "true" : "false"}
                  >
                    {!portraitStyle && token.nome.slice(0, 2).toUpperCase()}
                  </span>
                  {token.characterState === "dead" && (
                    <span
                      className="absolute left-1/2 top-[28%] z-30 -translate-x-1/2 text-5xl font-black leading-none text-[#ff3345] drop-shadow-[0_2px_4px_#000]"
                      aria-label="Personagem morto"
                    >
                      ×
                    </span>
                  )}
                  <span className="map-token-name">{token.nome}</span>
                  {connectionSource === token.id && (
                    <span
                      className="absolute -inset-2 rounded-full border-2 border-[#ef3347] shadow-[0_0_18px_#d2172b]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
        {collective && (
          <div className="flex justify-center gap-2 p-4">
            <span className="tag">
              <span className="status-dot" /> Cena sincronizada
            </span>
            <span className="tag">Segredos ocultos</span>
          </div>
        )}
      </section>
      {!collective && (
        <aside
          className={
            workspace
              ? "session-map-tools"
              : stackControls
                ? "grid gap-4 md:grid-cols-2"
                : "space-y-4"
          }
        >
          {workspace && (
            <button
              className="session-rail-toggle"
              type="button"
              onClick={() => setToolsCollapsed((value) => !value)}
              aria-label={
                toolsCollapsed ? "Abrir ferramentas do mapa" : "Recolher ferramentas do mapa"
              }
            >
              {toolsCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              {!toolsCollapsed && <span>Ferramentas</span>}
            </button>
          )}
          {!toolsCollapsed && (
            <>
              <section className="panel rounded-lg p-4">
                <Move size={17} className="text-[#d84b57]" />
                <h3 className="mt-3 font-extrabold">Movimentação</h3>
                <button
                  className={`btn mt-3 w-full ${connectionMode ? "btn-primary" : ""}`}
                  type="button"
                  onClick={() => {
                    setConnectionMode((value) => !value);
                    setConnectionSource(null);
                  }}
                >
                  {connectionMode ? <Link2Off size={14} /> : <Link2 size={14} />}
                  {connectionMode ? "Encerrar conexões" : "Conectar tokens"}
                </button>
                {connectionMode && (
                  <p className="mt-2 text-xs text-[#e8a3aa]">
                    Clique em dois tokens para criar ou remover o fio vermelho.
                  </p>
                )}
                <label className="mt-3 block text-xs font-bold">
                  Token
                  <select
                    className="field mt-1"
                    value={effectiveSelectedTokenId}
                    onChange={(event) => setSelecionado(event.target.value)}
                  >
                    {availableTokens.map((token) => (
                      <option value={token.id} key={token.id}>
                        {token.nome}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block text-xs font-bold">
                  Motivo
                  <input
                    className="field mt-1"
                    value={motivo}
                    onChange={(event) => setMotivo(event.target.value)}
                  />
                </label>
                <p className="mt-3 text-xs text-[#777a82]">
                  Arraste o token livremente ou selecione-o e clique no mapa. O servidor registra
                  posição, ordem visual e responsável.
                </p>
              </section>
              <section className="panel rounded-lg p-4">
                <ImageUp size={17} className="text-[#d84b57]" />
                <h3 className="mt-3 font-extrabold">Imagem do mapa</h3>
                <label className="btn mt-3 cursor-pointer">
                  <ImageUp size={14} /> Enviar mapa
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(event) => void enviarMapa(event)}
                  />
                </label>
              </section>
              {sideContent}
            </>
          )}
        </aside>
      )}
      {aviso && (
        <p className="text-xs text-[#7bd5a5] xl:col-span-2" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
