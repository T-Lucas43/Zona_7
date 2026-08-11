"use client";

import { useState } from "react";
import { Eye, EyeOff, Save, ShieldCheck } from "lucide-react";
import {
  characterFieldOptions,
  characterSectionOptions,
  getCharacterSheetVisibility,
} from "@/lib/character-visibility";
import type { CharacterSummary } from "@/types/domain";

export function CharacterVisibilityManager({
  campaignId,
  character,
}: {
  campaignId: string;
  character: CharacterSummary;
}) {
  const initial = getCharacterSheetVisibility(character);
  const [fields, setFields] = useState(initial.fields);
  const [sections, setSections] = useState(initial.sections);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  function toggle(value: string, values: string[], setValues: (next: string[]) => void) {
    setValues(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  }

  async function save() {
    setSaving(true);
    setNotice("");
    const response = await fetch("/api/master/characters/visibility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        characterId: character.id,
        visibleFields: fields,
        visibleSections: sections,
      }),
    });
    const result = (await response.json()) as { error?: string };
    setSaving(false);
    setNotice(
      response.ok
        ? "Ficha do jogador atualizada. A nova visibilidade já está sincronizada."
        : (result.error ?? "Não foi possível salvar a visibilidade."),
    );
  }

  return (
    <section className="panel rounded-lg p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">liberação por personagem</p>
          <h2 className="mt-1 flex items-center gap-2 font-extrabold">
            <ShieldCheck size={17} className="text-[#d84b57]" /> O que aparece para o jogador
          </h2>
        </div>
        <span className="tag"><Eye size={12} /> {fields.length + sections.length} itens visíveis</span>
      </div>
      <p className="mt-2 text-sm leading-6 text-[#92959c]">
        Tudo que estiver desligado é removido da tela e bloqueado pela API para a conta vinculada.
      </p>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <fieldset>
          <legend className="text-xs font-black uppercase tracking-wide text-[#c5c7cc]">Dados do cabeçalho</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {characterFieldOptions.map(([value, label]) => {
              const checked = fields.includes(value);
              return (
                <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 text-sm transition ${checked ? "border-[#6b343a] bg-[#8a1b27]/12" : "border-[#30333a] text-[#83868d]"}`} key={value}>
                  <input className="accent-[#cf3544]" type="checkbox" checked={checked} onChange={() => toggle(value, fields, setFields)} />
                  {checked ? <Eye size={14} /> : <EyeOff size={14} />} {label}
                </label>
              );
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="text-xs font-black uppercase tracking-wide text-[#c5c7cc]">Seções da ficha</legend>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {characterSectionOptions.map(([value, label]) => {
              const checked = sections.includes(value);
              return (
                <label className={`flex min-h-11 cursor-pointer items-center gap-2 rounded border px-3 text-sm transition ${checked ? "border-[#6b343a] bg-[#8a1b27]/12" : "border-[#30333a] text-[#83868d]"}`} key={value}>
                  <input className="accent-[#cf3544]" type="checkbox" checked={checked} onChange={() => toggle(value, sections, setSections)} />
                  {checked ? <Eye size={14} /> : <EyeOff size={14} />} {label}
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" type="button" disabled={saving} onClick={() => void save()}>
          <Save size={14} /> {saving ? "Salvando..." : "Salvar visibilidade"}
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => { setFields(characterFieldOptions.map(([value]) => value)); setSections(characterSectionOptions.map(([value]) => value)); }}>
          Mostrar tudo
        </button>
        <button className="btn btn-ghost" type="button" onClick={() => { setFields([]); setSections([]); }}>
          Ocultar tudo
        </button>
        {notice && <span className="text-xs text-[#7bd5a5]" role="status">{notice}</span>}
      </div>
    </section>
  );
}
