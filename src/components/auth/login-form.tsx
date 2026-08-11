"use client";

import { useActionState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { signInAction } from "@/server/actions/auth";

export function LoginForm({ demoMode }: { demoMode: boolean }) {
  const [state, action, pending] = useActionState(signInAction, null);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-xs font-bold text-[#b8bac0]">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          className="field"
          placeholder="operador@zona7.com"
          required
        />
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <label htmlFor="password" className="text-xs font-bold text-[#b8bac0]">
            Senha
          </label>
          <a href="/forgot-password" className="text-xs text-[#d65864] hover:underline">
            Esqueci minha senha
          </a>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="field"
          minLength={8}
          required
        />
      </div>
      {state?.error && (
        <p
          role="alert"
          className="flex items-center gap-2 rounded border border-[#6f2630] bg-[#6f1722]/20 p-3 text-xs text-[#f0a5ad]"
        >
          <AlertTriangle size={15} /> {state.error}
        </p>
      )}
      <button type="submit" className="btn btn-primary w-full" disabled={pending || demoMode}>
        {pending ? "Autenticando…" : "Entrar no terminal"} <ArrowRight size={16} />
      </button>
    </form>
  );
}
