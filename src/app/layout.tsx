import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/login/actions";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoBox · Oficina Mecânica & E-commerce de Peças",
  description: "Agendamento online de revisões, histórico veicular, loja B2C de peças e gestão de capacidade.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = (user?.app_metadata as { role?: string } | undefined)?.role;

  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
              AutoBox <span className="text-blue-700">Pro</span>
            </Link>
            <nav className="flex items-center gap-5 text-sm font-medium text-slate-700">
              <Link href="/loja" className="hover:text-blue-700">
                Loja de Peças
              </Link>
              <Link href="/agendar" className="hover:text-blue-700">
                Agendar Serviço
              </Link>
              <Link href="/garagem" className="hover:text-blue-700">
                Minha Garagem
              </Link>
              {(role === "admin" || role === "technician") && (
                <Link href="/admin" className="font-semibold text-emerald-700 hover:text-emerald-900">
                  Painel Oficina
                </Link>
              )}
              {user ? (
                <form action={signOut}>
                  <button
                    type="submit"
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Sair
                  </button>
                </form>
              ) : (
                <Link
                  href="/login"
                  className="rounded-md bg-blue-700 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Entrar
                </Link>
              )}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
