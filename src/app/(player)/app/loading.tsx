export default function PlayerLoading() {
  return (
    <div className="animate-pulse" aria-label="Carregando terminal do jogador" role="status">
      <div className="h-3 w-36 rounded bg-white/10" />
      <div className="mt-4 h-9 w-72 max-w-full rounded bg-white/10" />
      <div className="mt-7 aspect-video rounded-xl border border-white/10 bg-white/[0.035]" />
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        <div className="h-32 rounded-xl border border-white/10 bg-white/[0.035]" />
        <div className="h-32 rounded-xl border border-white/10 bg-white/[0.035]" />
        <div className="h-32 rounded-xl border border-white/10 bg-white/[0.035]" />
      </div>
      <span className="sr-only">Carregando informações ao vivo.</span>
    </div>
  );
}
