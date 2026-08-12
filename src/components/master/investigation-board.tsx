"use client";

import { useRef, useState } from "react";
import { Camera, Link2, Link2Off, Pin, StickyNote } from "lucide-react";
import type { ConexaoDoMural, PistaDaCampanha } from "@/server/repositories/master-repository";

type BoardItem = PistaDaCampanha & { board: NonNullable<PistaDaCampanha["board"]> };

function hash(value: string) {
  return [...value].reduce((result, character) => ((result * 31) + character.charCodeAt(0)) >>> 0, 7);
}

function defaultBoard(item: PistaDaCampanha, index: number): BoardItem["board"] {
  const value = hash(item.id);
  const normalizedType = item.tipo.toLowerCase();
  const style = normalizedType.includes("foto") || normalizedType.includes("imagem")
    ? "polaroid"
    : normalizedType.includes("nota") || normalizedType.includes("post")
      ? "postit"
      : (["paper", "polaroid", "postit"] as const)[value % 3]!;
  return {
    x: 0.035 + (index % 4) * 0.225,
    y: 0.055 + (Math.floor(index / 4) % 3) * 0.29,
    rotation: ((value % 101) / 10) - 5,
    zIndex: index + 1,
    style,
  };
}

export function InvestigationBoard({
  campaignId,
  initialItems,
  initialConnections,
  readOnly = false,
}: {
  campaignId?: string;
  initialItems: PistaDaCampanha[];
  initialConnections: ConexaoDoMural[];
  readOnly?: boolean;
}) {
  const [items, setItems] = useState<BoardItem[]>(() => initialItems.map((item, index) => ({ ...item, board: item.board ?? defaultBoard(item, index) })));
  const [connections, setConnections] = useState(initialConnections);
  const [connectionMode, setConnectionMode] = useState(false);
  const [connectionSource, setConnectionSource] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState<{ id: string; dx: number; dy: number } | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  function beginDrag(event: React.PointerEvent<HTMLButtonElement>, item: BoardItem) {
    event.stopPropagation();
    if (readOnly) return;
    if (connectionMode) {
      void chooseConnection(item.id);
      return;
    }
    if (!boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const nextZ = Math.max(0, ...items.map((value) => value.board.zIndex)) + 1;
    const pointerX = (event.clientX - rect.left) / rect.width;
    const pointerY = (event.clientY - rect.top) / rect.height;
    setItems((current) => current.map((value) => value.id === item.id ? { ...value, board: { ...value.board, zIndex: nextZ } } : value));
    setDragging({ id: item.id, dx: pointerX - item.board.x, dy: pointerY - item.board.y });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function drag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging || !boardRef.current) return;
    const rect = boardRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(0.88, (event.clientX - rect.left) / rect.width - dragging.dx));
    const y = Math.max(0, Math.min(0.78, (event.clientY - rect.top) / rect.height - dragging.dy));
    setItems((current) => current.map((item) => item.id === dragging.id ? { ...item, board: { ...item.board, x, y } } : item));
  }

  async function endDrag(event: React.PointerEvent<HTMLButtonElement>) {
    if (!dragging) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const item = items.find((value) => value.id === dragging.id);
    setDragging(null);
    if (!item) return;
    if (!campaignId) return;
    const response = await fetch("/api/master/investigation-board", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "move", campaignId, handoutId: item.id, ...item.board }),
    });
    const result = await response.json() as { error?: string };
    setNotice(response.ok ? `Posição de “${item.titulo}” salva.` : result.error ?? "Falha ao salvar posição.");
  }

  async function chooseConnection(targetId: string) {
    if (!campaignId || readOnly) return;
    if (!connectionSource) {
      setConnectionSource(targetId);
      setNotice("Agora escolha a segunda pista.");
      return;
    }
    if (connectionSource === targetId) {
      setConnectionSource(null);
      return;
    }
    const response = await fetch("/api/master/investigation-board", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_connection", campaignId, fromHandoutId: connectionSource, toHandoutId: targetId }),
    });
    const result = await response.json() as { connected?: boolean; id?: string; fromHandoutId?: string; toHandoutId?: string; error?: string };
    if (response.ok) {
      if (result.connected && result.id && result.fromHandoutId && result.toHandoutId) {
        setConnections((current) => [...current, { id: result.id!, fromHandoutId: result.fromHandoutId!, toHandoutId: result.toHandoutId! }]);
      } else {
        const pair = [connectionSource, targetId].sort();
        setConnections((current) => current.filter((value) => [value.fromHandoutId, value.toHandoutId].sort().join(":") !== pair.join(":")));
      }
      setNotice(result.connected ? "Pistas conectadas com fio vermelho." : "Conexão removida.");
    } else setNotice(result.error ?? "Falha ao conectar pistas.");
    setConnectionSource(null);
  }

  function toggleConnectionMode() {
    setConnectionMode((value) => !value);
    setConnectionSource(null);
    setNotice(connectionMode ? "Modo de conexão encerrado." : "Clique em duas pistas para conectar ou desconectar.");
  }

  return <section className="mt-6">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div><p className="eyebrow">arquivo visual interativo</p><h2 className="text-xl font-black">Mural de Investigação</h2></div>
      {!readOnly && <button className={`btn ${connectionMode ? "btn-primary" : ""}`} type="button" onClick={toggleConnectionMode}>{connectionMode ? <Link2Off size={15} /> : <Link2 size={15} />}{connectionMode ? "Encerrar conexões" : "Conectar pistas"}</button>}
    </div>
    <div className="investigation-board" ref={boardRef}>
      <svg className="investigation-threads" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {connections.map((connection) => {
          const from = items.find((item) => item.id === connection.fromHandoutId);
          const to = items.find((item) => item.id === connection.toHandoutId);
          if (!from || !to) return null;
          return <line key={connection.id} x1={from.board.x * 100 + 7.5} y1={from.board.y * 100 + 11} x2={to.board.x * 100 + 7.5} y2={to.board.y * 100 + 11} />;
        })}
      </svg>
      {items.map((item) => <button
        type="button"
        key={item.id}
        className={`investigation-clue investigation-clue-${item.board.style} ${connectionSource === item.id ? "investigation-clue-source" : ""} ${readOnly ? "cursor-default" : ""}`}
        style={{ left: `${item.board.x * 100}%`, top: `${item.board.y * 100}%`, zIndex: item.board.zIndex, transform: `rotate(${item.board.rotation}deg)` }}
        onPointerDown={(event) => beginDrag(event, item)}
        onPointerMove={drag}
        onPointerUp={(event) => void endDrag(event)}
      >
        <span className="investigation-pin"><Pin size={15} /></span>
        {item.board.style === "polaroid" && <span className="investigation-photo"><Camera size={28} /><small>{item.tipo}</small></span>}
        {item.board.style === "postit" && <StickyNote size={18} className="mb-2 opacity-50" />}
        <strong>{item.titulo}</strong>
        <span>{item.resumo || item.conteudo || "Pista sem descrição."}</span>
      </button>)}
      {items.length === 0 && <div className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-[#efe2c3]">{readOnly ? "Você ainda não recebeu nenhuma pista para o mural." : "Cadastre pistas para montar o mural."}</div>}
    </div>
    <p className="mt-3 text-xs text-[#858890]">{readOnly ? "Este mural mostra somente as pistas entregues a você ou a todo o grupo. Conexões secretas permanecem ocultas." : "Arraste livremente. A pista selecionada vem para frente. No modo de conexão, escolha duas pistas para criar ou remover o fio."}</p>
    {notice && <p className="mt-2 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
  </section>;
}
