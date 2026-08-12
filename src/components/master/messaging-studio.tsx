"use client";

import { useState } from "react";
import { CheckCircle2, Eye, Pencil, Plus, UserRoundPlus } from "lucide-react";
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
  const [destinatarios, setDestinatarios] = useState<string[]>(
    accounts.find((item) => item.papel === "Jogador")?.usuarioId
      ? [accounts.find((item) => item.papel === "Jogador")!.usuarioId]
      : [],
  );
  const [conteudo, setConteudo] = useState("");
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Remetente["tipo"]>("npc");
  const [cor, setCor] = useState("#b52532");
  const [efeito, setEfeito] = useState("terminal");
  const [aviso, setAviso] = useState("");
  const [revisando, setRevisando] = useState(false);

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

  function alternarDestinatario(userId: string) {
    setDestinatarios((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
    setRevisando(false);
  }

  function revisar(event: React.FormEvent) {
    event.preventDefault();
    if (destinatarios.length === 0) return setAviso("Selecione pelo menos um destinatário.");
    setRevisando(true);
    setAviso("");
  }

  async function enviar() {
    const response = await fetch("/api/master/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        apparentSenderName: remetente,
        recipientUserIds: destinatarios,
        body: conteudo,
        format: "text",
        visibility: "selected",
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Falha ao enviar mensagem.");
    setConteudo("");
    setRevisando(false);
    setAviso(`Mensagem de ${remetente} enviada a ${destinatarios.length} destinatário(s).`);
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
      <form className="panel rounded-lg p-5" onSubmit={revisar}>
        <p className="eyebrow">canal protegido</p>
        <h2 className="mt-1 text-xl font-extrabold">Criar mensagem</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold">
            Remetente aparente
            <select
              className="field mt-1"
              value={remetente}
              onChange={(event) => { setRemetente(event.target.value); setRevisando(false); }}
            >
              {remetentes
                .filter((item) => item.ativo)
                .map((item) => (
                  <option key={item.id}>{item.nome}</option>
                ))}
            </select>
          </label>
          <div className="text-xs font-bold">
            Destinatários ({destinatarios.length})
            <div className="field mt-1 max-h-32 overflow-y-auto p-2">
              {accounts.map((item) => <label className="flex cursor-pointer items-center gap-2 rounded p-1.5 hover:bg-white/5" key={item.membroId}>
                <input type="checkbox" checked={destinatarios.includes(item.usuarioId)} onChange={() => alternarDestinatario(item.usuarioId)} />
                <span className="min-w-0"><strong className="block truncate">{item.nome}</strong><span className="block truncate font-normal text-[#777a82]">{item.personagem ?? item.papel}</span></span>
              </label>)}
              {accounts.length === 0 && <span className="font-normal text-[#777a82]">Nenhuma conta cadastrada.</span>}
            </div>
          </div>
        </div>
        <label className="mt-3 block text-xs font-bold">
          Conteúdo
          <textarea
            required
            className="field mt-1 min-h-40"
            value={conteudo}
            onChange={(event) => { setConteudo(event.target.value); setRevisando(false); }}
            placeholder="Escreva a mensagem que somente o destinatário poderá abrir."
          />
        </label>
        <button className="btn btn-primary mt-3" disabled={destinatarios.length === 0}>
          <Eye size={15} /> Revisar antes de enviar
        </button>
        {revisando && <section className="mt-4 rounded-lg border border-[#754049] bg-[#7d1a25]/10 p-4" aria-label="Revisão da mensagem">
          <p className="eyebrow">confirmação obrigatória</p>
          <h3 className="mt-1 font-extrabold">Prévia da mensagem</h3>
          <p className="mt-3 text-xs text-[#8f9299]">De <strong className="text-white">{remetente}</strong> para <strong className="text-white">{accounts.filter((item) => destinatarios.includes(item.usuarioId)).map((item) => item.personagem ? `${item.nome} (${item.personagem})` : item.nome).join(", ")}</strong></p>
          <p className="mt-3 whitespace-pre-wrap rounded border border-[#30333a] bg-black/20 p-3 text-sm">{conteudo}</p>
          <div className="mt-3 flex flex-wrap gap-2"><button className="btn" type="button" onClick={() => setRevisando(false)}><Pencil size={14} /> Continuar editando</button><button className="btn btn-primary" type="button" onClick={() => void enviar()}><CheckCircle2 size={14} /> Confirmar envio</button></div>
        </section>}
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
