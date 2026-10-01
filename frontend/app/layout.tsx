import type { Metadata } from "next";
import { Figtree } from "next/font/google";
import Image from "next/image";
import Link from "next/link";
import "./globals.css";

const figtree = Figtree({ subsets: ["latin"], variable: "--font-figtree", display: "swap" });

export const metadata: Metadata = {
  title: "Karkará · Ideias em Rede",
  description: "Como deliberam as audiências públicas da Câmara sobre minorias. Projeto da equipe Karkará no desafio Ideias em Rede.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" className={figtree.variable} suppressHydrationWarning>
      <body className="bg-paper font-sans text-ink antialiased">
        <header className="border-b border-black/10 bg-white px-5 py-4 lg:px-8">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <Image src="/karkara-logo.png" alt="Karkará" width={573} height={200} priority className="h-10 w-auto sm:h-11"/>
              <span className="hidden h-5 w-px bg-black/15 sm:block"/>
              <span className="hidden text-sm font-medium text-[#666666] sm:inline">Ideias em Rede</span>
            </Link>
            <nav className="flex items-center gap-6 text-sm font-medium text-[#666666]">
              <Link href="/#audiencias" className="hover:text-ink">Recorte</Link>
              <Link href="/audiencias" className="hover:text-ink">Audiências</Link>
              <Link href="/comparacao" className="hover:text-ink">Comparação</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="border-t border-black/10 bg-white px-5 py-8 lg:px-8">
          <div className="mx-auto flex max-w-[1200px] flex-col gap-6 text-sm text-[#666666] sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p><strong className="font-semibold text-ink">Equipe Karkará</strong> · desafio Ideias em Rede</p>
              <p className="mt-1 text-xs">Código aberto sob licença MIT.</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs">Uma iniciativa do</span>
              <Image src="/kunumi-positivo.png" alt="Instituto Kunumi" width={120} height={50} className="h-8 w-auto"/>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
