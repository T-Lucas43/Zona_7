"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";

export function CreateSessionForm({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/master/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ campaignId, title }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Falha ao criar sessão.");
      router.push(`/master/campaigns/${campaignId}/sessions/${result.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar sessão.");
      setPending(false);
    }
  }

  return (
    <form className="mt-5 max-w-lg" onSubmit={create}>
      <label className="block text-xs font-bold">
        Nome da sessão
        <input required className="field mt-1" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Digite um nome" />
      </label>
      {error && <p className="mt-2 text-xs text-[#f07580]" role="alert">{error}</p>}
      <button className="btn btn-primary mt-3" disabled={pending}>
        {pending ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}
        Criar sessão
      </button>
    </form>
  );
}
