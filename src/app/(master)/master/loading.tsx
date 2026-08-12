export default function MasterLoading() {
  return (
    <div className="animate-pulse" aria-label="Carregando painel do mestre" role="status">
      <div className="h-3 w-44 rounded bg-white/10" />
      <div className="mt-4 h-10 w-80 max-w-full rounded bg-white/10" />
      <div className="mt-7 grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="aspect-video rounded-xl border border-white/10 bg-white/[0.035]" />
        <div className="space-y-4">
          <div className="h-44 rounded-xl border border-white/10 bg-white/[0.035]" />
          <div className="h-36 rounded-xl border border-white/10 bg-white/[0.035]" />
        </div>
      </div>
      <span className="sr-only">Carregando dados atualizados.</span>
    </div>
  );
}
