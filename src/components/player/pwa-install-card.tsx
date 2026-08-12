"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Download, MonitorDown, Share2, Smartphone, X } from "lucide-react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export function PwaInstallCard({ compact = false }: { compact?: boolean }) {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [ios, setIos] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const initialCheck = window.requestAnimationFrame(() => {
      setInstalled(isStandalone());
      setIos(/iphone|ipad|ipod/i.test(navigator.userAgent));
    });
    const beforeInstall = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPromptEvent); };
    const appInstalled = () => { setInstalled(true); setPrompt(null); setNotice("Zona 7 instalado com sucesso."); };
    window.addEventListener("beforeinstallprompt", beforeInstall);
    window.addEventListener("appinstalled", appInstalled);
    return () => {
      window.cancelAnimationFrame(initialCheck);
      window.removeEventListener("beforeinstallprompt", beforeInstall);
      window.removeEventListener("appinstalled", appInstalled);
    };
  }, []);

  async function install() {
    if (installed) return setNotice("O Zona 7 já está instalado neste dispositivo.");
    if (!prompt) { setShowHelp(true); return; }
    await prompt.prompt();
    const choice = await prompt.userChoice;
    setNotice(choice.outcome === "accepted" ? "Instalação iniciada pelo navegador." : "Instalação cancelada. Você pode tentar novamente.");
    setPrompt(null);
  }

  if (compact) {
    return <button className="btn btn-ghost mt-2 w-full justify-start text-xs" type="button" onClick={() => void install()}><Download size={14} /> {installed ? "Aplicativo instalado" : "Instalar aplicativo"}</button>;
  }

  return (
    <section className="panel pwa-install-card rounded-xl p-5" aria-live="polite">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-[#7d1a25]/25 text-[#ef6573]">{installed ? <CheckCircle2 size={21} /> : <Smartphone size={21} />}</span>
          <div><p className="eyebrow">acesso rápido no celular e computador</p><h2 className="mt-1 font-extrabold">{installed ? "Zona 7 já está instalado" : "Baixar como aplicativo"}</h2><p className="mt-2 max-w-xl text-sm text-[#92959c]">Instale a área do jogador na tela inicial. A ficha e a sessão continuam protegidas pelo seu login.</p></div>
        </div>
        <button className="btn btn-primary" type="button" onClick={() => void install()} disabled={installed}><Download size={15} /> {installed ? "Instalado" : "Instalar agora"}</button>
      </div>
      {showHelp && <div className="mt-4 rounded-lg border border-[#4a3a3f] bg-black/20 p-4">
        <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">Como instalar neste dispositivo</h3><p className="mt-2 text-xs leading-5 text-[#9b9ea5]">{ios ? "No Safari, toque em Compartilhar e depois em Adicionar à Tela de Início." : "Abra o menu do navegador e escolha Instalar aplicativo ou Adicionar à tela inicial. No computador, procure o ícone de instalação na barra de endereço."}</p></div><button className="btn btn-ghost px-2" type="button" aria-label="Fechar instruções" onClick={() => setShowHelp(false)}><X size={14} /></button></div>
        <div className="mt-3 flex gap-2 text-[#d2868e]">{ios ? <Share2 size={16} /> : <MonitorDown size={16} />}<span className="text-xs font-bold">{ios ? "Compartilhar → Adicionar à Tela de Início" : "Menu do navegador → Instalar Zona 7"}</span></div>
      </div>}
      {notice && <p className="mt-3 text-xs text-[#7bd5a5]" role="status">{notice}</p>}
    </section>
  );
}
