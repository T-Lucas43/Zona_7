"use client";

import { useState } from "react";
import { KeyRound, Link2, MailPlus, PauseCircle, PlayCircle, ShieldCheck, UserPlus } from "lucide-react";
import { CharacterPortrait } from "@/components/character/character-portrait";
import type { ContaDaCampanha } from "@/server/repositories/master-repository";
import type { CharacterSummary } from "@/types/domain";

function dataAcesso(valor: string | null) {
  if (!valor) return "Ainda não entrou";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(valor),
  );
}

export function AccountManager({
  campaignId,
  initialAccounts,
  characters,
}: {
  campaignId: string;
  initialAccounts: ContaDaCampanha[];
  characters: CharacterSummary[];
}) {
  const [contas, setContas] = useState(initialAccounts);
  const [aviso, setAviso] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [papel, setPapel] = useState("player");
  const [modo, setModo] = useState<"create" | "invite">("create");
  const [senhaTemporaria, setSenhaTemporaria] = useState("");
  const [personagemId, setPersonagemId] = useState("");
  const [assignments, setAssignments] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      initialAccounts.map((account) => [
        account.membroId,
        characters.find((character) => character.name === account.personagem)?.id ?? "",
      ]),
    ),
  );

  function gerarSenha() {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
    const bytes = crypto.getRandomValues(new Uint8Array(18));
    setSenhaTemporaria(Array.from(bytes, (value) => alphabet[value % alphabet.length]).join(""));
  }

  async function agir(conta: ContaDaCampanha, action: "reset" | "suspend" | "activate") {
    setAviso("");
    const response = await fetch("/api/master/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, memberId: conta.membroId, email: conta.email, action }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) return setAviso(result.error ?? "Não foi possível concluir a ação.");
    if (action !== "reset") {
      setContas((atual) =>
        atual.map((item) =>
          item.membroId === conta.membroId
            ? { ...item, situacao: action === "suspend" ? "Suspenso" : "Ativo" }
            : item,
        ),
      );
    }
    setAviso(
      action === "reset"
        ? `Link seguro de redefinição enviado para ${conta.email}.`
        : `Acesso de ${conta.nome} atualizado.`,
    );
  }

  async function convidar(event: React.FormEvent) {
    event.preventDefault();
    setAviso("");
    const response = await fetch("/api/master/invitations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaignId, displayName: nome, email, role: papel }),
    });
    const result = (await response.json()) as { id?: string; error?: string };
    if (!response.ok) return setAviso(result.error ?? "Não foi possível criar o convite.");
    setContas((atual) => [
      ...atual,
      {
        membroId: result.id ?? crypto.randomUUID(),
        usuarioId: crypto.randomUUID(),
        nome,
        email,
        papel: papel === "player" ? "Jogador" : "Mestre auxiliar",
        situacao: "Convite pendente",
        ultimoAcesso: null,
        personagem: null,
        personagemId: null,
      },
    ]);
    setNome("");
    setEmail("");
    setAviso("Convite criado com validade de 72 horas.");
  }

  async function criarConta(event: React.FormEvent) {
    event.preventDefault();
    setAviso("");
    const personagem = characters.find((item) => item.id === personagemId);
    const response = await fetch("/api/master/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        displayName: nome,
        email,
        temporaryPassword: senhaTemporaria,
        role: papel,
        characterId: papel === "player" ? personagemId || null : null,
      }),
    });
    const result = (await response.json()) as { id?: string; memberId?: string; characterName?: string | null; error?: string };
    if (!response.ok) return setAviso(result.error ?? "Não foi possível criar a conta.");
    const newMemberId = result.memberId ?? crypto.randomUUID();
    setContas((atual) => [...atual, {
      membroId: newMemberId,
      usuarioId: result.id ?? crypto.randomUUID(),
      nome,
      email,
      papel: papel === "player" ? "Jogador" : papel === "co_master" ? "Mestre auxiliar" : "Espectador",
      situacao: "Ativo",
      ultimoAcesso: null,
      personagem: result.characterName ?? personagem?.name ?? null,
      personagemId: papel === "player" ? personagemId || null : null,
    }]);
    setAssignments((current) => ({ ...current, [newMemberId]: papel === "player" ? personagemId : "" }));
    setAviso(`Conta de ${nome} criada${personagem ? ` e vinculada a ${personagem.name}` : ""}. A senha temporária deve ser alterada no primeiro acesso.`);
    setNome("");
    setEmail("");
    setSenhaTemporaria("");
    setPersonagemId("");
  }

  async function salvarVinculo(conta: ContaDaCampanha) {
    const characterId = assignments[conta.membroId] || null;
    const character = characters.find((item) => item.id === characterId);
    const response = await fetch("/api/master/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "assign",
        campaignId,
        memberId: conta.membroId,
        userId: conta.usuarioId,
        characterId,
      }),
    });
    const result = (await response.json()) as { error?: string; characterName?: string | null };
    if (!response.ok) return setAviso(result.error ?? "Não foi possível atualizar o vínculo.");
    setContas((current) => current.map((item) =>
      item.membroId === conta.membroId
        ? { ...item, personagem: result.characterName ?? character?.name ?? null }
        : item,
    ));
    setAviso(character ? `${character.name} foi atribuído à conta de ${conta.nome}.` : `A ficha foi removida da conta de ${conta.nome}.`);
  }

  return (
    <div className="mt-6 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.65fr)]">
      <section className="panel min-w-0 overflow-hidden rounded-lg p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="eyebrow">contas e login</p>
            <h2 className="mt-1 text-xl font-extrabold">Participantes da campanha</h2>
          </div>
          <span className="tag">
            <ShieldCheck size={12} /> acesso protegido
          </span>
        </div>
        <p className="mt-2 text-sm text-[#8f9299]">
          O mestre consulta nome, e-mail, último acesso e vínculo com a ficha. Senhas existentes nunca são exibidas; uma senha temporária só aparece enquanto a nova conta está sendo criada.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-sm">
            <thead className="text-xs uppercase text-[#777a82]">
              <tr>
                <th className="p-3">Participante</th>
                <th className="p-3">Ficha</th>
                <th className="p-3">Situação</th>
                <th className="p-3">Último acesso</th>
                <th className="p-3">Ações</th>
              </tr>
            </thead>
            <tbody>
              {contas.map((conta) => {
                const suspenso = conta.situacao.toLowerCase().includes("susp");
                const linkedCharacter = characters.find((character) => character.name === conta.personagem);
                return (
                  <tr className="border-t border-[#292c32]" key={conta.membroId}>
                    <td className="p-3">
                      <strong>{conta.nome}</strong>
                      <p className="mt-1 text-xs text-[#777a82]">
                        {conta.email} · {conta.papel}
                      </p>
                    </td>
                    <td className="p-3 text-[#a3a5ab]">
                      {conta.papel === "Jogador" ? <div className="flex min-w-[235px] items-center gap-2">
                        {linkedCharacter && <CharacterPortrait name={linkedCharacter.name} portraitUrl={linkedCharacter.portraitUrl} className="size-9 rounded-full" />}
                        <select className="field min-w-0 flex-1 py-2" aria-label={`Personagem de ${conta.nome}`} value={assignments[conta.membroId] ?? ""} onChange={(event) => setAssignments((current) => ({ ...current, [conta.membroId]: event.target.value }))}>
                          <option value="">Sem personagem</option>
                          {characters.map((character) => {
                            const owner = contas.find((item) => item.membroId !== conta.membroId && item.personagem === character.name);
                            return <option value={character.id} disabled={Boolean(owner)} key={character.id}>{character.name}{owner ? " — já atribuído" : ""}</option>;
                          })}
                        </select>
                        <button className="btn px-3" type="button" title="Salvar vínculo" aria-label={`Salvar personagem de ${conta.nome}`} onClick={() => void salvarVinculo(conta)}><Link2 size={14} /></button>
                      </div> : <span>Não se aplica</span>}
                    </td>
                    <td className="p-3">
                      <span className="tag">
                        <span className={`status-dot ${suspenso ? "bg-[#d84b57]" : ""}`} />{" "}
                        {conta.situacao}
                      </span>
                    </td>
                    <td className="p-3 text-xs text-[#8f9299]">{dataAcesso(conta.ultimoAcesso)}</td>
                    <td className="p-3">
                      <div className="flex gap-2">
                        <button
                          className="btn px-2 py-2"
                          type="button"
                          title="Enviar redefinição de senha"
                          onClick={() => void agir(conta, "reset")}
                        >
                          <KeyRound size={14} />
                        </button>
                        <button
                          className="btn px-2 py-2"
                          type="button"
                          title={suspenso ? "Reativar acesso" : "Suspender acesso"}
                          onClick={() => void agir(conta, suspenso ? "activate" : "suspend")}
                        >
                          {suspenso ? <PlayCircle size={14} /> : <PauseCircle size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel min-w-0 rounded-lg p-5">
        <div className="grid grid-cols-2 gap-2 rounded-lg border border-[#30333a] bg-black/20 p-1">
          <button type="button" className={`btn min-h-10 ${modo === "create" ? "btn-primary" : "btn-ghost"}`} onClick={() => setModo("create")}><UserPlus size={14} /> Criar conta</button>
          <button type="button" className={`btn min-h-10 ${modo === "invite" ? "btn-primary" : "btn-ghost"}`} onClick={() => setModo("invite")}><MailPlus size={14} /> Convidar</button>
        </div>
        <form className="mt-5" onSubmit={modo === "create" ? criarConta : convidar}>
        {modo === "create" ? <UserPlus className="text-[#d84b57]" /> : <MailPlus className="text-[#d84b57]" />}
        <h2 className="mt-4 text-xl font-extrabold">{modo === "create" ? "Criar usuário e login" : "Convidar participante"}</h2>
        <label className="mt-4 block text-xs font-bold">
          Nome
          <input
            required
            className="field mt-1"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-bold">
          E-mail
          <input
            required
            className="field mt-1"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-xs font-bold">
          Papel
          <select
            className="field mt-1"
            value={papel}
            onChange={(event) => {
              setPapel(event.target.value);
              if (event.target.value !== "player") setPersonagemId("");
            }}
          >
            <option value="player">Jogador</option>
            <option value="co_master">Mestre auxiliar</option>
            <option value="spectator">Espectador</option>
          </select>
        </label>
        {modo === "create" && papel === "player" && (
          <label className="mt-3 block text-xs font-bold">
            Personagem atribuído
            <select className="field mt-1" value={personagemId} onChange={(event) => setPersonagemId(event.target.value)}>
              <option value="">Atribuir depois</option>
              {characters.filter((character) => !contas.some((conta) => conta.personagem === character.name)).map((character) => <option value={character.id} key={character.id}>{character.name}{character.codename ? ` — ${character.codename}` : ""}</option>)}
            </select>
          </label>
        )}
        {modo === "create" && (
          <label className="mt-3 block text-xs font-bold" htmlFor="temporary-password">
            Senha temporária
            <div className="mt-1 grid grid-cols-[1fr_auto] gap-2">
              <input id="temporary-password" required className="field" type="text" minLength={12} value={senhaTemporaria} onChange={(event) => setSenhaTemporaria(event.target.value)} autoComplete="new-password" />
              <button className="btn" type="button" onClick={gerarSenha}>Gerar</button>
            </div>
            <span className="mt-1 block font-normal text-[#777a82]">Mínimo de 12 caracteres. Copie antes de criar; ela não será mostrada novamente.</span>
          </label>
        )}
        <button className="btn btn-primary mt-4 w-full">
          {modo === "create" ? <><UserPlus size={14} /> Criar conta e atribuir</> : <><MailPlus size={14} /> Criar convite de 72 horas</>}
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
