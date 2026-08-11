"use client";
import { useState } from "react";
import { Save } from "lucide-react";
export function CharacterNotesEditor({
  campaignId,
  characterId,
}: {
  campaignId: string;
  characterId: string;
}) {
  const [title, setTitle] = useState("Notas da próxima sessão");
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState("gm_only");
  const [notice, setNotice] = useState("");
  async function save() {
    const response = await fetch("/api/master/characters/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, characterId, title, body, visibility }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao salvar nota.");
    setBody("");
    setNotice("Nota salva com autoria, horário e visibilidade.");
  }
  return (
    <section className="panel mt-4 rounded-lg p-5">
      <p className="eyebrow">notas versionadas</p>
      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_220px]">
        <label className="text-xs font-bold">
          Título
          <input
            className="field mt-1"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>
        <label className="text-xs font-bold">
          Visibilidade
          <select
            className="field mt-1"
            value={visibility}
            onChange={(event) => setVisibility(event.target.value)}
          >
            <option value="gm_only">Somente mestres</option>
            <option value="owner_only">Dono da ficha e mestres</option>
            <option value="campaign">Toda a campanha</option>
          </select>
        </label>
      </div>
      <textarea
        className="field mt-3 min-h-28"
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Escreva uma anotação. Conteúdo exclusivo do mestre nunca é enviado ao jogador."
      />
      <button
        className="btn btn-primary mt-3"
        type="button"
        disabled={body.trim().length < 2}
        onClick={() => void save()}
      >
        <Save size={14} /> Salvar nota
      </button>
      {notice && (
        <p role="status" className="mt-3 text-xs text-[#7bd5a5]">
          {notice}
        </p>
      )}
    </section>
  );
}
