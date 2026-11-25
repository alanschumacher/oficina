import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatBRL, formatDateTimeBR } from "@/lib/format";
import { createAppointment } from "./actions";

export default async function AgendarPage({
  searchParams,
}: {
  searchParams: Promise<{ service_id?: string; date?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: vehicles }, { data: services }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("owner_id", user!.id),
    supabase.from("services").select("*").eq("active", true).order("name"),
  ]);

  const selectedServiceId = params.service_id ?? services?.[0]?.id;
  const selectedDate = params.date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const selectedService = (services ?? []).find((s) => s.id === selectedServiceId);

  const { data: slots } = selectedServiceId
    ? await supabase.rpc("get_available_slots", {
        p_service_id: selectedServiceId,
        p_date: selectedDate,
      })
    : { data: [] };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Agendamento Online de Revisão e Corretiva</h1>
        <p className="text-sm text-slate-600">
          Os horários abaixo respeitam em tempo real a disponibilidade de boxes, técnicos especialistas e buffer operacional.
        </p>
      </div>

      {params.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</div>
      )}

      {(vehicles ?? []).length === 0 ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          Cadastre pelo menos um veículo na sua{" "}
          <Link href="/garagem" className="font-semibold underline">
            Garagem Digital
          </Link>{" "}
          antes de agendar.
        </div>
      ) : (
        <>
          <form method="GET" className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-slate-700">Serviço</label>
              <select
                name="service_id"
                defaultValue={selectedServiceId}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {(services ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.duration_min} min · {formatBRL(s.base_price_cents)})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Data desejada</label>
              <input
                type="date"
                name="date"
                defaultValue={selectedDate}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Consultar Horários
              </button>
            </div>
          </form>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Horários Disponíveis ({(slots ?? []).length})
            </h2>
            {(slots ?? []).length === 0 && (
              <p className="text-sm text-slate-500">
                Nenhum slot livre para esta data. Selecione outro dia acima.
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(slots ?? []).map((slot: any) => (
                <form
                  key={`${slot.slot_start}-${slot.bay_id}`}
                  action={createAppointment}
                  className="space-y-3 rounded-xl border border-slate-200 bg-white p-5"
                >
                  <input type="hidden" name="service_id" value={selectedServiceId} />
                  <input type="hidden" name="type" value={selectedService?.category ?? "preventive"} />
                  <input type="hidden" name="bay_id" value={slot.bay_id} />
                  <input type="hidden" name="technician_id" value={slot.technician_id} />
                  <input type="hidden" name="starts_at" value={slot.slot_start} />
                  <input type="hidden" name="ends_at" value={slot.slot_end} />

                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-blue-800">
                      {formatDateTimeBR(slot.slot_start)}
                    </span>
                    <span className="text-xs font-medium text-slate-500">{slot.bay_name}</span>
                  </div>
                  <p className="text-xs text-slate-600">Técnico alocado: {slot.technician_name}</p>

                  <select
                    name="vehicle_id"
                    required
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                  >
                    {(vehicles ?? []).map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.plate} · {v.brand} {v.model}
                      </option>
                    ))}
                  </select>

                  <textarea
                    name="symptom_notes"
                    rows={2}
                    placeholder="Sintomas ou observações (opcional para revisões)"
                    className="w-full rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
                  />

                  <input
                    type="file"
                    name="evidence_file"
                    accept="image/*"
                    className="block w-full text-xs text-slate-500"
                  />

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800"
                  >
                    Confirmar Agendamento
                  </button>
                </form>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
