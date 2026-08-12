export default function MasterSectionLoading() {
  return (
    <div aria-live="polite" aria-busy="true">
      <p className="eyebrow">carregando módulo</p>
      <div className="mt-2 h-10 w-72 max-w-full animate-pulse rounded bg-[#1c1f25]" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="panel h-40 animate-pulse rounded-lg p-5" key={index}>
            <div className="h-4 w-1/2 rounded bg-[#292c32]" />
            <div className="mt-4 h-3 w-full rounded bg-[#202329]" />
            <div className="mt-2 h-3 w-4/5 rounded bg-[#202329]" />
          </div>
        ))}
      </div>
      <span className="sr-only">Carregando a página solicitada.</span>
    </div>
  );
}
