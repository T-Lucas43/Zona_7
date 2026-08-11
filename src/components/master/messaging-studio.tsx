"use client";

import { useState } from "react";
import { Plus, Send, UserRoundPlus } from "lucide-react";
import type { ContaDaCampanha, Remetente } from "@/server/repositories/master-repository";

const tipos: Record<Remetente["tipo"], string> = {
  master: "Mestre",
  system: "Sistema",
  npc: "Personagem não jogável",
  entity: "Entidade",
  unknown: "Desconhecido",
  custom: "Personalizado",
};

export function MessagingStudio({
  campaignId,
  initialSenders,
  accounts,
}: {
  campaignId: string;
  initialSenders: Remetente[];
  accounts: ContaDaCampanha[];
}) {
  const [remetentes, setRemetentes] = useState(initialSenders);
  const [remetente, setRemetente] = useState(initialSenders[0]?.nome ?? "Mestre");
  const [destinatario, setDestinatario] = useState(accounts[0]?.usuarioId ?? "");
  const [conteudo, setConteudo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Remetente["tipo"]>("npc");
  const [cor, setCor] = useState("#b52532");
  const [efeito, setEfeito] = useState("terminal");
  const [aviso, setAviso] = useState("");

  async function criarRemetente(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/senders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        name: nome,
        senderType: tipo,
        notificationLabel: `Mensagem de ${nome}`,
        color: cor,
        effect: efeito,
      }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao criar remetente.");
    const novo: Remetente = {
      id: result.id ?? crypto.randomUUID(),
      nome,
      tipo,
      cor,
      efeito,
      rotuloNotificacao: `Mensagem de ${nome}`,
      ativo: true,
    };
    setRemetentes((atual) => [...atual, novo]);
    setRemetente(nome);
    setNome("");
    setAviso("Novo remetente criado e selecionado.");
  }

  async function enviar(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        apparentSenderName: remetente,
        recipientUserIds: [destinatario],
        body: conteudo,
        format: "text",
        visibility: "selected",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao enviar mensagem.");
    setConteudo("");
    setAviso(`Mensagem de ${remetente} enviada ao destinatário selecionado.`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <form className="panel rounded-lg p-5" onSubmit={enviar}>
        <p className="eyebrow">canal protegido</p>
        <h2 className="mt-1 text-xl font-extrabold">Criar mensagem</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">
            Remetente aparente
            <select
              className="field mt-1"
              value={remetente}
              onChange={(event) => setRemetente(event.target.value)}
            >
              {remetentes
                .filter((item) => item.ativo)
                .map((item) => (
                  <option key={item.id}>{item.nome}</option>
                ))}
            </select>
          </label>
          <label className="text-xs font-bold">
            Destinatário
            <select
              className="field mt-1"
              value={destinatario}
              onChange={(event) => setDestinatario(event.target.value)}
            >
              {accounts.map((item) => (
                <option value={item.usuarioId} key={item.membroId}>
                  {item.nome}
                  {item.personagem ? ` — ${item.personagem}` : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="mt-3 block text-xs font-bold">
          Conteúdo
          <textarea
            required
            className="field mt-1 min-h-40"
            value={conteudo}
            onChange={(event) => setConteudo(event.target.value)}
            placeholder="Escreva a mensagem que somente o destinatário poderá abrir."
          />
        </label>
        <button className="btn btn-primary mt-3" disabled={!destinatario}>
          <Send size={15} /> Enviar agora
        </button>
      </form>
      <section className="panel rounded-lg p-5">
        <div className="flex items-center gap-2">
          <UserRoundPlus size={17} className="text-[#d84b57]" />
          <h2 className="font-extrabold">Remetentes personalizados</h2>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {remetentes.map((item) => (
            <span className="tag" key={item.id}>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: item.cor }} />{" "}
              {item.nome} · {tipos[item.tipo]}
            </span>
          ))}
        </div>
        <form className="mt-5 border-t border-[#30333a] pt-4" onSubmit={criarRemetente}>
          <h3 className="text-sm font-extrabold">Criar novo remetente</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold">
              Nome
              <input
                required
                className="field mt-1"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
              />
            </label>
            <label className="text-xs font-bold">
              Tipo
              <select
                className="field mt-1"
                value={tipo}
                onChange={(event) => setTipo(event.target.value as Remetente["tipo"])}
              >
                {Object.entries(tipos).map(([valor, rotulo]) => (
                  <option value={valor} key={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold">
              Cor
              <input
                className="field mt-1 h-11"
                type="color"
                value={cor}
                onChange={(event) => setCor(event.target.value)}
              />
            </label>
            <label className="text-xs font-bold">
              Efeito visual
              <select
                className="field mt-1"
                value={efeito}
                onChange={(event) => setEfeito(event.target.value)}
              >
                <option>terminal</option>
                <option>estática</option>
                <option>pulso</option>
                <option>falha</option>
                <option>nenhum</option>
              </select>
            </label>
          </div>
          <button className="btn mt-3">
            <Plus size={14} /> Criar remetente
          </button>
        </form>
      </section>
      {aviso && (
        <p className="text-xs text-[#7bd5a5] xl:col-span-2" role="status">
          {aviso}
        </p>
      )}
    </div>
  );
}
