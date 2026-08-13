"use client";

import { useMemo, useState } from "react";
import { Dices, RotateCcw } from "lucide-react";
import { buildCheckPlan, resolveCheck, type TrainingRank } from "@/lib/rules/engine";

const ranks: Array<[TrainingRank, string]> = [
  ["untrained", "Destreinado +0"],
  ["trained", "Treinado +5"],
  ["veteran", "Veterano +10"],
  ["expert", "Expert +15"],
];

export function CheckSimulator() {
  const [attribute, setAttribute] = useState(2);
  const [training, setTraining] = useState<TrainingRank>("trained");
  const [difficulty, setDifficulty] = useState(15);
  const [favorable, setFavorable] = useState(0);
  const [unfavorable, setUnfavorable] = useState(0);
  const [rolls, setRolls] = useState<number[]>([]);
  const plan = useMemo(
    () => buildCheckPlan({ attribute, training, favorableDice: favorable, unfavorableDice: unfavorable }),
    [attribute, favorable, training, unfavorable],
  );
  const result = rolls.length
    ? resolveCheck({ rolls, modifier: plan.modifier, difficulty, keep: plan.keep })
    : null;

  function simulate() {
    setRolls(Array.from({ length: plan.diceCount }, () => Math.floor(Math.random() * 20) + 1));
  }

  return (
    <section className="help-simulator panel rounded-xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="eyebrow">simulador local // não registra</p>
          <h2 className="mt-1 text-lg font-black">Monte um teste</h2>
        </div>
        <Dices className="text-[#ee5361]" />
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold">Atributo
          <select className="field mt-1" value={attribute} onChange={(event) => setAttribute(Number(event.target.value))}>
            {[0, 1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold">Treinamento
          <select className="field mt-1" value={training} onChange={(event) => setTraining(event.target.value as TrainingRank)}>
            {ranks.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-xs font-bold">Dados favoráveis
          <input className="field mt-1" type="number" min="0" max="5" value={favorable} onChange={(event) => setFavorable(Number(event.target.value))} />
        </label>
        <label className="text-xs font-bold">Dados desfavoráveis
          <input className="field mt-1" type="number" min="0" max="5" value={unfavorable} onChange={(event) => setUnfavorable(Number(event.target.value))} />
        </label>
        <label className="text-xs font-bold">DT
          <input className="field mt-1" type="number" min="0" max="99" value={difficulty} onChange={(event) => setDifficulty(Number(event.target.value))} />
        </label>
        <div className="rounded-lg border border-[#343841] bg-black/20 p-3">
          <span className="text-[0.65rem] uppercase text-[#858891]">Fórmula efetiva</span>
          <strong className="mt-1 block font-mono text-lg text-[#f08b95]">{plan.formula}</strong>
        </div>
      </div>
      <button className="btn btn-primary mt-4 w-full" type="button" onClick={simulate}>
        {rolls.length ? <RotateCcw size={15} /> : <Dices size={15} />} Simular
      </button>
      {result && (
        <div className="mt-4 rounded-xl border border-[#343841] bg-black/25 p-4" aria-live="polite">
          <p className="font-mono text-xs text-[#9b9ea5]">Dados: {rolls.join(", ")} · escolhido {result.chosen} · bônus {plan.modifier >= 0 ? "+" : ""}{plan.modifier}</p>
          <div className="mt-2 flex items-end justify-between gap-3">
            <strong className={result.success ? "text-[#6fd49a]" : "text-[#ef7b86]"}>{result.success ? "Sucesso" : "Falha"}</strong>
            <span className="text-3xl font-black">{result.total}</span>
          </div>
        </div>
      )}
    </section>
  );
}

