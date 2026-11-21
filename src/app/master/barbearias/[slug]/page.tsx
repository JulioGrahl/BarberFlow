import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import {
  changePlan, deleteBarbershop, openSupport, registerPayment, reissueOwnerInvitation, setSetupFee, setSubscriptionStatus, updateBarbershop,
} from "@/app/actions/master";
import { ActionForm, inputCls, L } from "@/components/master-forms";
import { createClient } from "@/lib/supabase/server";
import { brl, daysAgo, dateBR, dateTimeBR, relDay, STATUS_LABEL, STATUS_TONE } from "@/lib/format";
import { shopFlags, type ShopInsight } from "@/lib/insights";

export const metadata: Metadata = { title: "Barbearia · Master" };

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-line bg-surface p-5 ${className}`}>
      <h2 className="font-display text-2xl leading-tight">{title}</h2>
      {sub ? <p className="mt-1 text-xs text-muted">{sub}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

// Ação delicada: fica dobrada até a pessoa abrir, para não clicar sem querer.
function Fold({ title, tone = "ink", children }: { title: string; tone?: "ink" | "danger"; children: React.ReactNode }) {
  return (
    <details className={`group rounded-xl border bg-surface ${tone === "danger" ? "border-danger/40" : "border-line-strong"}`}>
      <summary className={`cursor-pointer list-none rounded-xl px-4 py-3 text-sm font-semibold marker:hidden ${tone === "danger" ? "text-danger" : ""}`}>{title}</summary>
      <div className="space-y-3 border-t border-line px-4 py-4">{children}</div>
    </details>
  );
}

function Mini({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display mt-1 text-3xl leading-none">{value}</p>
      {hint ? <p className="mt-1.5 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export default async function ShopDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: insights } = await supabase.rpc("admin_shop_insights");
  const shop = ((insights ?? []) as ShopInsight[]).find((r) => r.slug === slug);
  if (!shop) notFound();
  const { data: subRow } = await supabase.from("subscriptions").select("plan_id").eq("barbershop_id", shop.shop_id).maybeSingle();

  const [{ data: plans }, { data: payments }, { data: sessions }, { data: logs }] = await Promise.all([
    supabase.from("plans").select("id, name, price_cents, active").order("price_cents"),
    supabase.from("payments").select("id, amount_cents, paid_on, reference_month, note, kind").eq("barbershop_id", shop.shop_id).order("paid_on", { ascending: false }).limit(20),
    supabase.from("support_sessions").select("id, reason, started_at, expires_at, ended_at").eq("barbershop_id", shop.shop_id).order("started_at", { ascending: false }).limit(5),
    supabase.from("audit_logs").select("id, action, created_at").eq("barbershop_id", shop.shop_id).order("id", { ascending: false }).limit(10),
  ]);
  const today = daysAgo(0);
  const thisMonth = today.slice(0, 7);
  const status = shop.status ?? "active";
  const blocked = status === "suspended" || status === "cancelled";
  const flags = shopFlags(shop);
  const setupPending = Math.max(0, shop.setup_fee_cents - shop.setup_paid_cents);
  const setupPays = (payments ?? []).filter((p) => p.kind === "setup");
  const monthlyPays = (payments ?? []).filter((p) => p.kind !== "setup");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/master/barbearias" className="text-sm text-muted hover:text-ink">← Barbearias</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl sm:text-5xl">{shop.name}</h1>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${STATUS_TONE[status]}`}>{STATUS_LABEL[status]}</span>
        </div>
        <p className="mt-1 text-sm text-muted">Página pública: /b/{shop.slug}{shop.phone ? ` · ${shop.phone}` : ""}</p>
        {flags.length ? <p className="mt-2 flex flex-wrap gap-1.5">{flags.map((f) => <span key={f.key} className="rounded-full bg-warn-bg px-2.5 py-0.5 text-xs text-warn">{f.label}</span>)}</p> : null}
      </div>

      {blocked ? (
        <div role="status" className="flex flex-wrap items-start gap-3 rounded-2xl border border-danger/30 bg-danger-bg p-4 text-danger">
          <ShieldAlert size={22} aria-hidden className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{status === "cancelled" ? "Contrato encerrado" : "Acesso bloqueado"}{shop.status_changed_at ? ` em ${dateBR(shop.status_changed_at)}` : ""}</p>
            <p className="text-sm">{shop.status_note ? `Motivo: ${shop.status_note}. ` : ""}O proprietário e os barbeiros veem um aviso e não acessam nada; a página pública e os agendamentos estão fora do ar. Os dados continuam guardados.</p>
          </div>
        </div>
      ) : null}

      <section aria-label="Uso da barbearia" className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Mini label="Clientes" value={String(shop.customers_total)} hint={shop.customers_30d > 0 ? `+${shop.customers_30d} em 30 dias` : "nenhum novo em 30 dias"} />
        <Mini label="Profissionais ativos" value={String(shop.professionals_total)} />
        <Mini label="Agendamentos (30 dias)" value={String(shop.appointments_30d)} hint={`${shop.completed_30d} concluídos`} />
        <Mini label="Movimento (30 dias)" value={brl(shop.revenue_30d_cents)} hint="atendimentos concluídos" />
        <Mini label="Último agendamento" value={shop.last_appointment_at ? relDay(shop.last_appointment_at) : "nunca"} />
        <Mini label="Proprietário" value={shop.owner_joined ? "entrou" : "pendente"} hint={shop.owner_joined ? "já usa o painel" : "convite ainda não aceito"} />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Controle de acesso" sub="Bloquear corta tudo na hora: painel da equipe, página pública e novos agendamentos. Nada é apagado.">
          <div className="space-y-3">
            {status === "suspended" || status === "cancelled" ? (
              <ActionForm action={setSubscriptionStatus} submit={status === "cancelled" ? "Reativar contrato" : "Reativar acesso"} tone="ink" className="space-y-2">
                <input type="hidden" name="id" value={shop.shop_id} /><input type="hidden" name="status" value="active" />
              </ActionForm>
            ) : (
              <Fold title="Bloquear acesso (ex.: mensalidade em atraso)" tone="danger">
                <p className="text-sm text-muted">A barbearia perde o acesso até você reativar. O motivo fica registrado e aparece no aviso para o proprietário.</p>
                <ActionForm action={setSubscriptionStatus} submit="Bloquear agora" tone="danger" className="space-y-3">
                  <input type="hidden" name="id" value={shop.shop_id} /><input type="hidden" name="status" value="suspended" />
                  <L label="Motivo"><input name="note" required minLength={3} maxLength={300} className={inputCls} placeholder="Ex.: mensalidade de novembro em atraso" /></L>
                </ActionForm>
              </Fold>
            )}
            {status !== "cancelled" ? (
              <Fold title="Encerrar contrato (a barbearia não quer mais o serviço)" tone="danger">
                <p className="text-sm text-muted">Bloqueia todo o acesso e tira a barbearia da lista principal (ela passa para a aba &quot;Encerradas&quot;). Os dados ficam guardados e você pode reativar depois ou excluir de vez.</p>
                <ActionForm action={setSubscriptionStatus} submit="Encerrar contrato" tone="danger" className="space-y-3">
                  <input type="hidden" name="id" value={shop.shop_id} /><input type="hidden" name="status" value="cancelled" />
                  <L label="Motivo (opcional)"><input name="note" maxLength={300} className={inputCls} placeholder="Ex.: o dono pediu o cancelamento" /></L>
                </ActionForm>
              </Fold>
            ) : (
              <Fold title="Excluir definitivamente" tone="danger">
                <p className="text-sm text-danger">Não dá para desfazer. Apaga agenda, clientes, serviços, equipe e financeiro desta barbearia. As contas de login das pessoas continuam existindo.</p>
                <ActionForm action={deleteBarbershop} submit="Excluir para sempre" tone="danger" className="space-y-3">
                  <input type="hidden" name="id" value={shop.shop_id} />
                  <L label={`Digite ${shop.slug} para confirmar`}><input name="confirm" required autoComplete="off" className={inputCls} placeholder={shop.slug} /></L>
                </ActionForm>
              </Fold>
            )}
            {status === "active" || status === "pending" || status === "overdue" ? (
              <Fold title="Marcar situação da cobrança (não bloqueia)">
                <div className="flex flex-wrap gap-2">
                  {(["active", "pending", "overdue"] as const).filter((s) => s !== status).map((s) => (
                    <ActionForm key={s} action={setSubscriptionStatus} submit={s === "active" ? "Marcar como ativa" : `Marcar ${STATUS_LABEL[s].toLowerCase()}`} tone="ink" className="min-w-40 space-y-2">
                      <input type="hidden" name="id" value={shop.shop_id} /><input type="hidden" name="status" value={s} />
                    </ActionForm>
                  ))}
                </div>
              </Fold>
            ) : null}
          </div>
        </Card>

        <Card title="Implantação" sub="Valor cobrado uma vez, na entrada da barbearia. Fica separado da mensalidade e não mexe no vencimento.">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">Combinado</p><p className="font-display text-2xl leading-tight">{brl(shop.setup_fee_cents)}</p></div>
            <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">Recebido</p><p className="font-display text-2xl leading-tight text-success">{brl(shop.setup_paid_cents)}</p></div>
            <div className="rounded-xl bg-surface-2 p-3"><p className="text-xs text-muted">A receber</p><p className={`font-display text-2xl leading-tight ${setupPending > 0 ? "text-warn" : ""}`}>{brl(setupPending)}</p></div>
          </div>
          <h3 className="mt-5 text-sm font-semibold">Registrar recebimento da implantação</h3>
          <ActionForm action={registerPayment} submit="Registrar implantação" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={shop.shop_id} /><input type="hidden" name="kind" value="setup" /><input type="hidden" name="month" value={thisMonth} />
            <div className="grid grid-cols-2 gap-3">
              <L label="Valor (R$)"><input name="amount" inputMode="decimal" required defaultValue={setupPending > 0 ? (setupPending / 100).toFixed(2).replace(".", ",") : ""} className={inputCls} /></L>
              <L label="Recebido em"><input name="paidOn" type="date" required defaultValue={today} className={inputCls} /></L>
            </div>
            <L label="Observação (opcional)"><input name="note" className={inputCls} placeholder="Pix, entrada, parcela 1 de 2..." /></L>
          </ActionForm>
          <Fold title="Alterar o valor combinado">
            <ActionForm action={setSetupFee} submit="Salvar valor" tone="ink" className="space-y-3">
              <input type="hidden" name="id" value={shop.shop_id} />
              <L label="Valor combinado (R$)"><input name="amount" inputMode="decimal" required defaultValue={(shop.setup_fee_cents / 100).toFixed(2).replace(".", ",")} className={inputCls} /></L>
            </ActionForm>
          </Fold>
          {setupPays.length ? (
            <ul className="mt-4 divide-y divide-line text-sm">
              {setupPays.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2"><span>{brl(p.amount_cents)}{p.note ? <span className="text-muted"> · {p.note}</span> : null}</span><span className="text-muted">{dateBR(p.paid_on)}</span></li>
              ))}
            </ul>
          ) : null}
        </Card>

        <Card title="Mensalidade">
          <p className="text-sm text-muted">{shop.price_cents != null ? `${brl(shop.price_cents)} por mês · vence em ${dateBR(shop.due_on)} · plano ${shop.plan_name ?? "—"}` : "Sem assinatura."}</p>
          <h3 className="mt-5 text-sm font-semibold">Registrar mensalidade recebida</h3>
          <p className="text-xs text-muted">Ativa a assinatura e empurra o vencimento em 1 mês.</p>
          <ActionForm action={registerPayment} submit="Registrar mensalidade" className="mt-3 space-y-3">
            <input type="hidden" name="id" value={shop.shop_id} /><input type="hidden" name="kind" value="monthly" />
            <div className="grid grid-cols-2 gap-3">
              <L label="Valor (R$)"><input name="amount" inputMode="decimal" required defaultValue={shop.price_cents != null ? (shop.price_cents / 100).toFixed(2).replace(".", ",") : ""} className={inputCls} /></L>
              <L label="Pago em"><input name="paidOn" type="date" required defaultValue={today} className={inputCls} /></L>
            </div>
            <L label="Mês de referência"><input name="month" type="month" required defaultValue={thisMonth} className={inputCls} /></L>
            <L label="Observação (opcional)"><input name="note" className={inputCls} placeholder="Pix, dinheiro..." /></L>
          </ActionForm>
          <Fold title="Trocar plano ou vencimento">
            <ActionForm action={changePlan} submit="Atualizar" tone="ink" className="space-y-3">
              <input type="hidden" name="id" value={shop.shop_id} />
              <L label="Plano">
                <select name="planId" defaultValue={subRow?.plan_id ?? ""} required className={inputCls}>
                  {(plans ?? []).filter((p) => p.active || p.id === subRow?.plan_id).map((p) => <option key={p.id} value={p.id}>{p.name} — {brl(p.price_cents)}</option>)}
                </select>
              </L>
              <L label="Vencimento"><input name="dueOn" type="date" defaultValue={shop.due_on ?? ""} required className={inputCls} /></L>
            </ActionForm>
          </Fold>
          <h3 className="mt-5 text-sm font-semibold">Mensalidades recebidas</h3>
          <ul className="mt-2 divide-y divide-line text-sm">
            {monthlyPays.length === 0 ? <li className="py-2 text-muted">Nenhuma registrada.</li> : monthlyPays.map((p) => (
              <li key={p.id} className="flex justify-between gap-3 py-2">
                <span>{brl(p.amount_cents)} <span className="text-muted">· ref. {p.reference_month.slice(5, 7)}/{p.reference_month.slice(0, 4)}{p.note ? ` · ${p.note}` : ""}</span></span>
                <span className="text-muted">{dateBR(p.paid_on)}</span>
              </li>
            ))}
          </ul>
        </Card>

        <div className="space-y-6">
          <Card title="Dados">
            <ActionForm action={updateBarbershop} submit="Salvar dados" className="space-y-3">
              <input type="hidden" name="id" value={shop.shop_id} />
              <L label="Nome"><input name="name" defaultValue={shop.name} required className={inputCls} /></L>
              <L label="Endereço (slug)"><input name="slug" defaultValue={shop.slug} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputCls} /></L>
              <L label="Telefone"><input name="phone" defaultValue={shop.phone ?? ""} className={inputCls} /></L>
            </ActionForm>
            <Fold title="Convite do proprietário">
              <p className="text-xs text-muted">Gera um novo link (revoga os anteriores não aceitos).</p>
              <ActionForm action={reissueOwnerInvitation} submit="Gerar novo convite" tone="ink" className="space-y-3">
                <input type="hidden" name="id" value={shop.shop_id} />
                <L label="Nome"><input name="name" className={inputCls} /></L>
                <L label="E-mail do proprietário"><input name="email" type="email" required className={inputCls} /></L>
              </ActionForm>
            </Fold>
          </Card>

          <Card title="Acesso de suporte" sub="Sem uma sessão aberta, o Master não enxerga agenda, clientes nem financeiro da barbearia. Cada abertura fica registrada com o motivo.">
            <ActionForm action={openSupport} submit="Abrir acesso por 2 horas" tone="ink" className="space-y-3">
              <input type="hidden" name="id" value={shop.shop_id} />
              <L label="Motivo"><input name="reason" required minLength={5} className={inputCls} placeholder="Ex.: cliente reportou erro na agenda" /></L>
            </ActionForm>
            <ul className="mt-4 divide-y divide-line text-sm">
              {(sessions ?? []).length === 0 ? <li className="py-2 text-muted">Nenhuma sessão ainda.</li> : (sessions ?? []).map((s) => (
                <li key={s.id} className="py-2">
                  <p>{s.reason}</p>
                  <p className="text-xs text-muted">{dateTimeBR(s.started_at)} · {s.ended_at ? `encerrada ${dateTimeBR(s.ended_at)}` : new Date(s.expires_at) > new Date() ? "aberta" : "expirada"}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
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
