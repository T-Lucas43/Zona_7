import Link from "next/link";
import { BookOpen, ChevronRight, Search, ShieldCheck } from "lucide-react";
import { CheckSimulator } from "@/components/help/check-simulator";
import { HelpFeedbackButton } from "@/components/help/help-feedback-button";
import type { HelpArticle } from "@/server/repositories/rules-repository";

export function HelpCenter({ campaignId, articles, audience, query = "", category = "" }: { campaignId: string; articles: HelpArticle[]; audience: "player" | "master"; query?: string; category?: string }) {
  const categories = [...new Set(articles.map((article) => article.category))];
  return (
    <div className="help-center">
      <header className="help-hero">
        <div>
          <p className="eyebrow">{audience === "master" ? "manual operacional" : "central sem spoilers"}</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">{audience === "master" ? "Regras e ajuda do mestre" : "Ajuda da Zona 7"}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#a1a5ad]">Conteúdo versionado a partir da mesma fonte usada pelo motor de regras.</p>
        </div>
        <span className="help-version"><ShieldCheck size={15} /> Perfil ativo</span>
      </header>
      <form className="help-search" method="get">
        <Search size={17} />
        <input name="q" defaultValue={query} placeholder="Buscar regra, procedimento ou palavra-chave..." />
        <select name="category" defaultValue={category} aria-label="Filtrar categoria">
          <option value="">Todas as categorias</option>
          {categories.map((item) => <option value={item} key={item}>{item.replaceAll("_", " ")}</option>)}
        </select>
        <button className="btn btn-primary" type="submit">Buscar</button>
      </form>
      <div className="help-layout">
        <nav className="help-index panel" aria-label="Índice da ajuda">
          <p className="eyebrow">índice</p>
          {articles.map((article) => <a href={`#${article.slug}`} key={article.id}><BookOpen size={14} /><span>{article.title}</span><ChevronRight size={13} /></a>)}
        </nav>
        <main className="space-y-4">
          {audience === "player" && (!category || category === "testes") && <CheckSimulator />}
          {articles.map((article) => (
            <article className="help-article panel" id={article.slug} key={article.id}>
              <div className="help-article-meta"><span>{article.category.replaceAll("_", " ")}</span><span>v{article.version} · {new Date(article.updatedAt).toLocaleDateString("pt-BR")}</span></div>
              <h2>{article.title}</h2>
              <p className="help-summary">{article.summary}</p>
              <p className="help-content">{article.content}</p>
              {article.rule && <details className="help-rule-details"><summary>Referência mecânica efetiva</summary><pre>{JSON.stringify(article.rule.payload, null, 2)}</pre></details>}
              {article.links.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{article.links.map((link) => <Link className="btn" href={link.href} key={link.href}>{link.label}<ChevronRight size={13} /></Link>)}</div>}
              {audience === "player" && <HelpFeedbackButton campaignId={campaignId} articleId={article.id} />}
            </article>
          ))}
          {articles.length === 0 && <section className="panel rounded-xl p-6 text-sm text-[#92969e]">Nenhum artigo corresponde à busca.</section>}
        </main>
      </div>
    </div>
  );
}

