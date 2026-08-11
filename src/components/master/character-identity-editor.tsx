"use client";

import { useState } from "react";
import { Eye, Save } from "lucide-react";
import type { CharacterSummary } from "@/types/domain";
import { PortraitUploader } from "@/components/master/portrait-uploader";

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
    origin: initial.origin,
    className: initial.className,
    pathName: initial.path,
    nex: initial.nex,
    narrativeStatus: initial.status,
    teamRole: initial.role,
    defense: initial.defense,
    movement: initial.movement ?? 9,
    mainDc: initial.mainDc ?? 15,
  });
  const [version, setVersion] = useState(initial.version ?? 1);
  const [reason, setReason] = useState("Atualização editorial da ficha");
  const [mode, setMode] = useState<"master" | "player">("master");
  const [notice, setNotice] = useState("");
  const change = (key: keyof typeof data, value: string | number) =>
    setData((current) => ({ ...current, [key]: value }));
  async function save() {
    const response = await fetch("/api/master/characters/identity", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterId: initial.id,
        expectedVersion: version,
        ...data,
        reason,
      }),
    });
    const result = (await response.json()) as { version?: number; error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao salvar ficha.");
    setVersion(result.version ?? version + 1);
    setNotice("Ficha publicada em nova versão e registrada na auditoria.");
  }
  return (
    <section className="panel rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">identidade e regras</p>
          <h2 className="font-extrabold">Editor completo</h2>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn ${mode === "master" ? "btn-primary" : ""}`}
            type="button"
            onClick={() => setMode("master")}
          >
            Mestre
          </button>
          <button
            className={`btn ${mode === "player" ? "btn-primary" : ""}`}
            type="button"
            onClick={() => setMode("player")}
          >
            <Eye size={14} /> Como jogador
          </button>
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <PortraitUploader
          campaignId={campaignId}
          characterId={initial.id}
          characterName={data.name}
          initialUrl={initial.portraitUrl}
        />
        <label className="text-xs font-bold">
          Nome
          <input
            className="field mt-1"
            value={data.name}
            onChange={(event) => change("name", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          Codinome
          <input
            className="field mt-1"
            value={data.codename}
            onChange={(event) => change("codename", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          Origem
          <input
            className="field mt-1"
            value={data.origin}
            onChange={(event) => change("origin", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          Classe
          <input
            className="field mt-1"
            value={data.className}
            onChange={(event) => change("className", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          Trilha
          <input
            className="field mt-1"
            value={data.pathName}
            onChange={(event) => change("pathName", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          NEX
          <input
            className="field mt-1"
            type="number"
            min={0}
            max={100}
            value={data.nex}
            onChange={(event) => change("nex", Number(event.target.value))}
          />
        </label>
        <label className="text-xs font-bold">
          Estado narrativo
          <input
            className="field mt-1"
            value={data.narrativeStatus}
            onChange={(event) => change("narrativeStatus", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold md:col-span-2">
          Função no grupo
          <input
            className="field mt-1"
            value={data.teamRole}
            onChange={(event) => change("teamRole", event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          Defesa
          <input
            className="field mt-1"
            type="number"
            value={data.defense}
            onChange={(event) => change("defense", Number(event.target.value))}
          />
        </label>
        <label className="text-xs font-bold">
          Deslocamento
          <input
            className="field mt-1"
            type="number"
            value={data.movement}
            onChange={(event) => change("movement", Number(event.target.value))}
          />
        </label>
        <label className="text-xs font-bold">
          DT principal
          <input
            className="field mt-1"
            type="number"
            value={data.mainDc}
            onChange={(event) => change("mainDc", Number(event.target.value))}
          />
        </label>
        {mode === "master" && (
          <label className="text-xs font-bold md:col-span-2 xl:col-span-3">
            Motivo obrigatório
            <input
              className="field mt-1"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
        )}
      </div>
      {mode === "player" ? (
        <p className="mt-4 rounded border border-[#315c45] bg-[#173324]/20 p-3 text-sm text-[#7bd5a5]">
          Pré-visualização segura: notas exclusivas, fraquezas secretas e habilidades seladas ficam
          ocultas.
        </p>
      ) : (
        <button className="btn btn-primary mt-4" type="button" onClick={() => void save()}>
          <Save size={14} /> Salvar e publicar versão {version + 1}
        </button>
      )}
      {notice && (
        <p role="status" className="mt-3 text-xs text-[#7bd5a5]">
          {notice}
        </p>
      )}
    </section>
  );
}
