import type { CSSProperties } from "react";

const defaultPortraitPosition: Record<string, string> = {
  davi: "0% 0%",
  magnus: "50% 0%",
  arya: "100% 0%",
  lize: "0% 75%",
  amber: "50% 75%",
  gragas: "100% 75%",
};

export function getCharacterPortraitStyle(name: string, portraitUrl?: string): CSSProperties | null {
  if (portraitUrl) {
    return {
      backgroundImage: `url(${portraitUrl})`,
      backgroundPosition: "center top",
      backgroundRepeat: "no-repeat",
      backgroundSize: "cover",
    };
  }
  const key = name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/\s+/)[0] ?? "";
  const position = defaultPortraitPosition[key];
  if (!position) return null;
  return {
    backgroundImage: "url(/personagens-zona7.png)",
    backgroundPosition: position,
    backgroundRepeat: "no-repeat",
    backgroundSize: "300% auto",
  };
}

export function CharacterPortrait({
  name,
  portraitUrl,
  className = "size-11 rounded-md",
}: {
  name: string;
  portraitUrl?: string;
  className?: string;
}) {
  const style = getCharacterPortraitStyle(name, portraitUrl);
  const initials = name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden border border-[#4a2b30] bg-[#791b26]/20 bg-cover font-mono text-xs font-black text-[#ee7b86] ${className}`}
      style={style ?? undefined}
      role="img"
      aria-label={`Retrato de ${name}`}
      data-portrait={style ? "true" : "false"}
    >
      {!style && initials}
    </span>
  );
}
