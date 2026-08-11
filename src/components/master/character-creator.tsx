"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, UserRoundPlus } from "lucide-react";
import type { ContaDaCampanha } from "@/server/repositories/master-repository";

export function CharacterCreator({ campaignId, accounts }: { campaignId: string; accounts: ContaDaCampanha[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [created, setCreated] = useState<string[]>([]);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const number = (name: string) => Number(form.get(name));
    const response = await fetch("/api/master/characters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        name: form.get("name"),
        codename: form.get("codename"),
        origin: form.get("origin"),
        className: form.get("className"),
        pathName: form.get("pathName"),
        nex: number("nex"),
        defense: number("defense"),
        resources: { pv: number("pv"), pe: number("pe"), san: number("san") },
        attributes: { agi: number("agi"), for: number("for"), int: number("int"), pre: number("pre"), vig: number("vig") },
        ownerUserId: form.get("ownerUserId") || null,
      }),
    });
    const result = (await response.json()) as { name?: string; error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao criar personagem.");
    setNotice(`${result.name ?? String(form.get("name"))} foi criado como personagem jogável.`);
    setCreated((current) => [result.name ?? String(form.get("name")), ...current]);
    event.currentTarget.reset();
    router.refresh();
  }
  return (
    <section className="panel mt-6 rounded-lg p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <UserRoundPlus className="text-[#d84b57]" size={20} />
          <div><p className="eyebrow">elenco expansível</p><h2 className="font-extrabold">Novo personagem jogável</h2></div>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => setOpen((value) => !value)}>
          <Plus size={15} /> {open ? "Fechar formulário" : "Criar personagem"}
        </button>
      </div>
      {open && (
        <form className="mt-5 border-t border-[#30333a] pt-5" onSubmit={submit}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="text-xs font-bold">Nome<input required name="name" className="field mt-1" /></label>
            <label className="text-xs font-bold">Codinome<input name="codename" className="field mt-1" /></label>
            <label className="text-xs font-bold">Origem<input name="origin" className="field mt-1" defaultValue="Sobrevivente" /></label>
            <label className="text-xs font-bold">Classe<input name="className" className="field mt-1" defaultValue="Especialista" /></label>
            <label className="text-xs font-bold">Trilha<input name="pathName" className="field mt-1" defaultValue="Investigador" /></label>
            <label className="text-xs font-bold">NEX<input name="nex" className="field mt-1" type="number" min="0" max="100" defaultValue="5" /></label>
            <label className="text-xs font-bold">Defesa<input name="defense" className="field mt-1" type="number" min="0" defaultValue="10" /></label>
            <label className="text-xs font-bold">Conta do jogador<select name="ownerUserId" className="field mt-1"><option value="">Vincular depois</option>{accounts.filter((account) => account.papel === "Jogador").map((account) => <option value={account.usuarioId} key={account.usuarioId}>{account.nome}{account.personagem ? ` — já possui ${account.personagem}` : ""}</option>)}</select></label>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            {[['pv','PV',20],['pe','PE',10],['san','SAN',20],['agi','AGI',1],['for','FOR',1],['int','INT',1],['pre','PRE',1],['vig','VIG',1]].map(([name,label,value]) => <label className="text-xs font-bold" key={String(name)}>{label}<input className="field mt-1" name={String(name)} type="number" min="0" defaultValue={String(value)} /></label>)}
          </div>
          <button className="btn btn-primary mt-4"><UserRoundPlus size={15} /> Criar ficha completa</button>
        </form>
      )}
      {notice && <p className="mt-4 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
      {created.length > 0 && <p className="mt-2 text-xs text-[#858891]">Criados nesta tela: {created.join(", ")}</p>}
    </section>
  );
}
