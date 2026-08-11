"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, HeartPulse, LockKeyhole, MessageSquare, Package, Radio, ScrollText, Send, Users } from "lucide-react";
import { LiveSync } from "@/components/live-sync";
import { CharacterPortrait } from "@/components/character/character-portrait";
import { MapStudio } from "@/components/master/map-studio";
import { SessionControls } from "@/components/master/session-controls";
import { publishDemoRealtime } from "@/lib/demo-realtime";
import type { CharacterSummary, ResourceKind, SessionSummary } from "@/types/domain";
import type { CenaDaCampanha, ContaDaCampanha, Remetente, RoteiroDaCampanha } from "@/server/repositories/master-repository";
import type { SessionPublicState } from "@/server/repositories/session-repository";

const resourceLabels: Record<ResourceKind, string> = { pv: "PV", pe: "PE", san: "SAN" };

export function SessionHub({
  campaignId, session, initialPublicState, initialCharacters, scene, accounts, senders, scripts, visibleCharacterIds,
}: {
  campaignId: string;
  session: SessionSummary;
  initialPublicState: SessionPublicState;
  initialCharacters: CharacterSummary[];
  scene: CenaDaCampanha;
  accounts: ContaDaCampanha[];
  senders: Remetente[];
  scripts: RoteiroDaCampanha[];
  visibleCharacterIds: string[];
}) {
  const [characters, setCharacters] = useState(initialCharacters);
  const [selectedId, setSelectedId] = useState(initialCharacters[0]?.id ?? "");
  const [visible, setVisible] = useState(() => new Set(visibleCharacterIds));
  const [notice, setNotice] = useState("");
  const [resource, setResource] = useState<ResourceKind>("pv");
  const [amount, setAmount] = useState(5);
  const [reason, setReason] = useState("Acontecimento da sessão");
  const [deliveryKind, setDeliveryKind] = useState<"item" | "handout">("item");
  const [deliveryTarget, setDeliveryTarget] = useState<"selected" | "all">("selected");
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryDetails, setDeliveryDetails] = useState("");
  const [messageTarget, setMessageTarget] = useState<"selected" | "all">("selected");
  const [messageSender, setMessageSender] = useState(senders[0]?.nome ?? "Mestre");
  const [messageBody, setMessageBody] = useState("");
  const [publicState, setPublicState] = useState(initialPublicState);
  const selected = useMemo(() => characters.find((item) => item.id === selectedId) ?? characters[0], [characters, selectedId]);
  const selectedAccount = accounts.find((account) => account.personagem === selected?.name);

  async function mutateResource(direction: -1 | 1) {
    if (!selected) return;
    const response = await fetch("/api/resources/mutate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ characterId: selected.id, resource, delta: direction * Math.abs(amount), operation: direction < 0 ? resource === "pv" ? "damage" : "loss" : resource === "pv" ? "healing" : "recovery", source: "Central da sessão", reason, visibility: "owner_only", sessionId: session.id.match(/^[0-9a-f-]{36}$/i) ? session.id : undefined, idempotencyKey: crypto.randomUUID() }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar recurso.");
    const before = selected.resources[resource];
    const current = Math.max(0, Math.min(before.maximum, before.current + direction * Math.abs(amount)));
    setCharacters((items) => items.map((item) => item.id === selected.id ? { ...item, resources: { ...item.resources, [resource]: { ...before, current } } } : item));
    setNotice(`${selected.name}: ${resourceLabels[resource]} alterado para ${current}. O jogador será atualizado em tempo real.`);
  }

  async function toggleVisibility() {
    if (!selected) return;
    const next = !visible.has(selected.id);
    const response = await fetch("/api/master/session/visibility", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, characterId: selected.id, visible: next }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao alterar visibilidade.");
    setVisible((current) => { const copy = new Set(current); if (next) copy.add(selected.id); else copy.delete(selected.id); return copy; });
    setNotice(`${selected.name} ${next ? "voltou à" : "foi ocultado da"} tela dos jogadores.`);
  }

  async function deliver(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    const targetCharacterIds = deliveryTarget === "all" ? characters.map((item) => item.id) : [selected.id];
    const input = deliveryKind === "item"
      ? { kind: "item", campaignId, targetCharacterIds, name: deliveryName, description: deliveryDetails, quantity: 1 }
      : { kind: "handout", campaignId, targetCharacterIds, title: deliveryName, publicExcerpt: deliveryDetails, protectedText: deliveryDetails };
    const response = await fetch("/api/master/deliveries", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) });
    const result = (await response.json()) as { error?: string; demo?: boolean; notification?: { type: string; title: string; targetCharacterIds: string[] } };
    if (!response.ok) return setNotice(result.error ?? "Falha na entrega.");
    if (result.demo && result.notification) publishDemoRealtime(result.notification);
    setNotice(`${deliveryKind === "item" ? "Item" : "Pista"} entregue ${deliveryTarget === "all" ? "a todos" : `a ${selected.name}`}. Notificação enviada.`);
    setDeliveryName(""); setDeliveryDetails("");
  }

  async function sendMessage(event: React.FormEvent) {
    event.preventDefault();
    const recipientUserIds = messageTarget === "all" ? accounts.filter((account) => account.papel === "Jogador").map((account) => account.usuarioId) : selectedAccount ? [selectedAccount.usuarioId] : [];
    if (recipientUserIds.length === 0) return setNotice("Vincule uma conta ao personagem antes de enviar mensagem.");
    const response = await fetch("/api/master/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ campaignId, apparentSenderName: messageSender, recipientUserIds, body: messageBody, format: "text", visibility: "selected" }) });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao enviar mensagem.");
    setNotice(`Mensagem enviada ${messageTarget === "all" ? "a todos os jogadores" : `a ${selected?.name}`}.`); setMessageBody("");
  }

  async function savePublicState(event: React.FormEvent) {
    event.preventDefault();
    const response = await fetch("/api/master/session/state", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(publicState) });
    const result = (await response.json()) as { error?: string };
    setNotice(response.ok ? "Cena pública atualizada para todos os jogadores." : result.error ?? "Falha ao publicar cena.");
  }

  return (
    <div id="controle-sessao">
      <LiveSync campaignId={campaignId} />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="eyebrow">central da sessão // tela coletiva integrada</p><h1 className="mt-1 text-3xl font-black">{session.title}</h1></div>
        <span className="tag"><Radio size={12} /> {session.status === "active" ? "EM ANDAMENTO" : session.status.toUpperCase()}</span>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#32353c] bg-[#111318] p-4">
        <div><p className="text-xs text-[#7d8087]">CENA PÚBLICA ATUAL</p><strong>{publicState.sceneTitle} · Pressão {session.pressure}/7</strong></div>
        <SessionControls initialTurn={session.round} campaignId={campaignId} sessionId={session.id} initialStatus={session.status} />
      </div>
      <div className="mt-4 grid gap-4 2xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-4">
          <section className="rounded-lg border border-[#5b3036] bg-[#44131a]/15 p-5">
            <div className="flex items-center gap-2 text-[#e3848d]"><LockKeyhole size={17} /><div><p className="eyebrow">ordem da sessão</p><h2 className="font-extrabold">Roteiro — somente mestre</h2></div></div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">{scripts.map((script) => <div className="rounded border border-[#4b2a30] p-3" key={script.id}><strong className="text-sm">{script.nome}</strong><p className="mt-1 text-xs text-[#96787c]">{script.descricao} · versão {script.versao}</p></div>)}</div>
          </section>
          <MapStudio
            campaignId={campaignId}
            initialScene={scene}
            hiddenCharacterIds={characters.filter((character) => !visible.has(character.id)).map((character) => character.id)}
            selectedCharacterId={selected?.id}
            onSelectCharacter={setSelectedId}
          />
          <section className="panel rounded-lg p-5">
            <div className="flex items-center justify-between"><div className="flex items-center gap-2"><Users size={17} className="text-[#d84b57]" /><h2 className="font-extrabold">Personagens da sessão</h2></div><span className="tag">clique para controlar</span></div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {characters.map((character) => (
                <button type="button" onClick={() => setSelectedId(character.id)} key={character.id} className={`rounded-lg border p-4 text-left transition ${selected?.id === character.id ? "border-[#a83a45] bg-[#8a1b27]/15" : "border-[#30333a] bg-black/10"}`}>
                  <div className="flex items-center gap-3"><CharacterPortrait name={character.name} portraitUrl={character.portraitUrl} className="size-12 rounded-lg" /><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><strong className="truncate">{character.name}</strong>{visible.has(character.id) ? <Eye size={15} className="shrink-0 text-[#7bd5a5]" /> : <EyeOff size={15} className="shrink-0 text-[#d98b93]" />}</div><p className="mt-1 truncate text-xs text-[#858891]">{character.codename ?? character.role} · NEX {character.nex}%</p></div></div>
                  <div className="mt-3 flex flex-wrap gap-2">{Object.values(character.resources).map((item) => <span className="tag" key={item.kind}>{item.kind.toUpperCase()} {item.current}/{item.maximum}</span>)}</div>
                </button>
              ))}
            </div>
          </section>
          <form className="panel rounded-lg p-5" onSubmit={savePublicState}>
            <div className="flex items-center gap-2"><Radio size={17} className="text-[#d84b57]" /><div><p className="eyebrow">somente conteúdo seguro</p><h2 className="font-extrabold">O que os jogadores veem</h2></div></div>
            <label className="mt-4 block text-xs font-bold">Título da cena<input className="field mt-1" value={publicState.sceneTitle} onChange={(event) => setPublicState((state) => ({ ...state, sceneTitle: event.target.value }))} /></label>
            <label className="mt-3 block text-xs font-bold">Resumo público<textarea className="field mt-1 min-h-24" value={publicState.publicSummary} onChange={(event) => setPublicState((state) => ({ ...state, publicSummary: event.target.value }))} /></label>
            <label className="mt-3 block text-xs font-bold">Objetivo público<input className="field mt-1" value={publicState.publicObjective} onChange={(event) => setPublicState((state) => ({ ...state, publicObjective: event.target.value }))} /></label>
            <button className="btn btn-primary mt-3">Publicar na sala ao vivo</button>
          </form>
        </div>
        <aside className="space-y-4">
          {selected && <section className="panel rounded-lg p-5" id="acoes-rapidas" aria-live="polite">
            <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">ações rápidas</p><h2 className="text-xl font-extrabold">{selected.name}</h2></div><button className="btn px-3" type="button" onClick={() => void toggleVisibility()}>{visible.has(selected.id) ? <EyeOff size={14} /> : <Eye size={14} />}{visible.has(selected.id) ? "Ocultar" : "Mostrar"}</button></div>
            <div className="mt-4 flex items-center gap-2"><HeartPulse size={16} className="text-[#df4855]" /><strong className="text-sm">Dano, cura e recursos</strong></div>
            <div className="mt-3 grid grid-cols-[1fr_0.65fr] gap-2"><select className="field" value={resource} onChange={(event) => setResource(event.target.value as ResourceKind)}><option value="pv">PV</option><option value="pe">PE</option><option value="san">SAN</option></select><input className="field" type="number" min="1" value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></div>
            <input className="field mt-2" value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Motivo da alteração" />
            <div className="mt-2 grid grid-cols-2 gap-2"><button className="btn border-[#6e252e] text-[#f0949d]" type="button" onClick={() => void mutateResource(-1)}>Aplicar dano/perda</button><button className="btn border-[#2f6147] text-[#7bd5a5]" type="button" onClick={() => void mutateResource(1)}>Curar/recuperar</button></div>
          </section>}
          <form className="panel rounded-lg p-5" onSubmit={deliver}>
            <div className="flex items-center gap-2">{deliveryKind === "item" ? <Package size={17} /> : <ScrollText size={17} />}<h2 className="font-extrabold">Entregar item ou pista</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><select className="field" value={deliveryKind} onChange={(event) => setDeliveryKind(event.target.value as "item" | "handout")}><option value="item">Item</option><option value="handout">Pista</option></select><select className="field" value={deliveryTarget} onChange={(event) => setDeliveryTarget(event.target.value as "selected" | "all")}><option value="selected">Somente {selected?.name}</option><option value="all">Todos os jogadores</option></select></div>
            <input required className="field mt-2" placeholder={deliveryKind === "item" ? "Nome do item" : "Título da pista"} value={deliveryName} onChange={(event) => setDeliveryName(event.target.value)} />
            <textarea className="field mt-2 min-h-20" placeholder="Descrição ou conteúdo" value={deliveryDetails} onChange={(event) => setDeliveryDetails(event.target.value)} />
            <button className="btn btn-primary mt-2"><Send size={14} /> Entregar e notificar</button>
          </form>
          <form className="panel rounded-lg p-5" onSubmit={sendMessage}>
            <div className="flex items-center gap-2"><MessageSquare size={17} /><h2 className="font-extrabold">Mensagem imediata</h2></div>
            <div className="mt-3 grid grid-cols-2 gap-2"><select className="field" value={messageSender} onChange={(event) => setMessageSender(event.target.value)}>{senders.filter((sender) => sender.ativo).map((sender) => <option key={sender.id}>{sender.nome}</option>)}</select><select className="field" value={messageTarget} onChange={(event) => setMessageTarget(event.target.value as "selected" | "all")}><option value="selected">Somente {selected?.name}</option><option value="all">Todos</option></select></div>
            <textarea required className="field mt-2 min-h-24" value={messageBody} onChange={(event) => setMessageBody(event.target.value)} placeholder="Mensagem privada; o remetente real continua protegido." />
            <button className="btn btn-primary mt-2"><Send size={14} /> Enviar mensagem</button>
          </form>
          {notice && <p className="rounded border border-[#315b45] bg-[#153323]/30 p-3 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
        </aside>
      </div>
    </div>
  );
}
