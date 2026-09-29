import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ideias em Rede",
  description: "Um espaço para conectar ideias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
