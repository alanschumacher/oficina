import { createClient } from "@/lib/supabase/server";
import { formatDateTimeBR } from "@/lib/format";
import { AdminRealtimeRefresh } from "@/components/AdminRealtimeRefresh";
import { updateServiceOrderStatus } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [{ data: bays }, { data: technicians }, { data: appointments }, { data: serviceOrders }] =
    await Promise.all([
      supabase.from("service_bays").select("*").order("code"),
      supabase.from("technicians").select("*").order("full_name"),
      supabase
        .from("appointments")
        .select("*, vehicles(plate, brand, model), services(name, duration_min), service_bays(code, name), technicians(full_name)")
        .gte("starts_at", todayStart.toISOString())
        .lte("starts_at", todayEnd.toISOString())
        .order("starts_at"),
      supabase
        .from("service_orders")
        .select("*, vehicles(plate, brand, model), technicians(full_name)")
        .order("updated_at", { ascending: false })
        .limit(20),
    ]);

  // Cálculo de taxa de ocupação diária (9h úteis por box = 540 min/box)
  const totalCapacityMin = (bays?.filter((b) => b.active).length ?? 0) * 540;
  const bookedMin = (appointments ?? []).reduce(
    (acc: number, a: any) => acc + (a.services?.duration_min ?? 60),
    0
  );
  const utilizationPct = totalCapacityMin > 0 ? Math.min(100, Math.round((bookedMin / totalCapacityMin) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Painel Administrativo e Capacidade</h1>
          <p className="text-sm text-slate-600">
            Controle de agenda por box, alocação de técnicos especialistas e acompanhamento de Ordens de Serviço.
          </p>
        </div>
        <AdminRealtimeRefresh />
      </div>

      {/* KPIs de Capacidade */}
      <div className="grid gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Ocupação Hoje</p>
          <p className="mt-1 text-3xl font-bold text-blue-700">{utilizationPct}%</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Agendamentos Hoje</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">{(appointments ?? []).length}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Boxes Ativos</p>
          <p className="mt-1 text-3xl font-bold text-emerald-700">
            {(bays ?? []).filter((b) => b.active).length}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Técnicos em Escala</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {(technicians ?? []).filter((t) => t.active).length}
          </p>
        </div>
      </div>

      {/* Agenda do Dia */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Grade de Boxes — Hoje</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Horário</th>
                <th className="py-2 pr-4">Box</th>
                <th className="py-2 pr-4">Técnico</th>
                <th className="py-2 pr-4">Veículo</th>
                <th className="py-2 pr-4">Serviço</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(appointments ?? []).map((a: any) => (
                <tr key={a.id}>
                  <td className="py-3 pr-4 font-mono text-xs">{formatDateTimeBR(a.starts_at)}</td>
                  <td className="py-3 pr-4 font-semibold">{a.service_bays?.name}</td>
                  <td className="py-3 pr-4">{a.technicians?.full_name}</td>
                  <td className="py-3 pr-4">
                    {a.vehicles?.plate} · {a.vehicles?.model}
                  </td>
                  <td className="py-3 pr-4">{a.services?.name}</td>
                  <td className="py-3">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-800">
                      {a.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Gestão de Ordens de Serviço */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Ordens de Serviço Ativas</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {(serviceOrders ?? []).map((os: any) => (
            <form
              key={os.id}
              action={updateServiceOrderStatus}
              className="space-y-3 rounded-lg border border-slate-200 p-4 text-sm"
            >
              <input type="hidden" name="service_order_id" value={os.id} />
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-900">
                  OS #{os.id.slice(0, 8)} · {os.vehicles?.plate} ({os.vehicles?.model})
                </span>
                <span className="text-xs text-slate-500">{os.technicians?.full_name}</span>
              </div>
              <textarea
                name="diagnosis_summary"
                defaultValue={os.diagnosis_summary ?? ""}
                rows={2}
                placeholder="Resumo técnico / diagnóstico"
                className="w-full rounded border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <select
                  name="status"
                  defaultValue={os.status}
                  className="flex-1 rounded border border-slate-300 px-2.5 py-1.5 text-xs"
                >
                  <option value="open">Aberta</option>
                  <option value="diagnosing">Em Diagnóstico</option>
                  <option value="awaiting_approval">Aguardando Aprovação</option>
                  <option value="in_service">Em Execução</option>
                  <option value="ready">Pronto para Retirada</option>
                  <option value="delivered">Entregue</option>
                </select>
                <button
                  type="submit"
                  className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  Atualizar OS
                </button>
              </div>
            </form>
          ))}
        </div>
      </section>
    </div>
  );
}
