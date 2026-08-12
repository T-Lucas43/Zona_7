import type { AbilitySummary } from "@/types/domain";

export function AbilityDetails({ ability }: { ability: AbilitySummary }) {
  const rows = [
    ["Critério de uso", ability.useCriteria],
    ["Como aplicar", ability.application],
    ["Teste", ability.testFormula ? `${ability.testFormula}${ability.difficulty !== undefined ? ` · DT ${ability.difficulty}` : ""}` : undefined],
    ["Efeito no sucesso", ability.successEffect],
    ["Efeito parcial", ability.partialEffect],
    ["Efeito na falha", ability.failureEffect],
  ].filter((row): row is [string, string] => Boolean(row[1]));
  if (!rows.length) return null;
  return <dl className="mt-3 space-y-2 rounded border border-[#30333a] bg-black/20 p-3">
    {rows.map(([label, value]) => <div key={label}><dt className="text-[0.62rem] font-bold uppercase tracking-wide text-[#d27882]">{label}</dt><dd className="mt-1 text-xs leading-5 text-[#a4a6ac]">{value}</dd></div>)}
  </dl>;
}
