import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, nowMs, daysAgo, dayMonth, spParts, spStartISO, STATUS_APPT, timeBR, weekdayShort } from "@/lib/format";
import { AreaChart, HBars, Heatmap, Sparkline } from "@/components/charts";
import { Delta, Empty, PageHead, Panel, Stat, pctChange } from "@/components/kit";

export const metadata: Metadata = { title: "Resumo" };

type Appt = {
  id: string; starts_at: string; status: string; price_cents: number;
  customers: { full_name: string } | null; services: { name: string } | null; professionals: { display_name: string } | null;
};
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8);

export default async function ShopPanel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop, role } = await requireShopAccess(slug);
  const owner = role === "owner";
  const supabase = await createClient();
  const today = daysAgo(0);
  const from60 = daysAgo(59);
  const [{ data: apptData }, { data: txData }, commRes] = await Promise.all([
    supabase.from("appointments")
      .select("id, starts_at, status, price_cents, customers(full_name), services(name), professionals(display_name)")
      .eq("barbershop_id", barbershop.id).gte("starts_at", spStartISO(from60)).lt("starts_at", spStartISO(daysAgo(-1)))
      .order("starts_at").limit(3000),
    supabase.from("transactions").select("type, amount_cents, occurred_on").eq("barbershop_id", barbershop.id).eq("type", "income").gte("occurred_on", from60).limit(5000),
    owner ? Promise.resolve({ data: null }) : supabase.from("professional_commissions").select("percent").eq("barbershop_id", barbershop.id).maybeSingle(),
  ]);
  const pct = Number((commRes.data as { percent: number } | null)?.percent ?? 0);
  const appts = ((apptData ?? []) as unknown as Appt[]).map((a) => ({ ...a, ...spParts(a.starts_at) }));
  const tx = (txData ?? []) as { amount_cents: number; occurred_on: string }[];

  const days30 = Array.from({ length: 30 }, (_, i) => daysAgo(29 - i));
  const cut = daysAgo(29);
  const incByDay = new Map<string, number>();
  for (const t of tx) incByDay.set(t.occurred_on, (incByDay.get(t.occurred_on) ?? 0) + t.amount_cents);
  const daily = days30.map((d) => incByDay.get(d) ?? 0);
  const rev30 = daily.reduce((a, b) => a + b, 0);
  const revPrev = tx.filter((t) => t.occurred_on < cut).reduce((a, t) => a + t.amount_cents, 0);

  const cur = appts.filter((a) => a.ymd >= cut);
  const prev = appts.filter((a) => a.ymd < cut);
  const done = (l: typeof appts) => l.filter((a) => a.status === "completed");
  const done30 = done(cur), donePrev = done(prev);
  const ticket = done30.length ? Math.round(done30.reduce((s, a) => s + a.price_cents, 0) / done30.length) : 0;
  const closed = cur.filter((a) => ["completed", "no_show", "cancelled"].includes(a.status));
  const lost = closed.filter((a) => a.status !== "completed").length;
  const lostPct = closed.length ? (lost / closed.length) * 100 : 0;
  const noShows = cur.filter((a) => a.status === "no_show");
  const lostCents = noShows.reduce((a, x) => a + x.price_cents, 0);

  const todayList = appts.filter((a) => a.ymd === today && a.status !== "cancelled");
  const tNow = nowMs();
  const nextId = todayList.find((a) => a.status === "scheduled" && new Date(a.starts_at).getTime() >= tNow - 15 * 60e3)?.id;

  const heat = Array.from({ length: 7 }, () => HOURS.map(() => 0));
  for (const a of appts) if (a.status !== "cancelled" && a.hour >= 8 && a.hour <= 20) heat[a.dow][a.hour - 8]++;
  const heatTotal = heat.flat().reduce((a, b) => a + b, 0);

  const group = (key: (a: Appt) => string) => {
    const m = new Map<string, number>();
    for (const a of done30) m.set(key(a), (m.get(key(a)) ?? 0) + a.price_cents);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([label, value]) => ({ label, value, text: brl(value) }));
  };
  const byService = group((a) => a.services?.name ?? "Serviço");
  const byPro = group((a) => a.professionals?.display_name ?? "Profissional");

  return (
    <>
      <PageHead title={owner ? "Resumo" : "Meu resumo"} sub={owner ? "Últimos 30 dias da barbearia, comparados com os 30 anteriores" : "Últimos 30 dias, só dos seus atendimentos, comparados com os 30 anteriores"}
        actions={<Link href={`/painel/${slug}`} className="inline-flex items-center gap-2 rounded-lg border border-line px-3.5 py-2 text-sm hover:bg-surface"><CalendarDays size={16} aria-hidden /> Ver hoje</Link>} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label={owner ? "Receita em 30 dias" : "Seu faturamento em 30 dias"} value={brl(rev30)} hero>
          <Sparkline values={daily} />
          <div className="mt-2"><Delta pct={pctChange(rev30, revPrev)} /></div>
          {!owner && pct > 0 ? <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-sm">Sua comissão ({String(pct).replace(".", ",")}%): <strong className="font-semibold text-accent">{brl(Math.round((rev30 * pct) / 100))}</strong></p> : null}
        </Stat>
        <Stat label="Atendimentos concluídos" value={String(done30.length)}><Delta pct={pctChange(done30.length, donePrev.length)} /></Stat>
        <Stat label="Ticket médio" value={brl(ticket)}><span className="text-xs text-muted">por atendimento concluído</span></Stat>
        <Stat label="Perdido com faltas" value={brl(lostCents)}><span className="text-xs text-muted">{noShows.length} {noShows.length === 1 ? "falta" : "faltas"} · {lostPct.toFixed(0)}% dos encerrados</span></Stat>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Panel title="Hoje" sub="Do primeiro ao último horário" className="lg:col-span-2">
          {todayList.length === 0 ? <Empty>Sem horários hoje. Compartilhe o link da página pública para receber agendamentos.</Empty> : (
            <ol className="relative space-y-1 before:absolute before:bottom-2 before:left-[3.35rem] before:top-2 before:w-px before:bg-line">
              {todayList.map((a) => (
                <li key={a.id} className={`relative flex items-start gap-3 rounded-lg px-1 py-2 ${a.id === nextId ? "bg-surface-2" : ""}`}>
                  <span className="w-11 shrink-0 text-right text-sm tabular-nums text-muted">{timeBR(a.starts_at)}</span>
                  <span className={`relative z-10 mt-1.5 size-2.5 shrink-0 rounded-full ring-4 ring-surface ${a.status === "completed" ? "bg-success" : a.status === "no_show" ? "bg-danger" : a.id === nextId ? "bg-accent" : "bg-line"}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{a.customers?.full_name ?? "Cliente"}</span>
                    <span className="block truncate text-xs text-muted">{a.services?.name}{owner ? ` · ${a.professionals?.display_name}` : ""}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{a.id === nextId ? "próximo" : STATUS_APPT[a.status] ?? a.status}</span>
                </li>
              ))}
            </ol>
          )}
        </Panel>
        <Panel title="Receita por dia" sub={`${dayMonth(days30[0])} a ${dayMonth(days30[29])}`} className="lg:col-span-3">
          {rev30 === 0 ? <Empty>A receita aparece aqui quando os atendimentos forem concluídos na agenda.</Empty> :
            <AreaChart labels={days30.map((d) => `${weekdayShort(d)} ${dayMonth(d)}`)} series={[{ name: "Receita", color: "var(--c1)", values: daily.map((v) => v / 100) }]} tickEvery={6} />}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Quando o movimento é maior" sub="Agendamentos por dia da semana e hora, últimos 60 dias">
          {heatTotal === 0 ? <Empty>Ainda sem agendamentos para mostrar o padrão da semana.</Empty> : <Heatmap rows={heat} hours={HOURS} rowLabels={["dom", "seg", "ter", "qua", "qui", "sex", "sáb"]} unit="agendamentos" />}
        </Panel>
        <div className="grid gap-4">
          <Panel title="Serviços que mais faturam" sub="Últimos 30 dias">
            {byService.length === 0 ? <Empty>Sem atendimentos concluídos no período.</Empty> : <HBars items={byService} />}
          </Panel>
          {owner ? (
            <Panel title="Faturamento por profissional" sub="Últimos 30 dias">
              {byPro.length === 0 ? <Empty>Sem atendimentos concluídos no período.</Empty> : <HBars items={byPro} color="var(--c2)" />}
            </Panel>
          ) : null}
        </div>
      </div>
    </>
  );
}
