import { Download, FileText } from "lucide-react";

export function CharacterPdfActions({ characterId, compact = false }: { characterId: string; compact?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <a className={`btn ${compact ? "px-3" : ""}`} href={`/api/characters/${characterId}/pdf`} target="_blank" rel="noreferrer">
        <FileText size={15} /> Visualizar em papel
      </a>
      <a className={`btn btn-primary ${compact ? "px-3" : ""}`} href={`/api/characters/${characterId}/pdf?download=1`}>
        <Download size={15} /> Exportar PDF
      </a>
    </div>
  );
}
