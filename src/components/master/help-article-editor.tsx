"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { useRouter } from "next/navigation";
import type { HelpArticle } from "@/server/repositories/rules-repository";

export function HelpArticleEditor({ campaignId, articles }: { campaignId: string; articles: HelpArticle[] }) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState(articles[0]?.id ?? "");
  const selected = articles.find((article) => article.id === selectedId);
  const [draft, setDraft] = useState(() => ({
    title: selected?.title ?? "",
    summary: selected?.summary ?? "",
    content: selected?.content ?? "",
    keywords: selected?.keywords.join(", ") ?? "",
    reason: "",
  }));
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  function choose(id: string) {
    const article = articles.find((item) => item.id === id);
    setSelectedId(id);
    setDraft({ title: article?.title ?? "", summary: article?.summary ?? "", content: article?.content ?? "", keywords: article?.keywords.join(", ") ?? "", reason: "" });
    setNotice("");
  }
  async function publish() {
    setPending(true);
    const response = await fetch("/api/master/help", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId, articleId: selectedId, title: draft.title, summary: draft.summary, content: draft.content, keywords: draft.keywords.split(",").map((item) => item.trim()).filter(Boolean), reason: draft.reason }),
    });
    const result = await response.json();
    setPending(false);
    if (!response.ok) return setNotice(result.error ?? "Falha ao publicar artigo.");
    setNotice(`Versão ${result.version} publicada.`);
    router.refresh();
  }
  if (!selected) return null;
  return (
    <details className="panel mt-6 rounded-xl p-5">
      <summary className="cursor-pointer font-black">Editor versionado da central de ajuda</summary>
      <div className="mt-4 grid gap-4 xl:grid-cols-[0.7fr_1.3fr]">
        <label className="text-xs font-bold">Artigo<select className="field mt-1" value={selectedId} onChange={(event) => choose(event.target.value)}>{articles.map((article) => <option key={article.id} value={article.id}>{article.title} · v{article.version}</option>)}</select></label>
        <div className="space-y-3">
          <label className="block text-xs font-bold">Título<input className="field mt-1" value={draft.title} onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))} /></label>
          <label className="block text-xs font-bold">Resumo<textarea className="field mt-1 min-h-20" value={draft.summary} onChange={(event) => setDraft((value) => ({ ...value, summary: event.target.value }))} /></label>
          <label className="block text-xs font-bold">Conteúdo<textarea className="field mt-1 min-h-40" value={draft.content} onChange={(event) => setDraft((value) => ({ ...value, content: event.target.value }))} /></label>
          <label className="block text-xs font-bold">Palavras-chave<input className="field mt-1" value={draft.keywords} onChange={(event) => setDraft((value) => ({ ...value, keywords: event.target.value }))} /></label>
          <label className="block text-xs font-bold">Motivo da versão<input className="field mt-1" value={draft.reason} onChange={(event) => setDraft((value) => ({ ...value, reason: event.target.value }))} /></label>
          <button className="btn btn-primary" type="button" disabled={pending || draft.reason.trim().length < 3} onClick={() => void publish()}><Save size={14} /> {pending ? "Publicando..." : "Publicar nova versão"}</button>
          {notice && <p className="text-xs text-[#80d9a5]">{notice}</p>}
        </div>
      </div>
    </details>
  );
}

