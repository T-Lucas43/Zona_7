import type { Metadata, Viewport } from "next";
import "./globals.css";
import { appConfig } from "@/lib/config";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  metadataBase: new URL(appConfig.appUrl),
  title: { default: "Zona 7 - Terminal", template: "%s | Zona 7" },
  description: "Terminal narrativo em tempo real para campanhas de Zona 7.",
  applicationName: "Zona 7",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Zona 7 - Terminal",
    description: "A Convergência já começou. Controle narrativo, fichas e sessões em tempo real.",
    type: "website",
    locale: "pt_BR",
    images: [
      {
        url: "/og.png",
        width: 1728,
        height: 919,
        alt: "Zona 7 - Terminal: Sete Segundos Antes.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Zona 7 - Terminal",
    description: "A Convergência já começou.",
    images: ["/og.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#08090b",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" data-scroll-behavior="smooth">
      <body>
        <a
          href="#conteudo"
          className="fixed left-3 top-3 z-[1000] -translate-y-24 rounded bg-white px-3 py-2 text-black focus:translate-y-0"
        >
          Pular para o conteúdo
        </a>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
