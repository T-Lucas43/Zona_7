import type { CharacterSheetVisibility, CharacterSummary } from "@/types/domain";

export const characterFieldOptions = [
  ["portrait", "Foto"],
  ["codename", "Codinome"],
  ["pronouns", "Pronomes"],
  ["origin", "Origem"],
  ["class", "Classe"],
  ["path", "Trilha"],
  ["nex", "NEX"],
  ["status", "Estado narrativo"],
  ["role", "Função no grupo"],
  ["affinities", "Afinidades e elementos"],
  ["description", "Descrição curta"],
  ["tagline", "Frase de efeito"],
  ["public_history", "História pública"],
  ["defense", "Defesa"],
  ["block", "Bloqueio"],
  ["dodge", "Esquiva"],
  ["movement", "Deslocamento"],
  ["main_dc", "DT principal"],
  ["pe_per_turn", "PE por turno"],
  ["attributes", "Atributos"],
  ["resistances", "Resistências"],
  ["meter", "Medidor especial"],
  ["conditions", "Condições"],
] as const;

export const characterSectionOptions = [
  ["resources", "PV, PE e SAN"],
  ["skills", "Perícias"],
  ["combat", "Combate e ações"],
  ["abilities", "Habilidades liberadas"],
  ["weaknesses", "Fraquezas conhecidas"],
  ["inventory", "Inventário"],
  ["messages", "Mensagens"],
  ["handouts", "Pistas e documentos"],
  ["history", "Histórico"],
] as const;

export const defaultCharacterSheetVisibility: CharacterSheetVisibility = {
  fields: characterFieldOptions.map(([value]) => value),
  sections: characterSectionOptions
    .map(([value]) => value)
    .filter((value) => value !== "weaknesses" && value !== "history"),
};

export function getCharacterSheetVisibility(character: CharacterSummary) {
  return character.sheetVisibility ?? defaultCharacterSheetVisibility;
}

export function isCharacterFieldVisible(character: CharacterSummary, field: string) {
  return getCharacterSheetVisibility(character).fields.includes(field);
}

export function isCharacterSectionVisible(character: CharacterSummary, section: string) {
  return getCharacterSheetVisibility(character).sections.includes(section);
}
