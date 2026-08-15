"use client";

import { useState } from "react";
import { Eye, Save } from "lucide-react";
import type { CharacterSummary } from "@/types/domain";
import { PortraitUploader } from "@/components/master/portrait-uploader";

const attributeLabels = {
  agi: "Agilidade",
  for: "Força",
  int: "Intelecto",
  pre: "Presença",
  vig: "Vigor",
} as const;

const resistanceLabels = {
  fortitude: "Fortitude",
  reflexes: "Reflexos",
  willpower: "Vontade",
} as const;

export function CharacterIdentityEditor({
  campaignId,
  initial,
}: {
  campaignId: string;
  initial: CharacterSummary;
}) {
  const [data, setData] = useState({
    name: initial.name,
    codename: initial.codename ?? "",
    pronouns: initial.pronouns ?? "",
    origin: initial.origin,
    className: initial.className,
    pathName: initial.path,
    nex: initial.nex,
    narrativeStatus: initial.status,
    teamRole: initial.role,
    affinities: (initial.affinities ?? []).join(", "),
    shortDescription: initial.shortDescription ?? "",
    tagline: initial.tagline ?? "",
    publicHistory: initial.publicHistory ?? "",
    characterState: initial.characterState ?? "active",
    identificationColor: initial.identificationColor ?? "#b52532",
    defense: initial.defense,
    blockValue: initial.blockValue ?? 0,
    dodgeValue: initial.dodgeValue ?? 0,
    movement: initial.movement ?? 9,
    mainDc: initial.mainDc ?? 15,
    pePerTurn: initial.pePerTurn ?? 2,
    attributes: initial.attributes,
    resistances: initial.resistances ?? { fortitude: 0, reflexes: 0, willpower: 0 },
  });
  const [version, setVersion] = useState(initial.version ?? 1);
  const [reason, setReason] = useState("Atualização editorial da ficha");
  const [mode, setMode] = useState<"master" | "player">("master");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const change = (key: keyof Omit<typeof data, "attributes" | "resistances">, value: string | number) =>
    setData((current) => ({ ...current, [key]: value }));

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const response = await fetch("/api/master/characters/identity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          characterId: initial.id,
          expectedVersion: version,
          ...data,
          affinities: data.affinities.split(",").map((value) => value.trim()).filter(Boolean),
          reason,
        }),
      });
      const result = (await response.json()) as { version?: number; error?: string };
      if (!response.ok) return setNotice(result.error ?? "Falha ao salvar ficha.");
      setVersion(result.version ?? version + 1);
      setNotice("Ficha completa publicada e registrada na auditoria.");
    } catch {
      setNotice("Não foi possível conectar ao servidor para salvar a ficha.");
    } finally {
      setSaving(false);
    }
  }

  const textField = (
    label: string,
    key: keyof Omit<typeof data, "attributes" | "resistances">,
    className = "",
  ) => (
    <label className={`text-xs font-bold ${className}`}>
      {label}
      <input
        className="field mt-1"
        value={String(data[key])}
        onChange={(event) => change(key, event.target.value)}
      />
    </label>
  );

  const numberField = (
    label: string,
    key: keyof Omit<typeof data, "attributes" | "resistances">,
    max = 999,
  ) => (
    <label className="text-xs font-bold">
      {label}
      <input
        className="field mt-1"
        type="number"
        min={0}
        max={max}
        value={Number(data[key])}
        onChange={(event) => change(key, Number(event.target.value))}
      />
    </label>
  );

  return (
    <section className="panel rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">identidade, parâmetros e história</p>
          <h2 className="font-extrabold">Editor completo da ficha</h2>
        </div>
        <div className="flex gap-2">
          <button className={`btn ${mode === "master" ? "btn-primary" : ""}`} type="button" onClick={() => setMode("master")}>Mestre</button>
          <button className={`btn ${mode === "player" ? "btn-primary" : ""}`} type="button" onClick={() => setMode("player")}><Eye size={14} /> Como jogador</button>
        </div>
      </div>

      <div className="mt-4">
        <PortraitUploader
          campaignId={campaignId}
          characterId={initial.id}
          characterName={data.name}
          initialUrl={initial.portraitUrl}
          initialMapUrl={initial.mapPortraitUrl}
        />
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {textField("Nome", "name")}
        {textField("Codinome", "codename")}
        {textField("Pronomes", "pronouns")}
        {textField("Origem", "origin")}
        {textField("Classe", "className")}
        {textField("Trilha", "pathName")}
        {numberField("NEX", "nex", 100)}
        {textField("Estado narrativo", "narrativeStatus")}
        {textField("Função no grupo", "teamRole")}
        {textField("Afinidades / elementos (separe por vírgula)", "affinities", "md:col-span-2")}
        {textField("Frase de efeito", "tagline")}
        {textField("Descrição curta", "shortDescription", "md:col-span-2 xl:col-span-3")}
        <label className="text-xs font-bold md:col-span-2 xl:col-span-3">
          História pública
          <textarea className="field mt-1 min-h-24 resize-y" value={data.publicHistory} onChange={(event) => change("publicHistory", event.target.value)} />
        </label>
        {textField("Estado técnico", "characterState")}
        <label className="text-xs font-bold">
          Cor de identificação
          <span className="mt-1 flex gap-2">
            <input className="h-11 w-14 rounded border border-[#30333a] bg-transparent p-1" type="color" value={data.identificationColor} onChange={(event) => change("identificationColor", event.target.value)} />
            <input className="field" value={data.identificationColor} onChange={(event) => change("identificationColor", event.target.value)} />
          </span>
        </label>
      </div>

      <div className="mt-5 rounded-lg border border-[#30333a] bg-black/15 p-4">
        <p className="eyebrow">parâmetros operacionais</p>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {numberField("Defesa", "defense")}
          {numberField("Bloqueio", "blockValue")}
          {numberField("Esquiva", "dodgeValue")}
          {numberField("Deslocamento (m)", "movement")}
          {numberField("DT principal", "mainDc")}
          {numberField("PE por turno", "pePerTurn")}
        </div>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <section className="rounded-lg border border-[#30333a] bg-black/15 p-4">
          <p className="eyebrow">atributos</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
            {Object.entries(attributeLabels).map(([key, label]) => (
              <label className="text-xs font-bold" key={key}>
                {label}
                <input className="field mt-1" type="number" min={0} max={99} value={data.attributes[key as keyof typeof data.attributes]} onChange={(event) => setData((current) => ({ ...current, attributes: { ...current.attributes, [key]: Number(event.target.value) } }))} />
              </label>
            ))}
          </div>
        </section>
        <section className="rounded-lg border border-[#30333a] bg-black/15 p-4">
          <p className="eyebrow">resistências</p>
          <div className="mt-3 grid grid-cols-3 gap-3">
            {Object.entries(resistanceLabels).map(([key, label]) => (
              <label className="text-xs font-bold" key={key}>
                {label}
                <input className="field mt-1" type="number" min={0} max={999} value={data.resistances[key as keyof typeof data.resistances]} onChange={(event) => setData((current) => ({ ...current, resistances: { ...current.resistances, [key]: Number(event.target.value) } }))} />
              </label>
            ))}
          </div>
        </section>
      </div>

      {mode === "player" ? (
        <p className="mt-4 rounded border border-[#315c45] bg-[#173324]/20 p-3 text-sm text-[#7bd5a5]">
          A visão do jogador segue exatamente os campos e seções liberados no painel de visibilidade abaixo.
        </p>
      ) : (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-64 flex-1 text-xs font-bold">Motivo obrigatório<input className="field mt-1" value={reason} onChange={(event) => setReason(event.target.value)} /></label>
          <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void save()}><Save size={14} /> {saving ? "Salvando..." : `Salvar e publicar versão ${version + 1}`}</button>
        </div>
      )}
      {notice && <p role="status" className={`mt-3 text-xs ${notice.startsWith("Ficha") ? "text-[#7bd5a5]" : "text-[#ff8992]"}`}>{notice}</p>}
    </section>
  );
}
