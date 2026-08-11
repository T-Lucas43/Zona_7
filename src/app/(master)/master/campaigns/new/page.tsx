import { campaign } from "@/lib/demo-data";

export default function NewCampaignPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <p className="eyebrow">configuração inicial</p>
      <h1 className="mt-1 text-3xl font-black">Nova campanha</h1>
      <form className="panel mt-6 space-y-5 rounded-xl p-6">
        <label className="block text-xs font-bold text-[#aaa]">
          Nome
          <input className="field mt-1" defaultValue="Zona 7: Nova operação" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-xs font-bold text-[#aaa]">
            Perfil de regras
            <select className="field mt-1">
              <option value="zona7_convergencia">Zona 7: Convergência</option>
              <option value="zona7_classic">Zona 7: Clássico</option>
            </select>
          </label>
          <label className="block text-xs font-bold text-[#aaa]">
            Fuso horário
            <select className="field mt-1" defaultValue={campaign.timezone}>
              <option>America/Belem</option>
              <option>America/Sao_Paulo</option>
            </select>
          </label>
        </div>
        <label className="block text-xs font-bold text-[#aaa]">
          Premissa pública
          <textarea className="field mt-1 min-h-32" />
        </label>
        <button className="btn btn-primary" type="submit">
          Criar campanha
        </button>
      </form>
    </div>
  );
}
