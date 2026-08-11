"use client";

import { useState } from "react";
import { Send } from "lucide-react";

export function MessageComposer() {
  const [sender, setSender] = useState("DESCONHECIDO");
  const [body, setBody] = useState("");
  const [sent, setSent] = useState("");
  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!body.trim()) return;
    setSent(`Mensagem de ${sender} preparada e entregue apenas ao destinatário selecionado.`);
    setBody("");
  }
  return (
    <form onSubmit={submit} className="panel rounded-lg p-5">
      <p className="eyebrow">canal protegido</p>
      <h2 className="mt-1 font-extrabold">Nova mensagem</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-bold text-[#a3a5ab]">
          Remetente aparente
          <select
            className="field mt-1"
            value={sender}
            onChange={(event) => setSender(event.target.value)}
          >
            <option>DESCONHECIDO</option>
            <option>SISTEMA ZONA 7</option>
            <option>Facilitador</option>
            <option>Mestre</option>
          </select>
        </label>
        <label className="text-xs font-bold text-[#a3a5ab]">
          Destinatário
          <select className="field mt-1">
            <option>Davi Brito</option>
            <option>Todos presentes</option>
            <option>Apenas mestres</option>
          </select>
        </label>
      </div>
      <label className="mt-3 block text-xs font-bold text-[#a3a5ab]">
        Conteúdo
        <textarea
          className="field mt-1 min-h-28 resize-y"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="O conteúdo nunca entra em um canal coletivo sem autorização."
        />
      </label>
      <button type="submit" className="btn btn-primary mt-3">
        <Send size={15} /> Enviar agora
      </button>
      {sent && (
        <p className="mt-3 text-xs text-[#7bd5a5]" aria-live="polite">
          {sent}
        </p>
      )}
    </form>
  );
}
