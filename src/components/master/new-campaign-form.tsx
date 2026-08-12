"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import type { PerfilDeRegras } from "@/server/repositories/master-repository";

export function NewCampaignForm({ profiles }: { profiles: PerfilDeRegras[] }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/master/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.get("name"),
          ruleProfileId: form.get("ruleProfileId"),
          timezone: form.get("timezone"),
          premise: form.get("premise"),
        }),
      });
      const result = (await response.json()) as { id?: string; error?: string };
      if (!response.ok || !result.id) throw new Error(result.error ?? "Falha ao criar campanha.");
      router.push(`/master/campaigns/${result.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha ao criar campanha.");
      setPending(false);
    }
  }

  return (
    <form className="panel mt-6 space-y-5 rounded-xl p-6" onSubmit={create}>
      <label className="block text-xs font-bold text-[#aaa]">
        Nome
        <input required name="name" className="field mt-1" placeholder="Nome da campanha" />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-xs font-bold text-[#aaa]">
          Perfil de regras
          <select required name="ruleProfileId" className="field mt-1" defaultValue="">
            <option value="" disabled>Selecione</option>
            {profiles.map((profile) => <option value={profile.id} key={profile.id}>{profile.nome}</option>)}
          </select>
        </label>
        <label className="block text-xs font-bold text-[#aaa]">
          Fuso horário
          <select name="timezone" className="field mt-1" defaultValue="America/Sao_Paulo">
            <option>America/Belem</option>
            <option>America/Sao_Paulo</option>
            <option>America/Manaus</option>
            <option>America/Fortaleza</option>
            <option>America/Recife</option>
          </select>
        </label>
      </div>
      <label className="block text-xs font-bold text-[#aaa]">
        Premissa pública
        <textarea name="premise" className="field mt-1 min-h-32" placeholder="O que os jogadores podem saber sobre a campanha" />
      </label>
      {profiles.length === 0 && <p className="text-sm text-[#f07580]">Nenhum perfil de regras está disponível no banco.</p>}
      {error && <p className="text-sm text-[#f07580]" role="alert">{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={pending || profiles.length === 0}>
        {pending && <LoaderCircle className="animate-spin" size={15} />}
        Criar campanha
      </button>
    </form>
  );
}
