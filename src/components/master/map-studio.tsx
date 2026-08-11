"use client";

import { useRef, useState } from "react";
import { ImageUp, Map, Move, ZoomIn, ZoomOut } from "lucide-react";
import { getCharacterPortraitStyle } from "@/components/character/character-portrait";
import type { CenaDaCampanha } from "@/server/repositories/master-repository";

function tokenPortraitStyle(token: CenaDaCampanha["tokens"][number]): React.CSSProperties | null {
  return getCharacterPortraitStyle(token.nome, token.portraitUrl);
}

function tokenBodyProfile(token: CenaDaCampanha["tokens"][number]) {
  const key = token.nome.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0];
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
  selectedCharacterId,
  onSelectCharacter,
}: {
  campaignId: string;
  initialScene: CenaDaCampanha;
  collective?: boolean;
  hiddenCharacterIds?: string[];
  selectedCharacterId?: string;
  onSelectCharacter?: (characterId: string) => void;
}) {
  const [cena, setCena] = useState(initialScene);
  const [selecionado, setSelecionado] = useState(initialScene.tokens[0]?.id ?? "");
  const [motivo, setMotivo] = useState("Movimento manual do mestre");
  const [aviso, setAviso] = useState("");
  const [fundo, setFundo] = useState<string | null>(initialScene.backgroundUrl ?? null);
  const [zoom, setZoom] = useState(100);
  const mapa = useRef<HTMLDivElement>(null);
  async function mover(event: React.MouseEvent<HTMLDivElement>) {
    if (collective || !selecionado || !mapa.current) return;
    const rect = mapa.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height));
    const response = await fetch("/api/master/map/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, tokenId: selecionado, x, y, reason: motivo }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao mover token.");
    setCena((atual) => ({
      ...atual,
      tokens: atual.tokens.map((token) => (token.id === selecionado ? { ...token, x, y } : token)),
    }));
    setAviso("Posição salva e distribuída aos dispositivos conectados.");
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
        collective ? "min-h-[calc(100vh-8rem)]" : "mt-6 grid gap-4 xl:grid-cols-[1fr_280px]"
      }
    >
      <section className="panel overflow-hidden rounded-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#30333a] p-4">
          <div>
            <p className="eyebrow">{collective ? "tela coletiva" : "editor de cena"}</p>
            <h2 className="font-extrabold">{cena.nome}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag"><Map size={12} /> {cena.modoGrade}</span>
            <div className="flex items-center rounded-full border border-[#34373e] bg-black/20 p-0.5" aria-label="Zoom do mapa">
              <button className="grid size-8 place-items-center rounded-full hover:bg-white/5" type="button" aria-label="Diminuir zoom" onClick={() => setZoom((value) => Math.max(100, value - 25))}><ZoomOut size={14} /></button>
              <span className="min-w-12 text-center font-mono text-[0.65rem]" aria-live="polite">{zoom}%</span>
              <button className="grid size-8 place-items-center rounded-full hover:bg-white/5" type="button" aria-label="Aumentar zoom" onClick={() => setZoom((value) => Math.min(250, value + 25))}><ZoomIn size={14} /></button>
            </div>
          </div>
        </div>
        <div className="map-viewport aspect-video overflow-auto bg-[#090c10]">
          <div
            ref={mapa}
            onClick={(event) => void mover(event)}
            className="relative min-h-full bg-[#090c10]"
            style={{
              width: `${zoom}%`,
              aspectRatio: "16 / 9",
              backgroundImage: fundo
                ? `linear-gradient(#07090b66,#07090b66),url(${fundo})`
                : "linear-gradient(#182028 1px,transparent 1px),linear-gradient(90deg,#182028 1px,transparent 1px)",
              backgroundSize: fundo ? "cover" : "6.25% 11.11%",
              "--map-scale": zoom / 100,
            } as React.CSSProperties}
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
          {cena.tokens
            .filter((token) => token.visivel && (!token.characterId || !hiddenCharacterIds.includes(token.characterId)))
            .map((token) => {
              const portraitStyle = tokenPortraitStyle(token);
              return (
              <button
                type="button"
                key={token.id}
                aria-label={`Token de ${token.nome}`}
                className={`map-token map-token-${tokenBodyProfile(token)} absolute z-10 ${selecionado === token.id || selectedCharacterId === token.characterId ? "map-token-selected" : ""}`}
                style={{
                  left: `${token.x * 100}%`,
                  top: `${token.y * 100}%`,
                  "--token-color": token.cor,
                } as React.CSSProperties}
                onClick={(event) => {
                  event.stopPropagation();
                  if (!collective) setSelecionado(token.id);
                  if (!collective && token.characterId) onSelectCharacter?.(token.characterId);
                }}
              >
                <span className="map-token-shadow" aria-hidden="true" />
                <span className="map-token-body" aria-hidden="true"><span /></span>
                <span className="map-token-head" style={{ backgroundColor: token.cor, ...portraitStyle }} data-portrait={portraitStyle ? "true" : "false"}>
                  {!portraitStyle && token.nome.slice(0, 2).toUpperCase()}
                </span>
                <span className="map-token-name">{token.nome}</span>
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
        <aside className="space-y-4">
          <section className="panel rounded-lg p-4">
            <Move size={17} className="text-[#d84b57]" />
            <h3 className="mt-3 font-extrabold">Movimentação</h3>
            <label className="mt-3 block text-xs font-bold">
              Token
              <select
                className="field mt-1"
                value={selecionado}
                onChange={(event) => setSelecionado(event.target.value)}
              >
                {cena.tokens.map((token) => (
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
              Selecione o token e clique no mapa. O servidor registra posição anterior, nova posição
              e responsável.
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
