import { Dices } from "lucide-react";

export function RollingDie({
  rolling = false,
  value,
  compact = false,
}: {
  rolling?: boolean;
  value?: number;
  compact?: boolean;
}) {
  return (
    <span
      className={`rolling-die ${rolling ? "is-rolling" : "has-result"} ${compact ? "is-compact" : ""}`}
      role="img"
      aria-label={rolling ? "Dado rolando" : `Resultado do dado: ${value ?? 0}`}
    >
      <span className="rolling-die-shape">
        {rolling ? <Dices size={compact ? 18 : 25} /> : <b>{value}</b>}
      </span>
      {!compact && <small>{rolling ? "rolando..." : "resultado"}</small>}
    </span>
  );
}
