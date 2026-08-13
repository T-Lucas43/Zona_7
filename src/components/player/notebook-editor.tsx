"use client";

import { useMemo, useState } from "react";
import { BookOpenText, ChevronLeft, ChevronRight, Link2, Plus, Save, Trash2 } from "lucide-react";
import type { PlayerNotebookPage } from "@/server/repositories/character-repository";

type NotebookClue = { id: string; title: string; excerpt: string };
type LocalPage = PlayerNotebookPage & { temporary?: boolean };

export function NotebookEditor({
  campaignId,
  characterId,
  ownerUserId,
  characterName,
  initialPages,
  clues,
  master = false,
  onPagesChange,
}: {
  campaignId: string;
  characterId: string;
  ownerUserId?: string;
  characterName: string;
  initialPages: PlayerNotebookPage[];
  clues: NotebookClue[];
  master?: boolean;
  onPagesChange?: (pages: PlayerNotebookPage[]) => void;
}) {
  const initial = initialPages.length > 0 ? initialPages : [blankPage(1)];
  const [pages, setPages] = useState<LocalPage[]>(initial);
  const [index, setIndex] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [notice, setNotice] = useState("");
  const [turnDirection, setTurnDirection] = useState<"forward" | "backward">("forward");
  const current = pages[index];
  const linkedClues = useMemo(
    () => clues.filter((clue) => current?.linkedHandoutIds.includes(clue.id)),
    [clues, current?.linkedHandoutIds],
  );

  function updateCurrent(fields: Partial<LocalPage>) {
    setPages((items) =>
      items.map((page, pageIndex) => (pageIndex === index ? { ...page, ...fields } : page)),
    );
    setDirty(true);
    setConfirmDelete(false);
  }

  async function save(page = current) {
    if (!page || pending) return false;
    setPending(true);
    const response = await fetch("/api/notebook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        campaignId,
        characterId,
        ownerUserId,
        pageId: page.temporary ? undefined : page.id,
        title: page.title,
        content: page.content,
        linkedHandoutIds: page.linkedHandoutIds,
      }),
    });
    const result = (await response.json()) as { item?: PlayerNotebookPage; error?: string };
    setPending(false);
    if (!response.ok || !result.item) {
      setNotice(result.error ?? "Não foi possível salvar esta página.");
      return false;
    }
    setPages((items) => {
      const updated = items.map((item) => (item.id === page.id ? result.item! : item));
      onPagesChange?.(updated);
      return updated;
    });
    setDirty(false);
    setNotice("Página salva no caderno.");
    return true;
  }

  async function move(direction: -1 | 1) {
    if (dirty && !(await save())) return;
    setTurnDirection(direction > 0 ? "forward" : "backward");
    setIndex((value) => Math.max(0, Math.min(pages.length - 1, value + direction)));
    setConfirmDelete(false);
  }

  async function addPage() {
    if (dirty && !(await save())) return;
    const nextNumber = Math.max(0, ...pages.map((page) => page.pageNumber)) + 1;
    setPages((items) => [...items, blankPage(nextNumber)]);
    setTurnDirection("forward");
    setIndex(pages.length);
    setDirty(false);
    setNotice("Nova página aberta. Escreva e salve seu registro.");
  }

  async function removePage() {
    if (!current) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setNotice("Confirme para excluir esta página definitivamente.");
      return;
    }
    if (!current.temporary) {
      setPending(true);
      const response = await fetch("/api/notebook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          campaignId,
          characterId,
          ownerUserId,
          pageId: current.id,
        }),
      });
      const result = (await response.json()) as { error?: string };
      setPending(false);
      if (!response.ok) return setNotice(result.error ?? "Não foi possível excluir a página.");
    }
    const remaining = pages.filter((_, pageIndex) => pageIndex !== index);
    const nextPages = remaining.length > 0 ? remaining : [blankPage(1)];
    setPages(nextPages);
    onPagesChange?.(nextPages.filter((page) => !page.temporary));
    setIndex(Math.max(0, index - 1));
    setTurnDirection("backward");
    setDirty(false);
    setConfirmDelete(false);
    setNotice("Página excluída.");
  }

  if (!current) return null;
  return (
    <section className="notebook-shell mt-6">
      <div className="notebook-toolbar">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[#9b2430] text-white">
            <BookOpenText size={19} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">{master ? "registro supervisionado" : "arquivo pessoal"}</p>
            <h2 className="truncate text-lg font-black">Caderno de {characterName}</h2>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn px-3"
            type="button"
            disabled={index === 0 || pending}
            onClick={() => void move(-1)}
            aria-label="Página anterior"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="tag">
            Página {index + 1} de {pages.length}
          </span>
          <button
            className="btn px-3"
            type="button"
            disabled={index === pages.length - 1 || pending}
            onClick={() => void move(1)}
            aria-label="Próxima página"
          >
            <ChevronRight size={16} />
          </button>
          <button className="btn" type="button" disabled={pending} onClick={() => void addPage()}>
            <Plus size={15} /> Nova página
          </button>
        </div>
      </div>
      <div className="notebook-spread">
        <div
          className={`notebook-page notebook-page-turn-${turnDirection}`}
          key={`${current.id}:${index}`}
        >
          <div className="notebook-page-number">{String(current.pageNumber).padStart(2, "0")}</div>
          <input
            className="notebook-title"
            value={current.title}
            maxLength={180}
            onChange={(event) => updateCurrent({ title: event.target.value })}
            placeholder="Título do registro"
            aria-label="Título da página"
          />
          <textarea
            className="notebook-writing"
            value={current.content}
            maxLength={100_000}
            onChange={(event) => updateCurrent({ content: event.target.value })}
            placeholder="Escreva suas suspeitas, acontecimentos, nomes, horários e teorias..."
            aria-label="Conteúdo da página"
          />
          <div className="notebook-page-footer">
            {dirty
              ? "alterações não salvas"
              : `salvo em ${new Date(current.updatedAt).toLocaleString("pt-BR")}`}
          </div>
        </div>
        <aside className="notebook-clues">
          <div className="flex items-center gap-2">
            <Link2 size={16} />
            <strong>Pistas relacionadas</strong>
          </div>
          <p className="mt-2 text-xs text-[#6d6256]">
            Marque as pistas que fundamentam esta anotação.
          </p>
          <div className="mt-4 max-h-72 space-y-2 overflow-y-auto">
            {clues.map((clue) => (
              <label className="notebook-clue-option" key={clue.id}>
                <input
                  type="checkbox"
                  checked={current.linkedHandoutIds.includes(clue.id)}
                  onChange={() =>
                    updateCurrent({
                      linkedHandoutIds: current.linkedHandoutIds.includes(clue.id)
                        ? current.linkedHandoutIds.filter((id) => id !== clue.id)
                        : [...current.linkedHandoutIds, clue.id],
                    })
                  }
                />
                <span>
                  <strong>{clue.title}</strong>
                  <small>{clue.excerpt}</small>
                </span>
              </label>
            ))}
            {clues.length === 0 && (
              <p className="text-xs text-[#766b60]">Nenhuma pista disponível para este caderno.</p>
            )}
          </div>
          {linkedClues.length > 0 && (
            <p className="mt-4 text-xs font-bold text-[#8f1d28]">
              {linkedClues.length} pista(s) vinculada(s)
            </p>
          )}
        </aside>
      </div>
      <div className="notebook-actions">
        <button
          className="btn btn-primary"
          type="button"
          disabled={pending || !dirty}
          onClick={() => void save()}
        >
          <Save size={15} /> {pending ? "Salvando..." : "Salvar página"}
        </button>
        <button
          className={`btn ${confirmDelete ? "border-[#9d2d39] bg-[#7d1a25]/20 text-[#ff929d]" : ""}`}
          type="button"
          disabled={pending}
          onClick={() => void removePage()}
        >
          <Trash2 size={15} /> {confirmDelete ? "Confirmar exclusão" : "Excluir página"}
        </button>
        {notice && (
          <p className="text-xs text-[#897d72]" role="status">
            {notice}
          </p>
        )}
      </div>
    </section>
  );
}

function blankPage(pageNumber: number): LocalPage {
  return {
    id: `temp-${crypto.randomUUID()}`,
    pageNumber,
    title: "",
    content: "",
    linkedHandoutIds: [],
    updatedAt: new Date().toISOString(),
    temporary: true,
  };
}
