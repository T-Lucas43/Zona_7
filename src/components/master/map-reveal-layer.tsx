"use client";

import { useId, useRef, useState } from "react";
import type { CenaDaCampanha } from "@/server/repositories/master-repository";

type Reveal = CenaDaCampanha["reveal"];
type RevealPath = Reveal["paths"][number];
export type RevealEditorMode = "cover" | "erase" | "rectangle" | "select";

const viewWidth = 1000;
const viewHeight = 562.5;

function pathData(path: RevealPath) {
  const points = path.points.map((point) => `${point.x * viewWidth},${point.y * viewHeight}`);
  if (!points.length) return "";
  return `M ${points.join(" L ")}${path.tool === "cover" ? " Z" : ""}`;
}

function rectangle(path: RevealPath) {
  const [first, second = first] = path.points;
  const x = Math.min(first?.x ?? 0, second?.x ?? 0);
  const y = Math.min(first?.y ?? 0, second?.y ?? 0);
  return {
    x: x * viewWidth,
    y: y * viewHeight,
    width: Math.abs((second?.x ?? 0) - (first?.x ?? 0)) * viewWidth,
    height: Math.abs((second?.y ?? 0) - (first?.y ?? 0)) * viewHeight,
  };
}

function moveRectangle(path: RevealPath, dx: number, dy: number): RevealPath {
  const xs = path.points.map((point) => point.x);
  const ys = path.points.map((point) => point.y);
  const safeDx = Math.max(-Math.min(...xs), Math.min(1 - Math.max(...xs), dx));
  const safeDy = Math.max(-Math.min(...ys), Math.min(1 - Math.max(...ys), dy));
  return {
    ...path,
    points: path.points.map((point) => ({ x: point.x + safeDx, y: point.y + safeDy })),
  };
}

function MaskShape({ path, draft = false }: { path: RevealPath; draft?: boolean }) {
  const color = path.tool === "cover" ? "white" : "black";
  if (path.shape === "rectangle") {
    return <rect {...rectangle(path)} fill={color} opacity={draft ? 0.82 : 1} />;
  }
  return (
    <path
      d={pathData(path)}
      fill={path.tool === "cover" ? color : "none"}
      stroke={path.tool === "erase" ? color : color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={path.tool === "erase" ? path.size * viewWidth : 3}
      opacity={draft ? 0.82 : 1}
    />
  );
}

export function MapRevealLayer({
  reveal,
  interactive,
  mode,
  brushSize,
  selectedId,
  onSelect,
  onCommit,
  onUpdate,
}: {
  reveal: Reveal;
  interactive: boolean;
  mode: RevealEditorMode;
  brushSize: number;
  selectedId?: string;
  onSelect?: (id: string | null) => void;
  onCommit?: (path: RevealPath) => void;
  onUpdate?: (path: RevealPath) => void;
}) {
  const rawId = useId();
  const maskId = `reveal-${rawId.replaceAll(":", "")}`;
  const [draft, setDraft] = useState<Array<{ x: number; y: number }>>([]);
  const draftRef = useRef<Array<{ x: number; y: number }>>([]);
  const [movingPreview, setMovingPreview] = useState<RevealPath | null>(null);
  const drawing = useRef(false);
  const moveState = useRef<{
    path: RevealPath;
    start: { x: number; y: number };
    preview: RevealPath;
  } | null>(null);
  const point = (event: React.PointerEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  };
  const begin = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!interactive) return;
    event.preventDefault();
    event.stopPropagation();
    const currentPoint = point(event);
    if (mode === "select") {
      const id = (event.target as SVGElement).closest<SVGElement>("[data-reveal-shape-id]")?.dataset.revealShapeId;
      const selected = reveal.paths.find((path) => path.id === id && path.shape === "rectangle");
      onSelect?.(selected?.id ?? null);
      if (!selected) return;
      moveState.current = { path: selected, start: currentPoint, preview: selected };
      setMovingPreview(selected);
    } else {
      drawing.current = true;
      draftRef.current = [currentPoint];
      setDraft([currentPoint]);
    }
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: React.PointerEvent<SVGSVGElement>) => {
    if (moveState.current) {
      event.preventDefault();
      const current = point(event);
      const preview = moveRectangle(
        moveState.current.path,
        current.x - moveState.current.start.x,
        current.y - moveState.current.start.y,
      );
      moveState.current.preview = preview;
      setMovingPreview(preview);
      return;
    }
    if (!drawing.current) return;
    event.preventDefault();
    const next = point(event);
    setDraft((items) => {
      if (mode === "rectangle") {
        const nextItems = [items[0] ?? next, next];
        draftRef.current = nextItems;
        return nextItems;
      }
      const previous = items.at(-1);
      if (previous && Math.hypot(previous.x - next.x, previous.y - next.y) < .004) return items;
      const nextItems = [...items, next];
      draftRef.current = nextItems;
      return nextItems;
    });
  };
  const end = (event: React.PointerEvent<SVGSVGElement>) => {
    if (moveState.current) {
      event.preventDefault();
      event.stopPropagation();
      onUpdate?.(moveState.current.preview);
      moveState.current = null;
      setMovingPreview(null);
    } else if (drawing.current) {
      event.preventDefault();
      event.stopPropagation();
      drawing.current = false;
      const points = draftRef.current;
      const rectangleReady = mode === "rectangle" && points.length === 2 &&
        Math.abs(points[1].x - points[0].x) > .005 && Math.abs(points[1].y - points[0].y) > .005;
      const freehandReady = mode !== "rectangle" && points.length >= (mode === "cover" ? 3 : 2);
      if (rectangleReady || freehandReady) {
        const path: RevealPath = {
          id: crypto.randomUUID(),
          tool: mode === "erase" ? "erase" : "cover",
          shape: mode === "rectangle" ? "rectangle" : "freehand",
          size: brushSize,
          points,
        };
        onCommit?.(path);
        if (path.shape === "rectangle") onSelect?.(path.id);
      }
      draftRef.current = [];
      setDraft([]);
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };
  const draftPath: RevealPath | null = draft.length
    ? {
        id: "draft",
        tool: mode === "erase" ? "erase" : "cover",
        shape: mode === "rectangle" ? "rectangle" : "freehand",
        size: brushSize,
        points: draft,
      }
    : null;
  if (!reveal.enabled && !interactive) return null;
  return (
    <svg
      className="map-reveal-layer"
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      preserveAspectRatio="none"
      style={{ pointerEvents: interactive ? "auto" : "none" }}
      onClick={(event) => {
        if (interactive) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDown={begin}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label={interactive ? "Editor da máscara de ocultação" : undefined}
    >
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width={viewWidth} height={viewHeight}>
          <rect width={viewWidth} height={viewHeight} fill="black" />
          {reveal.paths.map((path) => (
            <MaskShape key={path.id} path={movingPreview?.id === path.id ? movingPreview : path} />
          ))}
          {draftPath && <MaskShape path={draftPath} draft />}
        </mask>
      </defs>
      <rect width={viewWidth} height={viewHeight} fill="#020304" mask={`url(#${maskId})`} />
      {interactive && mode === "select" && reveal.paths.filter((path) => path.shape === "rectangle").map((path) => {
        const displayed = movingPreview?.id === path.id ? movingPreview : path;
        return (
          <rect
            key={`selection-${path.id}`}
            {...rectangle(displayed)}
            data-reveal-shape-id={path.id}
            fill="transparent"
            stroke={selectedId === path.id ? "#f0c36b" : "rgba(232,238,245,.45)"}
            strokeWidth={selectedId === path.id ? 4 : 2}
            strokeDasharray={selectedId === path.id ? "10 6" : "6 8"}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {interactive && <rect width={viewWidth} height={viewHeight} fill="transparent" stroke="rgba(224,70,84,.45)" strokeWidth="2" pointerEvents="none" />}
    </svg>
  );
}
