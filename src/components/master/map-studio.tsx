"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Gift,
  Brush,
  Copy,
  Eraser,
  EyeOff,
  ImageUp,
  Map,
  Move,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  MousePointer2,
  Square,
  Trash2,
  Undo2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getCharacterPortraitStyle } from "@/components/character/character-portrait";
import { MapRevealLayer, type RevealEditorMode } from "@/components/master/map-reveal-layer";
import { resolveCachedMapImage, storeMapImage } from "@/lib/map-image-cache";
import type { CenaDaCampanha, ItemDaCampanha } from "@/server/repositories/master-repository";

function tokenPortraitStyle(token: CenaDaCampanha["tokens"][number]): React.CSSProperties | null {
  return getCharacterPortraitStyle(token.nome, token.portraitUrl);
}

function tokenBodyProfile(token: CenaDaCampanha["tokens"][number]) {
  if (token.itemId) return "item";
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
  sessionId,
  initialScene,
  collective = false,
  hiddenCharacterIds = [],
  allowedCharacterIds,
  selectedCharacterId,
  onSelectCharacter,
  onSelectToken,
  stackControls = false,
  workspace = false,
  sideContent,
  items = [],
  recipientCharacters = [],
}: {
  campaignId: string;
  sessionId?: string;
  initialScene: CenaDaCampanha;
  collective?: boolean;
  hiddenCharacterIds?: string[];
  allowedCharacterIds?: string[];
  selectedCharacterId?: string;
  onSelectCharacter?: (characterId: string) => void;
  onSelectToken?: (token: CenaDaCampanha["tokens"][number]) => void;
  stackControls?: boolean;
  workspace?: boolean;
  sideContent?: React.ReactNode;
  items?: ItemDaCampanha[];
  recipientCharacters?: Array<{ id: string; name: string }>;
}) {
  const [cena, setCena] = useState(initialScene);
  const [selecionado, setSelecionado] = useState(initialScene.tokens[0]?.id ?? "");
  const [motivo, setMotivo] = useState("Movimento manual do mestre");
  const [aviso, setAviso] = useState("");
  const [fundo, setFundo] = useState<string | null>(
    initialScene.backgroundKey ? null : (initialScene.backgroundUrl ?? null),
  );
  const [zoom, setZoom] = useState(100);
  const [toolsCollapsed, setToolsCollapsed] = useState(false);
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const [placingItemId, setPlacingItemId] = useState("");
  const [selectedItemTokenId, setSelectedItemTokenId] = useState("");
  const [recipientId, setRecipientId] = useState(recipientCharacters[0]?.id ?? "");
  const [reveal, setReveal] = useState(initialScene.reveal);
  const [revealEditing, setRevealEditing] = useState(false);
  const [revealTool, setRevealTool] = useState<RevealEditorMode>("cover");
  const [selectedRevealId, setSelectedRevealId] = useState("");
  const [revealBrush, setRevealBrush] = useState(.05);
  const [revealDraftReady, setRevealDraftReady] = useState(false);
  const [revealServerReady, setRevealServerReady] = useState(false);
  const mapa = useRef<HTMLDivElement>(null);
  const activeBackgroundKey = useRef(initialScene.backgroundKey ?? "");
  const revealAutosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const revealDraftKey = `zona7:map-reveal:${campaignId}:${sessionId ?? "preparacao"}:${initialScene.id}`;
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
  const selectedItemToken = cena.tokens.find((token) => token.id === selectedItemTokenId);
  const selectedMapItem = items.find((item) => item.id === selectedItemToken?.itemId);
  const nextZIndex = () => Math.max(0, ...cena.tokens.map((token) => token.zIndex)) + 1;

  useEffect(() => {
    let disposed = false;
    const backgroundKey = initialScene.backgroundKey ?? "";
    if (!backgroundKey) {
      const frame = window.requestAnimationFrame(() => setFundo(initialScene.backgroundUrl ?? null));
      return () => window.cancelAnimationFrame(frame);
    }
    if (activeBackgroundKey.current !== backgroundKey) {
      activeBackgroundKey.current = backgroundKey;
      const frame = window.requestAnimationFrame(() => setFundo(null));
      void resolveCachedMapImage(backgroundKey, initialScene.backgroundUrl).then((cachedUrl) => {
        window.cancelAnimationFrame(frame);
        if (!disposed && cachedUrl) setFundo(cachedUrl);
      });
      return () => {
        disposed = true;
        window.cancelAnimationFrame(frame);
      };
    }
    void resolveCachedMapImage(backgroundKey, initialScene.backgroundUrl).then((cachedUrl) => {
      if (!disposed && cachedUrl) setFundo(cachedUrl);
    });
    return () => { disposed = true; };
  }, [initialScene.backgroundKey, initialScene.backgroundUrl]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setCena(initialScene);
      if (!revealEditing) setReveal(initialScene.reveal);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialScene, revealEditing]);

  const updateRevealPath = useCallback((path: CenaDaCampanha["reveal"]["paths"][number]) => {
    setReveal((current) => ({
      ...current,
      enabled: true,
      synchronized: false,
      paths: current.paths.map((item) => item.id === path.id ? path : item),
    }));
  }, []);

  function duplicateSelectedReveal() {
    const selected = reveal.paths.find((path) => path.id === selectedRevealId && path.shape === "rectangle");
    if (!selected) return setAviso("Selecione um retângulo para duplicar.");
    const xs = selected.points.map((point) => point.x);
    const ys = selected.points.map((point) => point.y);
    const dx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), .025));
    const dy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), .025));
    const copy = {
      ...selected,
      id: crypto.randomUUID(),
      points: selected.points.map((point) => ({ x: point.x + dx, y: point.y + dy })),
    };
    setReveal((current) => ({ ...current, synchronized: false, paths: [...current.paths, copy] }));
    setSelectedRevealId(copy.id);
    setAviso("Retângulo duplicado. Arraste-o para a nova posição.");
  }

  function deleteSelectedReveal() {
    if (!selectedRevealId) return setAviso("Selecione um retângulo para excluir.");
    setReveal((current) => ({ ...current, synchronized: false, paths: current.paths.filter((path) => path.id !== selectedRevealId) }));
    setSelectedRevealId("");
    setAviso("Retângulo removido do rascunho.");
  }

  useEffect(() => {
    let draft: { reveal?: typeof reveal; editing?: boolean } | null = null;
    try {
      const stored = window.sessionStorage.getItem(revealDraftKey);
      if (stored) draft = JSON.parse(stored) as { reveal?: typeof reveal; editing?: boolean };
    } catch {
      window.sessionStorage.removeItem(revealDraftKey);
    }
    const frame = window.requestAnimationFrame(() => {
      if (draft?.reveal && Array.isArray(draft.reveal.paths)) {
        setReveal(draft.reveal);
        setRevealEditing(draft.editing !== false);
        setRevealServerReady(true);
      }
      setRevealDraftReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [revealDraftKey]);

  const persistRevealMask = useCallback(async (
    next: typeof reveal,
    synchronized: boolean,
    quiet = false,
  ) => {
    if (!sessionId) {
      if (!quiet) setAviso("Inicie uma sessão para editar a ocultação do mapa.");
      return false;
    }
    const response = await fetch("/api/master/map/reveal", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sessionId,
        sceneId: cena.id,
        enabled: next.enabled,
        synchronized,
        paths: next.paths,
      }),
    });
    const result = await response.json() as { version?: number; error?: string };
    if (!response.ok) {
      if (!quiet) setAviso(result.error ?? "Não foi possível salvar a máscara.");
      return false;
    }
    if (!quiet) {
      setReveal((current) => current.paths === next.paths
        ? { ...current, synchronized, version: result.version ?? current.version + 1 }
        : current);
      setAviso(synchronized
        ? "Máscara salva. Finalizando a sincronização com os jogadores."
        : "Rascunho oculto salvo. Você pode continuar desenhando.");
    }
    return true;
  }, [campaignId, cena.id, sessionId]);

  useEffect(() => {
    if (!revealDraftReady) return;
    if (!revealEditing) {
      window.sessionStorage.removeItem(revealDraftKey);
      return;
    }
    window.sessionStorage.setItem(
      revealDraftKey,
      JSON.stringify({ reveal, editing: true, savedAt: new Date().toISOString() }),
    );
    if (!sessionId || !revealServerReady) return;
    if (revealAutosave.current) clearTimeout(revealAutosave.current);
    revealAutosave.current = setTimeout(() => {
      void persistRevealMask(reveal, false, true);
    }, 350);
    return () => {
      if (revealAutosave.current) clearTimeout(revealAutosave.current);
    };
  }, [persistRevealMask, reveal, revealDraftKey, revealDraftReady, revealEditing, revealServerReady, sessionId]);

  async function beginRevealEditing() {
    if (!sessionId) return setAviso("Inicie uma sessão para editar a ocultação do mapa.");
    setRevealEditing(true);
    setRevealServerReady(false);
    setReveal((current) => ({ ...current, enabled: true, synchronized: false }));
    setAviso("Dessincronizando a cena. Seu desenho já está protegido neste navegador.");
    const desync = await fetch("/api/master/session/scene-sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId, sessionId, sceneId: cena.id, enabled: false }),
    });
    if (!desync.ok) return setAviso("O rascunho foi preservado, mas não foi possível dessincronizar a cena com segurança.");
    setRevealServerReady(true);
    setAviso("Cena dessincronizada. Cada traço agora é salvo automaticamente.");
  }

  async function saveReveal(next: typeof reveal, synchronized: boolean) {
    if (!sessionId) return setAviso("Inicie uma sessão para editar a ocultação do mapa.");
    if (synchronized) {
      setRevealServerReady(false);
      if (revealAutosave.current) clearTimeout(revealAutosave.current);
    }
    if (!synchronized) {
      const desync = await fetch("/api/master/session/scene-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, sessionId, sceneId: cena.id, enabled: false }) });
      if (!desync.ok) return setAviso("Não foi possível dessincronizar a cena com segurança.");
    }
    const saved = await persistRevealMask(next, synchronized);
    if (!saved) return;
    if (synchronized) {
      const sync = await fetch("/api/master/session/scene-sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ campaignId, sessionId, sceneId: cena.id, enabled: true }) });
      if (!sync.ok) return setAviso("A máscara foi salva, mas a cena continua dessincronizada.");
      setRevealEditing(false); setRevealServerReady(false); window.sessionStorage.removeItem(revealDraftKey); setAviso("Máscara publicada. A revelação foi atualizada em tempo real para todos os jogadores.");
    } else { setRevealEditing(true); setRevealServerReady(true); setAviso("Rascunho oculto salvo. Cada novo traço continua sendo salvo automaticamente."); }
  }

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
    if (collective || revealEditing || !mapa.current) return;
    const rect = mapa.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    if (placingItemId) {
      const item = items.find((value) => value.id === placingItemId);
      if (!item) return;
      const zIndex = nextZIndex();
      const response = await fetch("/api/master/map/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "item",
          campaignId,
          sceneId: cena.id,
          itemId: item.id,
          x,
          y,
          visibleToPlayers: true,
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) return setAviso(result.error ?? "Falha ao posicionar item.");
      const token: CenaDaCampanha["tokens"][number] = {
        id: result.id,
        itemId: item.id,
        itemImageUrl: item.imageUrl,
        nome: item.nome,
        cor: "#d9b76f",
        x,
        y,
        zIndex,
        visivel: true,
      };
      setCena((current) => ({
        ...current,
        tokens: current.tokens.some((value) => value.itemId === item.id)
          ? current.tokens.map((value) => (value.itemId === item.id ? token : value))
          : [...current.tokens, token],
      }));
      setSelecionado(result.id);
      setSelectedItemTokenId(result.id);
      setPlacingItemId("");
      setAviso(`“${item.nome}” foi colocado no mapa e sincronizado com os jogadores.`);
      return;
    }
    if (!effectiveSelectedTokenId) return;
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
    if (collective || !mapa.current) return;
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

  async function deliverMapItem() {
    const token = cena.tokens.find((value) => value.id === selectedItemTokenId);
    const item = items.find((value) => value.id === token?.itemId);
    const recipient = recipientCharacters.find((value) => value.id === recipientId);
    if (!token || !item || !recipient) return setAviso("Selecione o item e o destinatário.");
    const response = await fetch("/api/master/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "item",
        campaignId,
        sessionId,
        targetCharacterIds: [recipient.id],
        name: item.nome,
        description: item.descricao,
        quantity: 1,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao entregar item.");
    const removed = await removeMapItemToken(
      token,
      `“${item.nome}” foi entregue a ${recipient.name}; o jogador recebeu a notificação.`,
      "Item entregue, mas não foi removido do mapa.",
    );
    if (!removed) return;
  }

  async function removeMapItemToken(
    token: CenaDaCampanha["tokens"][number],
    successMessage: string,
    errorMessage = "Não foi possível remover o item do mapa.",
  ) {
    const removeResponse = await fetch("/api/master/map/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "remove_item", campaignId, tokenId: token.id }),
    });
    const removeResult = (await removeResponse.json()) as { error?: string };
    if (!removeResponse.ok) {
      setAviso(removeResult.error ?? errorMessage);
      return false;
    }
    setCena((current) => ({
      ...current,
      tokens: current.tokens.filter((value) => value.id !== token.id),
    }));
    setSelectedItemTokenId("");
    if (selecionado === token.id) setSelecionado("");
    setAviso(successMessage);
    return true;
  }

  async function removeSelectedMapItem() {
    const token = cena.tokens.find((value) => value.id === selectedItemTokenId);
    const item = items.find((value) => value.id === token?.itemId);
    if (!token || !item) return setAviso("Selecione um item no mapa para removê-lo.");
    await removeMapItemToken(
      token,
      `“${item.nome}” foi removido do mapa. O item continua disponível no catálogo.`,
    );
  }
  async function enviarMapa(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const previewUrl = URL.createObjectURL(file);
    setFundo(previewUrl);
    const form = new FormData();
    form.set("campaignId", campaignId);
    form.set("sceneId", cena.id);
    form.set("assetType", "map");
    form.set("title", file.name);
    form.set("file", file);
    const response = await fetch("/api/master/media", { method: "POST", body: form });
    const result = (await response.json()) as { signedUrl?: string; backgroundKey?: string; error?: string };
    if (response.ok && result.backgroundKey) {
      const cached = await storeMapImage(result.backgroundKey, file);
      setFundo(cached);
      setCena((current) => ({ ...current, backgroundKey: result.backgroundKey, backgroundUrl: result.signedUrl }));
    } else if (result.signedUrl) setFundo(result.signedUrl);
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
            {renderedTokens.map((token) => {
              if (token.itemId) {
                return (
                  <button
                    type="button"
                    key={token.id}
                    aria-label={`Item ${token.nome}`}
                    className={`map-scene-item absolute ${selectedItemTokenId === token.id ? "map-scene-item-selected" : ""}`}
                    style={{
                      left: `${token.x * 100}%`,
                      top: `${token.y * 100}%`,
                      zIndex: token.zIndex,
                    }}
                    onPointerDown={(event) => beginTokenDrag(event, token)}
                    onPointerMove={dragToken}
                    onPointerUp={(event) => void endTokenDrag(event)}
                    onClick={(event) => {
                      event.stopPropagation();
                      if (collective) return;
                      setSelecionado(token.id);
                      setSelectedItemTokenId(token.id);
                      onSelectToken?.(token);
                    }}
                  >
                    <span className="map-scene-item-visual">
                      {token.itemImageUrl ? (
                        <Image src={token.itemImageUrl} alt="" fill sizes="64px" />
                      ) : (
                        <Package size={24} />
                      )}
                    </span>
                    <span className="map-token-name">{token.nome}</span>
                  </button>
                );
              }
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
                    if (!collective) setSelecionado(token.id);
                    if (!collective) onSelectToken?.(token);
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
                    {!portraitStyle && (token.nome ?? "TK").slice(0, 2).toUpperCase()}
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
                </button>
              );
            })}
            <MapRevealLayer
              reveal={reveal}
              interactive={!collective && revealEditing}
              mode={revealTool}
              brushSize={revealBrush}
              selectedId={selectedRevealId}
              onSelect={(id) => setSelectedRevealId(id ?? "")}
              onCommit={(path) => setReveal((value) => ({ ...value, enabled: true, synchronized: false, paths: [...value.paths, path] }))}
              onUpdate={updateRevealPath}
            />
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
                <EyeOff size={17} className="text-[#d84b57]" />
                <h3 className="mt-3 font-extrabold">Ocultação e revelação</h3>
                <p className="mt-2 text-xs leading-5 text-[#858890]">Circule com a caneta para cobrir uma área de preto. Use a borracha para revelar aos poucos. A cena é dessincronizada antes da edição.</p>
                {!revealEditing ? <button className="btn mt-3 w-full" type="button" disabled={!sessionId} onClick={() => void beginRevealEditing()}><EyeOff size={14} /> Dessincronizar e editar</button> : <>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className={`btn ${revealTool === "cover" ? "btn-primary" : ""}`} type="button" onClick={() => setRevealTool("cover")}><Brush size={14} /> Caneta preta</button>
                    <button className={`btn ${revealTool === "erase" ? "btn-primary" : ""}`} type="button" onClick={() => setRevealTool("erase")}><Eraser size={14} /> Borracha</button>
                    <button className={`btn ${revealTool === "rectangle" ? "btn-primary" : ""}`} type="button" onClick={() => setRevealTool("rectangle")}><Square size={14} /> Criar retângulo</button>
                    <button className={`btn ${revealTool === "select" ? "btn-primary" : ""}`} type="button" onClick={() => setRevealTool("select")}><MousePointer2 size={14} /> Selecionar e mover</button>
                  </div>
                  <label className="mt-3 block text-xs font-bold">Tamanho da borracha/caneta<input className="mt-2 w-full accent-[#c92131]" type="range" min="1" max="20" value={Math.round(revealBrush * 100)} onChange={(event) => setRevealBrush(Number(event.target.value) / 100)} /></label>
                  {revealTool === "select" && <div className="mt-3 grid grid-cols-2 gap-2"><button className="btn" type="button" disabled={!selectedRevealId} onClick={duplicateSelectedReveal}><Copy size={14} /> Duplicar</button><button className="btn" type="button" disabled={!selectedRevealId} onClick={deleteSelectedReveal}><Trash2 size={14} /> Excluir</button></div>}
                  <div className="mt-3 flex gap-2"><button className="btn flex-1" type="button" disabled={!reveal.paths.length} onClick={() => setReveal((value) => ({ ...value, paths: value.paths.slice(0, -1) }))}><Undo2 size={14} /> Desfazer traço</button><button className="btn flex-1" type="button" onClick={() => setReveal((value) => ({ ...value, paths: [] }))}><Trash2 size={14} /> Limpar</button></div>
                  <button className="btn mt-2 w-full" type="button" onClick={() => void saveReveal(reveal, false)}>Salvar rascunho oculto</button>
                  <button className="btn btn-primary mt-2 w-full" type="button" onClick={() => void saveReveal({ ...reveal, enabled: true }, true)}>Sincronizar revelação</button>
                </>}
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
              <section className="panel rounded-lg p-4">
                <Package size={17} className="text-[#d6b56d]" />
                <h3 className="mt-3 font-extrabold">Itens no mapa</h3>
                <p className="mt-2 text-xs leading-5 text-[#858890]">
                  Escolha um item e toque no ponto exato do mapa. Depois toque no item para
                  entregá-lo ou removê-lo da cena.
                </p>
                <label className="mt-3 block text-xs font-bold">
                  Item do catálogo
                  <select
                    className="field mt-1"
                    value={placingItemId}
                    onChange={(event) => setPlacingItemId(event.target.value)}
                  >
                    <option value="">Selecionar item</option>
                    {items.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.nome}
                      </option>
                    ))}
                  </select>
                </label>
                {placingItemId && (
                  <p className="session-notice mt-3">
                    Modo de posicionamento ativo: toque no mapa para colocar o item.
                  </p>
                )}
                {items.length === 0 && (
                  <p className="mt-3 text-xs text-[#777a82]">
                    Cadastre itens na tela “Itens da sessão”.
                  </p>
                )}
                {selectedMapItem && selectedItemToken && (
                  <div className="map-item-delivery mt-4">
                    <div className="flex items-center gap-3">
                      <span className="map-item-delivery-image">
                        {selectedMapItem.imageUrl ? (
                          <Image src={selectedMapItem.imageUrl} alt="" fill sizes="48px" />
                        ) : (
                          <Package size={20} />
                        )}
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-sm">{selectedMapItem.nome}</strong>
                        <small>Selecionado no mapa</small>
                      </span>
                    </div>
                    <label className="mt-3 block text-xs font-bold">
                      Entregar para
                      <select
                        className="field mt-1"
                        value={recipientId}
                        onChange={(event) => setRecipientId(event.target.value)}
                      >
                        <option value="">Escolher personagem</option>
                        {recipientCharacters.map((character) => (
                          <option key={character.id} value={character.id}>
                            {character.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="btn btn-primary mt-3 w-full"
                      type="button"
                      disabled={!recipientId}
                      onClick={() => void deliverMapItem()}
                    >
                      <Gift size={14} /> Entregar e remover do mapa
                    </button>
                    <button
                      className="btn mt-2 w-full border-[#682d35] text-[#f0949d]"
                      type="button"
                      onClick={() => void removeSelectedMapItem()}
                    >
                      <Trash2 size={14} /> Remover do mapa
                    </button>
                  </div>
                )}
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
