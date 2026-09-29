import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ideias em Rede",
  description: "Observatório de audiências públicas da Câmara dos Deputados.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="bg-[#f8f7f3] text-zinc-950">
        <header className="border-b border-zinc-200/80 bg-white px-5 py-4 lg:px-8">
          <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-4">
            <Link href="/" className="flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-full bg-orange-500 text-sm font-black text-white">IR</span>
              <span><span className="block font-semibold tracking-tight">Ideias em Rede</span><span className="block text-xs text-zinc-500">Observatório de audiências públicas</span></span>
            </Link>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
