"use client";

import { useState } from "react";
import { HeartCrack, ShieldCheck, Skull } from "lucide-react";
import type { CharacterSummary, ResourceKind } from "@/types/domain";

export function CharacterLiveControls({ campaignId, character, onChange }: { campaignId: string; character: CharacterSummary; onChange: (character: CharacterSummary) => void }) {
  const [reason, setReason] = useState("Ajuste durante a sessão");
  const [notice, setNotice] = useState("");
  async function attribute(key: keyof CharacterSummary["attributes"], value: number) {
    const response = await fetch("/api/master/characters/attribute", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, characterId: character.id, attribute: key, value, reason }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao atualizar atributo.");
    onChange({ ...character, attributes: { ...character.attributes, [key]: value } }); setNotice(`${key.toUpperCase()} atualizado em tempo real.`);
  }
  async function maximum(resource: ResourceKind, value: number) {
    const response = await fetch("/api/master/resources/maximum", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, characterId: character.id, resource, maximum: value, adjustCurrent: false, reason }) });
    const result = await response.json() as { error?: string; current?: number; maximum?: number };
    if (!response.ok) return setNotice(result.error ?? "Falha ao atualizar máximo.");
    onChange({ ...character, resources: { ...character.resources, [resource]: { ...character.resources[resource], current: result.current ?? Math.min(character.resources[resource].current, value), maximum: result.maximum ?? value } } }); setNotice(`${resource.toUpperCase()} máximo atualizado em tempo real.`);
  }
  async function life(state: "active" | "dying" | "dead") {
    const response = await fetch("/api/master/characters/life-state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, characterId: character.id, state, reason }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar estado.");
    onChange({ ...character, characterState: state, status: state === "dead" ? "morto" : state === "dying" ? "quase morto" : "ativo" }); setNotice(state === "dead" ? "Personagem declarado morto e token marcado." : state === "active" ? "Personagem estabilizado e ações restauradas." : "Personagem sem ações, aguardando decisão.");
  }
  return <div className="mt-4 rounded border border-[#30333a] bg-black/15 p-3">
    <input className="field" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Motivo dos ajustes ao vivo" />
    <p className="eyebrow mt-3">atributos ao vivo</p><div className="mt-2 grid grid-cols-5 gap-1">{Object.entries(character.attributes).map(([key, value]) => <label className="text-center text-[0.58rem] uppercase text-[#777a82]" key={key}>{key}<input className="field mt-1 px-1 text-center" type="number" min={0} max={20} value={value} onChange={(event) => void attribute(key as keyof CharacterSummary["attributes"], Number(event.target.value))} /></label>)}</div>
    <p className="eyebrow mt-3">máximos</p><div className="mt-2 grid grid-cols-3 gap-2">{(["pv","pe","san"] as ResourceKind[]).map((key) => <label className="text-[0.58rem] uppercase text-[#777a82]" key={key}>{key}<input className="field mt-1 text-center" type="number" min={1} max={9999} value={character.resources[key].maximum} onChange={(event) => void maximum(key, Number(event.target.value))} /></label>)}</div>
    <p className="eyebrow mt-3">estado de vida</p><div className="mt-2 grid grid-cols-3 gap-1"><button className="btn px-2" type="button" onClick={() => void life("active")}><ShieldCheck size={13} /> Estabilizar</button><button className="btn px-2 text-[#e8c16d]" type="button" onClick={() => void life("dying")}><HeartCrack size={13} /> Quase morto</button><button className="btn px-2 text-[#ff6977]" type="button" onClick={() => void life("dead")}><Skull size={13} /> Declarar morto</button></div>
    {notice && <p className="mt-2 text-xs text-[#7bd5a5]">{notice}</p>}
  </div>;
}
