import type { Metadata } from "next";
import Link from "next/link";
import { cancelMyBooking } from "@/app/actions/booking";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, dayMonth, spParts, timeBR } from "@/lib/format";
import { PublicTop } from "@/components/public-shell";
import { ProfileForm } from "@/components/profile-form";

export const metadata: Metadata = { title: "Minha conta" };

type Row = {
  id: string; starts_at: string; status: string; price_cents: number;
  services: { name: string } | null; professionals: { display_name: string } | null; barbershops: { name: string; slug: string } | null;
};
const STATUS: Record<string, string> = { scheduled: "Agendado", completed: "Concluído", cancelled: "Cancelado", no_show: "Não compareceu" };
const ALERTS: Record<string, [string, boolean]> = {
  agendado: ["Agendamento confirmado!", false],
  cancelado: ["Agendamento cancelado.", false],
  remarcado: ["Horário remarcado!", false],
  prazo: ["O prazo para alterar este horário já passou. Fale com a barbearia.", true],
  ocupado: ["Esse horário acabou de ser ocupado. Escolha outro.", true],
  remarcacao: ["Não foi possível remarcar. Tente novamente.", true],
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
  const alertKey = (["agendado", "cancelado", "remarcado", "erro"] as const).map((k) => (sp[k] ? (k === "erro" ? sp.erro : k) : null)).find(Boolean);
  const alert = alertKey ? ALERTS[alertKey] : undefined;
  const upcoming = rows.filter((r) => r.status === "scheduled").reverse();
  const past = rows.filter((r) => r.status !== "scheduled");

  const card = (r: Row, cancellable: boolean) => {
    const p = spParts(r.starts_at);
    return (
      <li key={r.id} className="flex gap-4 rounded-xl border border-line bg-surface p-4 text-sm">
        <div className={`w-14 shrink-0 self-start rounded-lg py-2 text-center ${cancellable ? "bg-night text-night-ink" : "bg-surface-2"}`}>
          <p className="font-display text-3xl leading-none">{p.ymd.slice(8)}</p>
          <p className={`text-xs ${cancellable ? "text-night-muted" : "text-muted"}`}>{dayMonth(p.ymd).slice(3)}</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-display text-2xl leading-tight">{r.services?.name}</p>
          <p className="text-muted">{r.barbershops?.name} · {timeBR(r.starts_at)} com {r.professionals?.display_name}</p>
          <p className="text-muted">{brl(r.price_cents)}{r.status === "scheduled" ? "" : ` · ${STATUS[r.status]}`}</p>
        </div>
        {cancellable ? (
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-start">
            <Link href={`/app/remarcar/${r.id}`} className="rounded-lg border border-line-strong px-3 py-1.5 text-center hover:bg-surface-2">Remarcar</Link>
            <form action={cancelMyBooking}>
              <input type="hidden" name="id" value={r.id} />
              <button className="w-full rounded-lg border border-line-strong px-3 py-1.5 hover:border-danger hover:text-danger">Cancelar</button>
            </form>
          </div>
        ) : null}
      </li>
    );
  };
  const shops = [...new Map(rows.filter((r) => r.barbershops).map((r) => [r.barbershops!.slug, r.barbershops!.name])).entries()];

  return (
    <div className="flex-1">
      <PublicTop kicker="Minha conta" title={`Olá, ${profile?.full_name?.split(" ")[0] || "cliente"}`}
        actions={<form action="/auth/signout" method="post"><button className="min-h-10 rounded-lg border border-night-line px-3.5 text-sm hover:bg-night-2">Sair</button></form>} />
      <main className="mx-auto w-full max-w-2xl px-5 py-8">
        {alert ? <p role="status" className={`mb-2 rounded-lg border px-3.5 py-2.5 text-sm ${alert[1] ? "border-danger/30 bg-danger-bg text-danger" : "border-success/30 bg-success-bg text-success"}`}>{alert[0]}</p> : null}
        <h2 className="font-display mb-3 text-3xl leading-none">Próximos horários</h2>
        {upcoming.length === 0 ? (
          <p className="hex-light rounded-xl border border-dashed border-line-strong bg-surface px-4 py-8 text-center text-sm text-muted">Nenhum horário marcado.{shops.length ? "" : " Abra o link da sua barbearia (/b/nome-da-barbearia) para agendar."}</p>
        ) : <ul className="space-y-3">{upcoming.map((r) => card(r, true))}</ul>}
        {shops.length > 0 ? (
          <>
            <h2 className="font-display mt-10 mb-3 text-3xl leading-none">Agendar de novo</h2>
            <div className="flex flex-wrap gap-2">
              {shops.map(([slug, name]) => <Link key={slug} href={`/b/${slug}/agendar`} className="rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm font-medium hover:border-night">{name}</Link>)}
            </div>
          </>
        ) : null}
        {past.length > 0 ? (<><h2 className="font-display mt-10 mb-3 text-3xl leading-none">Histórico</h2><ul className="space-y-3">{past.map((r) => card(r, false))}</ul></>) : null}
        <h2 className="font-display mt-10 mb-3 text-3xl leading-none">Meus dados</h2>
        <ProfileForm name={profile?.full_name ?? ""} phone={profile?.phone ?? ""} email={user.email ?? ""} />
      </main>
    </div>
  );
}
