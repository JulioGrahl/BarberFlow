import type { Metadata } from "next";
import { cancelMyBooking } from "@/app/actions/booking";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, fullDateTimeBR } from "@/lib/format";

export const metadata: Metadata = { title: "Minha conta" };

type Row = {
  id: string; starts_at: string; status: string; price_cents: number;
  services: { name: string } | null; professionals: { display_name: string } | null; barbershops: { name: string; slug: string } | null;
};
const STATUS: Record<string, string> = { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };
const ALERTS: Record<string, [string, boolean]> = {
  agendado: ["Agendamento confirmado!", false],
  cancelado: ["Agendamento cancelado.", false],
  prazo: ["O prazo para cancelar este horário já passou. Fale com a barbearia.", true],
  cancelamento: ["Não foi possível cancelar. Tente novamente.", true],
};

// Área do cliente: seus agendamentos e cancelamento (respeitando o prazo da barbearia).
export default async function CustomerArea({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireUser("/app");
  const sp = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, status, price_cents, services(name), professionals(display_name), barbershops(name, slug)")
    .order("starts_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as Row[];
  const alertKey = (["agendado", "cancelado", "erro"] as const).map((k) => (sp[k] ? (k === "erro" ? sp.erro : k) : null)).find(Boolean);
  const alert = alertKey ? ALERTS[alertKey] : undefined;
  const upcoming = rows.filter((r) => r.status === "scheduled").reverse();
  const past = rows.filter((r) => r.status !== "scheduled");

  const card = (r: Row, cancellable: boolean) => (
    <li key={r.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{r.services?.name} · {r.barbershops?.name}</p>
          <p className="text-muted">{fullDateTimeBR(r.starts_at)} · com {r.professionals?.display_name}</p>
          <p className="text-muted">{brl(r.price_cents)} · {STATUS[r.status]}</p>
        </div>
        {cancellable ? (
          <form action={cancelMyBooking}>
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2">Cancelar</button>
          </form>
        ) : null}
      </div>
    </li>
  );

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Olá, {profile?.full_name?.split(" ")[0] || "cliente"}</h1>
        <form action="/auth/signout" method="post">
          <button className="rounded-xl border border-line px-3.5 py-2 text-sm hover:bg-surface">Sair</button>
        </form>
      </div>
      {alert ? <p role="status" className={`mt-4 rounded-xl border px-3.5 py-2.5 text-sm ${alert[1] ? "border-danger/40 text-danger" : "border-success/40 text-success"}`}>{alert[0]}</p> : null}
      <h2 className="mt-8 mb-3 text-lg font-medium">Próximos agendamentos</h2>
      {upcoming.length === 0 ? <p className="text-sm text-muted">Nenhum agendamento marcado.</p> : <ul className="space-y-3">{upcoming.map((r) => card(r, true))}</ul>}
      {past.length > 0 ? (<><h2 className="mt-8 mb-3 text-lg font-medium">Histórico</h2><ul className="space-y-3">{past.map((r) => card(r, false))}</ul></>) : null}
      <p className="mt-8 text-sm text-muted">Para agendar, acesse o link da página da sua barbearia (/b/nome-da-barbearia).</p>
    </main>
  );
}
