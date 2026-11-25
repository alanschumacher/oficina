import { signIn, signUp } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Acesso do Motorista e Oficina</h1>
      <p className="mt-1 text-sm text-slate-600">
        Entre para gerenciar seus veículos, agendamentos e pedidos de peças.
      </p>

      {params.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {params.error}
        </div>
      )}

      <form className="mt-6 space-y-4">
        <input type="hidden" name="next" value={params.next ?? "/garagem"} />
        <div>
          <label className="block text-sm font-medium text-slate-700">Nome completo (apenas cadastro)</label>
          <input
            name="full_name"
            type="text"
            placeholder="João da Silva"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">E-mail</label>
          <input
            name="email"
            type="email"
            required
            placeholder="voce@exemplo.com"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700">Senha</label>
          <input
            name="password"
            type="password"
            required
            minLength={6}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex gap-3 pt-2">
          <button
            formAction={signIn}
            className="flex-1 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800"
          >
            Entrar
          </button>
          <button
            formAction={signUp}
            className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Criar conta
          </button>
        </div>
      </form>
    </div>
  );
}
