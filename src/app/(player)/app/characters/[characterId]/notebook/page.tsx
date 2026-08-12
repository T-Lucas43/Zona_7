import { NotebookEditor } from "@/components/player/notebook-editor";
import {
  getAuthorizedCharacter,
  getAuthorizedHandouts,
  getPlayerNotebookPages,
} from "@/server/repositories/character-repository";

export default async function PlayerNotebookPage({ params }: { params: Promise<{ characterId: string }> }) {
  const { characterId } = await params;
  const character = await getAuthorizedCharacter(characterId);
  if (!character) return <section className="panel rounded-xl p-6"><h1 className="text-2xl font-black">Caderno indisponível</h1><p className="mt-2 text-sm text-[#91949b]">Esta conta não está vinculada ao personagem solicitado.</p></section>;
  const [pages, handouts] = await Promise.all([
    getPlayerNotebookPages(character.id),
    getAuthorizedHandouts(),
  ]);
  return <div>
    <p className="eyebrow">{character.name}{" // arquivo particular de investigação"}</p>
    <h1 className="mt-1 text-3xl font-black">Livro de anotações</h1>
    <p className="mt-2 max-w-3xl text-sm text-[#92959c]">Registre teorias e acontecimentos em páginas independentes. Você pode relacionar cada página às pistas já recebidas sem revelar conteúdo bloqueado.</p>
    <NotebookEditor
      campaignId={character.campaignId ?? "11111111-1111-4111-8111-111111111111"}
      characterId={character.id}
      characterName={character.name}
      initialPages={pages}
      clues={handouts.map((item) => ({ id: item.id, title: item.title, excerpt: item.excerpt }))}
    />
  </div>;
}
