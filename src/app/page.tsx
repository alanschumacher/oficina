import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";

export const revalidate = 60;

export default async function HomePage() {
  const supabase = await createClient();
  const [{ data: services }, { data: parts }] = await Promise.all([
    supabase.from("services").select("*").eq("active", true).order("base_price_cents").limit(4),
    supabase.from("parts_catalog").select("*").eq("active", true).gt("stock_qty", 0).limit(4),
  ]);

  return (
    <div className="space-y-12">
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">
          Oficina Digital + E-commerce B2C
        </p>
        <h1 className="mt-2 max-w-2xl text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
          Agende revisões sem fila, acompanhe seu histórico e compre peças com instalação garantida.
        </h1>
        <p className="mt-3 max-w-2xl text-base text-slate-600">
          Integração direta entre estoque de peças, boxes disponíveis e técnicos especialistas em tempo real.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/agendar"
            className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Agendar Revisão ou Corretiva
          </Link>
          <Link
            href="/loja"
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Explorar Loja de Peças
          </Link>
          <Link
            href="/garagem"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-5 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Acessar Minha Garagem
          </Link>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Serviços em Destaque</h2>
          <Link href="/agendar" className="text-sm font-semibold text-blue-700 hover:underline">
            Ver horários disponíveis →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(services ?? []).map((svc) => (
            <div key={svc.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="inline-block rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                {svc.duration_min} min
              </span>
              <h3 className="mt-2 font-semibold text-slate-900">{svc.name}</h3>
              <p className="mt-1 text-sm text-slate-600">{svc.description}</p>
              <p className="mt-4 text-lg font-bold text-slate-900">{formatBRL(svc.base_price_cents)}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Peças B2C com Pronta Entrega ou Instalação</h2>
          <Link href="/loja" className="text-sm font-semibold text-emerald-700 hover:underline">
            Ir para a loja →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(parts ?? []).map((part) => (
            <div key={part.id} className="rounded-xl border border-slate-200 bg-white p-5">
              <span className="text-xs font-medium text-slate-500">
                {part.brand} · SKU {part.sku}
              </span>
              <h3 className="mt-1 font-semibold text-slate-900">{part.name}</h3>
              <p className="mt-2 text-lg font-bold text-emerald-700">{formatBRL(part.price_cents)}</p>
              <p className="mt-1 text-xs text-slate-500">Em estoque: {part.stock_qty} un.</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
