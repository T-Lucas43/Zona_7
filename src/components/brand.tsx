export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="wordmark" aria-label="Zona 7 - Terminal">
      <span className="wordmark-mark" aria-hidden="true">
        <span>Z7</span>
      </span>
      {!compact && (
        <span>
          Zona 7{" "}
          <span className="font-mono text-[0.65em] font-medium tracking-[0.12em] text-[#8f929a]">
            / Terminal
          </span>
        </span>
      )}
    </span>
  );
}
