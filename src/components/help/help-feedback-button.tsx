"use client";

import { useState } from "react";
import { CircleAlert, Send, X } from "lucide-react";

export function HelpFeedbackButton({ campaignId, articleId }: { campaignId: string; articleId: string }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [pending, setPending] = useState(false);
  async function submit() {
    setPending(true);
    setNotice("");
    const response = await fetch("/api/help/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ campaignId, articleId, message }),
    });
    const payload = await response.json();
    setPending(false);
    if (!response.ok) return setNotice(payload.error ?? "Não foi possível enviar.");
    setNotice("Relato enviado ao mestre.");
    setMessage("");
    setOpen(false);
  }
  if (!open) return <button className="help-feedback-link" type="button" onClick={() => setOpen(true)}><CircleAlert size={13} /> Esta regra parece errada</button>;
  return (
    <div className="mt-4 rounded-lg border border-[#5b3339] bg-black/20 p-3">
      <div className="flex justify-between gap-3"><strong className="text-xs">Reportar ao mestre</strong><button className="btn min-h-8 px-2 py-1" type="button" aria-label="Cancelar" onClick={() => setOpen(false)}><X size={13} /></button></div>
      <textarea className="field mt-2 min-h-20" placeholder="Explique o que parece divergente." value={message} onChange={(event) => setMessage(event.target.value)} />
      <button className="btn btn-primary mt-2 w-full" type="button" disabled={pending || message.trim().length < 3} onClick={() => void submit()}><Send size={13} /> {pending ? "Enviando..." : "Enviar"}</button>
      {notice && <p className="mt-2 text-xs text-[#f09aa3]">{notice}</p>}
    </div>
  );
}

