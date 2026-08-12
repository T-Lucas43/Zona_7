"use client";

import { useState } from "react";
import { ArrowLeft, KeyRound, LogOut, UserRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { PwaInstallCard } from "@/components/player/pwa-install-card";
import { signOutAction } from "@/server/actions/auth";
import type { AuthenticatedUser } from "@/types/domain";

export function UserProfileMenu({ user, showInstall }: { user: AuthenticatedUser; showInstall: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [changing, setChanging] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [notice, setNotice] = useState("");
  async function changePassword(event: React.FormEvent) {
    event.preventDefault(); setNotice("");
    if (password !== confirm) return setNotice("As senhas não coincidem.");
    const response = await fetch("/api/account/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    const result = await response.json() as { error?: string };
    if (!response.ok) return setNotice(result.error ?? "Falha ao trocar senha.");
    setPassword(""); setConfirm(""); setChanging(false); setNotice("Senha atualizada com segurança.");
  }
  return <div className="flex items-center gap-2">
    <button className="btn px-3 lg:hidden" type="button" onClick={() => router.back()} aria-label="Voltar"><ArrowLeft size={16} /></button>
    <div className="relative"><button className="btn px-3" type="button" onClick={() => setOpen((value) => !value)} aria-label="Abrir perfil"><UserRound size={17} /></button>
      {open && <div className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-[#3a3d44] bg-[#111318] p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3"><div><p className="eyebrow">perfil</p><strong className="mt-1 block">{user.displayName}</strong><p className="mt-1 text-xs text-[#777a82]">{user.email}</p></div><button className="btn px-2" type="button" onClick={() => setOpen(false)}><X size={13} /></button></div>
        {!changing ? <button className="btn mt-4 w-full justify-start" type="button" onClick={() => setChanging(true)}><KeyRound size={14} /> Trocar senha</button> : <form className="mt-4 rounded border border-[#30333a] p-3" onSubmit={changePassword}><label className="text-xs font-bold">Nova senha<input required minLength={10} className="field mt-1" type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="mt-2 block text-xs font-bold">Confirmar senha<input required minLength={10} className="field mt-1" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} /></label><button className="btn btn-primary mt-3 w-full">Atualizar senha</button></form>}
        {showInstall && <div className="mt-3"><PwaInstallCard compact /></div>}
        <form action={signOutAction} className="mt-3"><button className="btn w-full justify-start text-[#f0949d]"><LogOut size={14} /> Sair da conta</button></form>
        {notice && <p className="mt-3 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
      </div>}
    </div>
  </div>;
}
