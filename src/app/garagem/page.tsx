import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { addVehicle } from "./actions";

export default async function GaragemPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: vehicles }, { data: appointments }, { data: serviceOrders }, { data: orders }] =
    await Promise.all([
      supabase.from("vehicles").select("*").eq("owner_id", user!.id).order("created_at", { ascending: false }),
      supabase
        .from("appointments")
        .select("*, vehicles(plate, brand, model), services(name), service_bays(name)")
        .eq("owner_id", user!.id)
        .order("starts_at", { ascending: false }),
      supabase
        .from("service_orders")
        .select("*, vehicles(plate, model)")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("orders")
        .select("*, order_items(quantity, unit_price_cents, parts_catalog(name))")
        .eq("owner_id", user!.id)
        .order("created_at", { ascending: false }),
    ]);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Minha Garagem Digital</h1>
          <p className="text-sm text-slate-600">
            Gerencie seus veículos, acompanhe agendamentos, histórico de OS e pedidos de peças.
          </p>
        </div>
        <Link
          href="/agendar"
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800"
        >
          + Novo Agendamento
        </Link>
      </div>

      {/* Cadastro rápido de veículo */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Cadastrar Veículo</h2>
        <form action={addVehicle} className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <input name="plate" required placeholder="Placa (ABC1D23)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="brand" required placeholder="Marca (ex: Volkswagen)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="model" required placeholder="Modelo (ex: Polo)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="year" type="number" required placeholder="Ano (2023)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="current_km" type="number" required placeholder="Km atual" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Salvar Veículo
          </button>
        </form>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {(vehicles ?? []).map((v) => (
            <div key={v.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-bold text-blue-800">{v.plate}</span>
                <span className="text-xs text-slate-500">{v.year}</span>
              </div>
              <p className="mt-1 font-semibold text-slate-900">
                {v.brand} {v.model}
              </p>
              <p className="text-xs text-slate-600">{v.current_km.toLocaleString("pt-BR")} km</p>
            </div>
          ))}
        </div>
      </section>

      {/* Agendamentos e Histórico de Serviços */}
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Agendamentos</h2>
          <div className="mt-4 space-y-3">
            {(appointments ?? []).length === 0 && (
              <p className="text-sm text-slate-500">Nenhum agendamento registrado.</p>
            )}
            {(appointments ?? []).map((a: any) => (
              <div key={a.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{a.services?.name}</span>
                  <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                    {a.status}
                  </span>
                </div>
                <p className="mt-1 text-slate-600">
                  {a.vehicles?.brand} {a.vehicles?.model} ({a.vehicles?.plate}) · {a.service_bays?.name}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">{formatDateTimeBR(a.starts_at)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Histórico de Ordens de Serviço &amp; Peças</h2>
          <div className="mt-4 space-y-3">
            {(serviceOrders ?? []).map((os: any) => (
              <div key={os.id} className="rounded-lg border border-slate-200 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    OS #{os.id.slice(0, 8)} · {os.vehicles?.plate}
                  </span>
                  <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                    {os.status}
                  </span>
                </div>
                {os.diagnosis_summary && <p className="mt-1 text-slate-600">{os.diagnosis_summary}</p>}
                <p className="mt-1 font-semibold text-slate-900">{formatBRL(os.total_cents)}</p>
              </div>
            ))}
            {(orders ?? []).map((ord: any) => (
              <div key={ord.id} className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">
                    Pedido Peças #{ord.id.slice(0, 8)} ({ord.fulfillment_mode})
                  </span>
                  <span className="text-xs font-semibold text-emerald-800">{ord.status}</span>
                </div>
                <p className="mt-1 font-semibold text-slate-900">{formatBRL(ord.total_cents)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
