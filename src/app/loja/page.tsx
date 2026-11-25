import { createClient } from "@/lib/supabase/server";
import { formatBRL } from "@/lib/format";
import { quickBuyPart } from "./actions";

export default async function LojaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; brand?: string; model?: string; error?: string }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("parts_catalog")
    .select("*, vehicle_compatibility(brand, model, year_from, year_to)")
    .eq("active", true)
    .order("name");

  if (params.q) {
    query = query.ilike("name", `%${params.q}%`);
  }

  const { data: allParts } = await query;

  const filteredParts = (allParts ?? []).filter((part: any) => {
    if (!params.brand && !params.model) return true;
    return (part.vehicle_compatibility ?? []).some((c: any) => {
      const brandOk = !params.brand || c.brand.toLowerCase().includes(params.brand.toLowerCase());
      const modelOk = !params.model || c.model.toLowerCase().includes(params.model.toLowerCase());
      return brandOk && modelOk;
    });
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">E-commerce de Peças Automotivas B2C</h1>
        <p className="text-sm text-slate-600">
          Filtre por compatibilidade veicular e escolha entre entrega, retirada no balcão ou compra com instalação na oficina.
        </p>
      </div>

      {params.error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{params.error}</div>
      )}

      <form method="GET" className="grid gap-3 rounded-xl border border-slate-200 bg-white p-5 sm:grid-cols-4">
        <input
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Buscar peça (ex: pastilha, óleo)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="brand"
          defaultValue={params.brand ?? ""}
          placeholder="Marca do veículo (ex: Volkswagen)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <input
          name="model"
          defaultValue={params.model ?? ""}
          placeholder="Modelo (ex: Polo)"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Filtrar Catálogo
        </button>
      </form>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {filteredParts.map((part: any) => (
          <form
            key={part.id}
            action={quickBuyPart}
            className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5"
          >
            <div>
              <input type="hidden" name="part_id" value={part.id} />
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>{part.brand}</span>
                <span className="font-mono">{part.sku}</span>
              </div>
              <h2 className="mt-1 text-base font-bold text-slate-900">{part.name}</h2>
              <p className="mt-1 text-sm text-slate-600">{part.description}</p>
              <p className="mt-3 text-xl font-bold text-emerald-700">{formatBRL(part.price_cents)}</p>
              <p className="text-xs text-slate-500">Estoque disponível: {part.stock_qty} un.</p>
            </div>

            <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
              <div className="flex gap-2">
                <input
                  type="number"
                  name="quantity"
                  min={1}
                  max={part.stock_qty}
                  defaultValue={1}
                  className="w-20 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <select
                  name="fulfillment_mode"
                  className="flex-1 rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
                >
                  <option value="delivery">Entrega (+ R$ 29,90)</option>
                  <option value="pickup">Retirar no balcão (Grátis)</option>
                  {part.is_installable && <option value="install_at_shop">Comprar + Instalar na oficina</option>}
                </select>
              </div>
              <button
                type="submit"
                disabled={part.stock_qty === 0}
                className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:bg-slate-300"
              >
                {part.stock_qty > 0 ? "Reservar e Finalizar Pedido" : "Indisponível"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
