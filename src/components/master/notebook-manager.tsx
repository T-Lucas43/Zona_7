"use client";

import { useState } from "react";
import { BookOpenText, UserRound } from "lucide-react";
import { NotebookEditor } from "@/components/player/notebook-editor";
import type { PlayerNotebookPage } from "@/server/repositories/character-repository";
import type { ContaDaCampanha, PaginaCadernoDaCampanha, PistaDaCampanha } from "@/server/repositories/master-repository";

export function NotebookManager({
  campaignId,
  accounts,
  initialPages,
  handouts,
}: {
  campaignId: string;
  accounts: ContaDaCampanha[];
  initialPages: PaginaCadernoDaCampanha[];
  handouts: PistaDaCampanha[];
}) {
  const owners = accounts.filter((account) => account.personagemId && account.usuarioId && account.situacao !== "Revogado");
  const [selectedKey, setSelectedKey] = useState(() => owners[0] ? `${owners[0].usuarioId}:${owners[0].personagemId}` : "");
  const [pages, setPages] = useState(initialPages);
  const selected = owners.find((account) => `${account.usuarioId}:${account.personagemId}` === selectedKey);
  const selectedPages = selected ? pages
    .filter((page) => page.ownerUserId === selected.usuarioId && page.characterId === selected.personagemId)
    .sort((left, right) => left.pageNumber - right.pageNumber) : [];

  function updateSelectedPages(updated: PlayerNotebookPage[]) {
    if (!selected?.personagemId) return;
    setPages((current) => [
      ...current.filter((page) => page.ownerUserId !== selected.usuarioId || page.characterId !== selected.personagemId),
      ...updated.map((page) => ({ ...page, ownerUserId: selected.usuarioId, characterId: selected.personagemId! })),
    ]);
  }

  if (owners.length === 0) return <section className="panel mt-6 rounded-lg border-dashed p-6"><BookOpenText className="text-[#d84b57]" /><h2 className="mt-4 text-xl font-black">Nenhum caderno disponível</h2><p className="mt-2 text-sm text-[#92959c]">Vincule uma conta de jogador a um personagem para criar seu livro de anotações.</p></section>;
  return <div className="mt-6">
    <section className="panel rounded-lg p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3"><UserRound className="text-[#d84b57]" size={19} /><div><p className="eyebrow">supervisão dos registros</p><h2 className="font-extrabold">Selecionar caderno</h2></div></div>
        <select className="field w-full sm:w-auto sm:min-w-80" value={selectedKey} onChange={(event) => setSelectedKey(event.target.value)}>
          {owners.map((account) => <option key={`${account.usuarioId}:${account.personagemId}`} value={`${account.usuarioId}:${account.personagemId}`}>{account.personagem ?? "Personagem"} — {account.nome}</option>)}
        </select>
      </div>
    </section>
    {selected?.personagemId && <NotebookEditor
      key={selectedKey}
      master
      campaignId={campaignId}
      characterId={selected.personagemId}
      ownerUserId={selected.usuarioId}
      characterName={selected.personagem ?? selected.nome}
      initialPages={selectedPages}
      clues={handouts.map((handout) => ({ id: handout.id, title: handout.titulo, excerpt: handout.resumo || handout.conteudo }))}
      onPagesChange={updateSelectedPages}
    />}
  </div>;
}
