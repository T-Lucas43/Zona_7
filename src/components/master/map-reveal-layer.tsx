"use client";

import { useId, useRef, useState } from "react";
import type { CenaDaCampanha } from "@/server/repositories/master-repository";

type Reveal = CenaDaCampanha["reveal"];
type RevealPath = Reveal["paths"][number];

function pathData(path: RevealPath) {
  const points = path.points.map((point) => `${point.x * 1000},${point.y * 562.5}`);
  if (!points.length) return "";
  return `M ${points.join(" L ")}${path.tool === "cover" ? " Z" : ""}`;
}

export function MapRevealLayer({ reveal, interactive, tool, brushSize, onCommit }: { reveal: Reveal; interactive: boolean; tool: RevealPath["tool"]; brushSize: number; onCommit?: (path: RevealPath) => void }) {
  const rawId = useId(); const maskId = `reveal-${rawId.replaceAll(":", "")}`;
  const [draft, setDraft] = useState<Array<{ x: number; y: number }>>([]);
  const drawing = useRef(false);
  const point = (event: React.PointerEvent<SVGSVGElement>) => { const rect = event.currentTarget.getBoundingClientRect(); return { x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)), y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)) }; };
  const begin = (event: React.PointerEvent<SVGSVGElement>) => { if (!interactive) return; event.preventDefault(); event.stopPropagation(); drawing.current = true; setDraft([point(event)]); event.currentTarget.setPointerCapture(event.pointerId); };
  const move = (event: React.PointerEvent<SVGSVGElement>) => { if (!drawing.current) return; event.preventDefault(); const next = point(event); setDraft((items) => { const previous = items.at(-1); return previous && Math.hypot(previous.x - next.x, previous.y - next.y) < .004 ? items : [...items, next]; }); };
  const end = (event: React.PointerEvent<SVGSVGElement>) => { if (!drawing.current) return; event.preventDefault(); event.stopPropagation(); drawing.current = false; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); const minimum = tool === "cover" ? 3 : 2; if (draft.length >= minimum) onCommit?.({ id: crypto.randomUUID(), tool, size: brushSize, points: draft }); setDraft([]); };
  const cover = reveal.paths.filter((item) => item.tool === "cover");
  const erase = reveal.paths.filter((item) => item.tool === "erase");
  const draftPath: RevealPath | null = draft.length ? { id: "draft", tool, size: brushSize, points: draft } : null;
  if (!reveal.enabled && !interactive) return null;
  return <svg className="map-reveal-layer" viewBox="0 0 1000 562.5" preserveAspectRatio="none" style={{ pointerEvents: interactive ? "auto" : "none" }} onClick={(event) => { if (interactive) { event.preventDefault(); event.stopPropagation(); } }} onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={end} aria-label={interactive ? "Editor da máscara de ocultação" : undefined}>
    <defs><mask id={maskId}><rect width="1000" height="562.5" fill="white" />{erase.map((item) => <path key={item.id} d={pathData(item)} fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth={item.size * 1000} />)}{draftPath?.tool === "erase" && <path d={pathData(draftPath)} fill="none" stroke="black" strokeLinecap="round" strokeLinejoin="round" strokeWidth={draftPath.size * 1000} />}</mask></defs>
    <g mask={`url(#${maskId})`}>{cover.map((item) => <path key={item.id} d={pathData(item)} fill="#030405" stroke="#030405" strokeWidth="3" />)}{draftPath?.tool === "cover" && <path d={pathData(draftPath)} fill="rgba(3,4,5,.88)" stroke="#e04654" strokeDasharray="8 6" strokeWidth="3" />}</g>
    {interactive && <rect width="1000" height="562.5" fill="transparent" stroke="rgba(224,70,84,.45)" strokeWidth="2" />}
  </svg>;
}
