import Image from "next/image";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`wordmark ${compact ? "wordmark-compact" : ""}`} aria-label="Zona 7: A Convergência">
      <Image
        className="brand-logo"
        src="/zona-7-convergencia-logo.png"
        width={1140}
        height={760}
        sizes={compact ? "56px" : "(max-width: 860px) 220px, 260px"}
        alt="Zona 7: A Convergência"
      />
    </span>
  );
}
