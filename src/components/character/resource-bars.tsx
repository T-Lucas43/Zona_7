import type { CharacterSummary, ResourceKind } from "@/types/domain";

const labels: Record<ResourceKind, string> = { pv: "PV", pe: "PE", san: "SAN" };

export function ResourceBars({
  resources,
  compact = false,
}: {
  resources: CharacterSummary["resources"];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      {(Object.keys(labels) as ResourceKind[]).map((kind) => {
        const value = resources[kind];
        const percent =
          value.maximum > 0 ? Math.max(0, Math.min(100, (value.current / value.maximum) * 100)) : 0;
        const critical = percent <= 25;
        return (
          <div key={kind}>
            <div className="mb-1 flex items-center justify-between font-mono text-[0.68rem]">
              <span className={kind === "pe" ? "text-[#76baf5]" : "text-[#babcc2]"}>
                {labels[kind]}
              </span>
              <span
                aria-label={`${labels[kind]} ${value.current} de ${value.maximum}`}
                className={critical ? "font-bold text-[#f06a76]" : "text-[#a0a3aa]"}
              >
                {value.current}
                <span className="text-[#5f626a]">/{value.maximum}</span>
              </span>
            </div>
            <div
              className="resource-track"
              role="progressbar"
              aria-label={labels[kind]}
              aria-valuemin={0}
              aria-valuemax={value.maximum}
              aria-valuenow={value.current}
            >
              <div className={`resource-fill resource-${kind}`} style={{ width: `${percent}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
