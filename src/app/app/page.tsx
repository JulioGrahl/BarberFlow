import type { Metadata } from "next";
import Link from "next/link";
import { cancelMyBooking } from "@/app/actions/booking";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, dayMonth, spParts, timeBR } from "@/lib/format";

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
  const user = await requireUser("/app");
  const sp = await searchParams;
  const profile = await getProfile();
  const supabase = await createClient();
  // Somente os agendamentos feitos por esta pessoa como cliente. Filtro explícito, independente do papel
  // (um dono ou barbeiro logado também só vê aqui os próprios horários; a agenda da equipe fica no painel).
  const { data: mine } = await supabase.from("customers").select("id").eq("profile_id", user.id);
  const ids = (mine ?? []).map((c) => c.id);
  const { data } = ids.length === 0 ? { data: [] } : await supabase
    .from("appointments")
    .select("id, starts_at, status, price_cents, services(name), professionals(display_name), barbershops(name, slug)")
    .in("customer_id", ids)
    .order("starts_at", { ascending: false })
    .limit(50);
  const rows = (data ?? []) as unknown as Row[];
  const alertKey = (["agendado", "cancelado", "erro"] as const).map((k) => (sp[k] ? (k === "erro" ? sp.erro : k) : null)).find(Boolean);
  const alert = alertKey ? ALERTS[alertKey] : undefined;
  const upcoming = rows.filter((r) => r.status === "scheduled").reverse();
  const past = rows.filter((r) => r.status !== "scheduled");

  const card = (r: Row, cancellable: boolean) => {
    const p = spParts(r.starts_at);
    return (
      <li key={r.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="w-14 shrink-0 rounded-lg bg-surface-2 py-2 text-center">
          <p className="font-display text-2xl leading-none">{p.ymd.slice(8)}</p>
          <p className="text-xs text-muted">{dayMonth(p.ymd).slice(3)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg">{r.services?.name}</p>
          <p className="text-muted">{r.barbershops?.name} · {timeBR(r.starts_at)} com {r.professionals?.display_name}</p>
          <p className="text-muted">{brl(r.price_cents)}{r.status === "scheduled" ? "" : ` · ${STATUS[r.status]}`}</p>
        </div>
        {cancellable ? (
          <form action={cancelMyBooking}>
            <input type="hidden" name="id" value={r.id} />
            <button className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2 hover:text-danger">Cancelar</button>
          </form>
        ) : null}
      </li>
    );
  };
  const shops = [...new Map(rows.filter((r) => r.barbershops).map((r) => [r.barbershops!.slug, r.barbershops!.name])).entries()];

  return (
    <div className="flex-1">
      <div className="pole h-2 w-full" aria-hidden />
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Minha conta</p>
            <h1 className="font-display text-4xl">Olá, {profile?.full_name?.split(" ")[0] || "cliente"}</h1>
          </div>
          <form action="/auth/signout" method="post"><button className="rounded-lg border border-line px-3.5 py-2 text-sm hover:bg-surface">Sair</button></form>
        </div>
        {alert ? <p role="status" className={`mt-5 rounded-lg border px-3.5 py-2.5 text-sm ${alert[1] ? "border-danger/40 text-danger" : "border-success/40 text-success"}`}>{alert[0]}</p> : null}
        <h2 className="font-display mt-10 mb-3 text-2xl">Próximos horários</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-muted">Nenhum horário marcado.{shops.length ? "" : " Abra o link da sua barbearia (/b/nome-da-barbearia) para agendar."}</p>
        ) : <ul className="space-y-3">{upcoming.map((r) => card(r, true))}</ul>}
        {shops.length > 0 ? (
          <>
            <h2 className="font-display mt-10 mb-3 text-2xl">Agendar de novo</h2>
            <div className="flex flex-wrap gap-2">
              {shops.map(([slug, name]) => <Link key={slug} href={`/b/${slug}/agendar`} className="rounded-lg border border-line bg-surface px-4 py-2.5 text-sm hover:border-accent/50">{name}</Link>)}
            </div>
          </>
        ) : null}
        {past.length > 0 ? (<><h2 className="font-display mt-10 mb-3 text-2xl">Histórico</h2><ul className="space-y-3">{past.map((r) => card(r, false))}</ul></>) : null}
      </main>
    </div>
  );
}
