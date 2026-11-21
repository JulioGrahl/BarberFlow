import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  changePlan, openSupport, registerPayment, reissueOwnerInvitation, setSubscriptionStatus, updateBarbershop,
} from "@/app/actions/master";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { createClient } from "@/lib/supabase/server";
import { brl, daysAgo, dateBR, dateTimeBR, STATUS_LABEL, STATUS_TONE } from "@/lib/format";

export const metadata: Metadata = { title: "Barbearia · Master" };

type Sub = { status: string; due_on: string; started_on: string; price_cents: number; plan_id: string | null };

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <h2 className="font-display mb-4 text-lg">{title}</h2>
      {children}
    </section>
  );
}

export default async function ShopDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase
    .from("barbershops")
    .select("id, slug, name, phone, subscriptions(status, due_on, started_on, price_cents, plan_id)")
    .eq("slug", slug)
    .maybeSingle();
  if (!shop) notFound();
  const sub = (Array.isArray(shop.subscriptions) ? shop.subscriptions[0] : shop.subscriptions) as Sub | null;

  const [{ data: plans }, { data: payments }, { data: sessions }, { data: logs }] = await Promise.all([
    supabase.from("plans").select("id, name, price_cents, active").order("price_cents"),
    supabase.from("payments").select("id, amount_cents, paid_on, reference_month, note").eq("barbershop_id", shop.id).order("paid_on", { ascending: false }).limit(12),
    supabase.from("support_sessions").select("id, reason, started_at, expires_at, ended_at").eq("barbershop_id", shop.id).order("started_at", { ascending: false }).limit(5),
    supabase.from("audit_logs").select("id, action, created_at").eq("barbershop_id", shop.id).order("id", { ascending: false }).limit(10),
  ]);
  const today = daysAgo(0);
  const thisMonth = today.slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/master/barbearias" className="text-sm text-muted hover:text-ink">← Barbearias</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-3xl sm:text-4xl">{shop.name}</h1>
          {sub ? <span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[sub.status]}`}>{STATUS_LABEL[sub.status]}</span> : null}
        </div>
        <p className="text-sm text-muted">Página pública: /b/{shop.slug}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Assinatura">
          {sub ? (
            <>
              <p className="text-sm text-muted">Valor {brl(sub.price_cents)} · vence em {dateBR(sub.due_on)} · desde {dateBR(sub.started_on)}</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {(["active", "pending", "overdue", "suspended", "cancelled"] as const)
                  .filter((s) => s !== sub.status)
                  .map((s) => (
                    <ActionForm key={s} action={setSubscriptionStatus} submit={s === "suspended" ? "Suspender" : s === "active" ? "Ativar / reativar" : `Marcar ${STATUS_LABEL[s].toLowerCase()}`} className="min-w-40 space-y-2">
                      <input type="hidden" name="id" value={shop.id} />
                      <input type="hidden" name="status" value={s} />
                    </ActionForm>
                  ))}
              </div>
              <p className="mt-3 text-xs text-muted">Suspensa ou cancelada: a barbearia some da listagem pública, deixa de oferecer horários e perde o acesso ao painel.</p>
              <h3 className="mt-6 text-sm font-semibold">Trocar plano / vencimento</h3>
              <ActionForm action={changePlan} submit="Atualizar" className="mt-3 space-y-3">
                <input type="hidden" name="id" value={shop.id} />
                <L label="Plano">
                  <select name="planId" defaultValue={sub.plan_id ?? ""} required className={inputCls}>
                    {(plans ?? []).filter((p) => p.active || p.id === sub.plan_id).map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price_cents)}</option>)}
                  </select>
                </L>
                <L label="Vencimento"><input name="dueOn" type="date" defaultValue={sub.due_on} required className={inputCls} /></L>
              </ActionForm>
            </>
          ) : <p className="text-sm text-muted">Sem assinatura.</p>}
        </Card>

        <Card title="Registrar pagamento">
          <ActionForm action={registerPayment} submit="Registrar" className="space-y-3">
            <input type="hidden" name="id" value={shop.id} />
            <div className="grid grid-cols-2 gap-3">
              <L label="Valor (R$)"><input name="amount" inputMode="decimal" required defaultValue={sub ? (sub.price_cents / 100).toFixed(2).replace(".", ",") : ""} className={inputCls} /></L>
              <L label="Pago em"><input name="paidOn" type="date" required defaultValue={today} className={inputCls} /></L>
            </div>
            <L label="Mês de referência"><input name="month" type="month" required defaultValue={thisMonth} className={inputCls} /></L>
            <L label="Observação (opcional)"><input name="note" className={inputCls} placeholder="Pix, dinheiro..." /></L>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">Histórico</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {(payments ?? []).length === 0 ? <li className="py-2 text-muted">Nenhum pagamento registrado.</li> : (payments ?? []).map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span>{brl(p.amount_cents)} <span className="text-muted">· ref. {p.reference_month.slice(5, 7)}/{p.reference_month.slice(0, 4)}{p.note ? ` · ${p.note}` : ""}</span></span>
                <span className="text-muted">{dateBR(p.paid_on)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Dados">
          <ActionForm action={updateBarbershop} submit="Salvar dados" className="space-y-3">
            <input type="hidden" name="id" value={shop.id} />
            <L label="Nome"><input name="name" defaultValue={shop.name} required className={inputCls} /></L>
            <L label="Slug"><input name="slug" defaultValue={shop.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} /></L>
            <L label="Telefone"><input name="phone" defaultValue={shop.phone ?? ""} className={inputCls} /></L>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">Convite do proprietário</h3>
          <p className="text-xs text-muted">Gera um novo link (revoga os anteriores não aceitos).</p>
          <ActionForm action={reissueOwnerInvitation} submit="Gerar novo convite" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={shop.id} />
            <L label="Nome"><input name="name" className={inputCls} /></L>
            <L label="E-mail do proprietário"><input name="email" type="email" required className={inputCls} /></L>
          </ActionForm>
        </Card>

        <Card title="Acesso de suporte">
          <p className="text-sm text-muted">Sem uma sessão aberta, o Master não enxerga agenda, clientes nem financeiro da barbearia. Cada abertura fica registrada com o motivo.</p>
          <ActionForm action={openSupport} submit="Abrir acesso por 2 horas" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={shop.id} />
            <L label="Motivo"><input name="reason" required minLength={5} className={inputCls} placeholder="Ex.: cliente reportou erro na agenda" /></L>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">Últimas sessões</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {(sessions ?? []).length === 0 ? <li className="py-2 text-muted">Nenhuma.</li> : (sessions ?? []).map((s) => (
              <li key={s.id} className="py-2">
                <p>{s.reason}</p>
                <p className="text-xs text-muted">{dateTimeBR(s.started_at)} · {s.ended_at ? `encerrada ${dateTimeBR(s.ended_at)}` : new Date(s.expires_at) > new Date() ? "aberta" : "expirada"}</p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card title="Auditoria recente">
        <ul className="divide-y divide-line text-sm">
          {(logs ?? []).length === 0 ? <li className="py-2 text-muted">Sem registros.</li> : (logs ?? []).map((l) => (
            <li key={l.id} className="flex justify-between py-2"><code className="text-muted">{l.action}</code><span className="text-muted">{dateTimeBR(l.created_at)}</span></li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
