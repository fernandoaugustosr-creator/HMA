import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { isLocalMode } from "@/lib/local-db";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sistema de Escala ENF-HMA",
  description: "Sistema de gerenciamento de escalas de enfermagem",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isLocal = isLocalMode();
  
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        {children}
        <footer className="fixed bottom-0 w-full bg-gray-100 text-xs text-center py-1 opacity-75 pointer-events-none">
          {isLocal ? (
            <span className="text-amber-600 font-bold">⚠️ MODO LOCAL (Dados temporários) - Configure o Supabase para produção</span>
          ) : (
            <span className="text-green-600">✅ Conectado ao Supabase</span>
          )}
        </footer>
      </body>
    </html>
  );
}
