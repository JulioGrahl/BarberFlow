import { daysAgo, daysBetween } from "@/lib/format";

// Linha de admin_shop_insights(): só números agregados, nenhum dado de cliente.
export type ShopInsight = {
  shop_id: string; slug: string; name: string; phone: string | null; created_at: string;
  status: string | null; status_note: string | null; status_changed_at: string | null; due_on: string | null; price_cents: number | null; plan_name: string | null;
  setup_fee_cents: number; setup_paid_cents: number;
  customers_total: number; customers_30d: number; professionals_total: number;
  appointments_30d: number; completed_30d: number; revenue_30d_cents: number; last_appointment_at: string | null; owner_joined: boolean;
};

export type Flag = { key: "vencida" | "inativa" | "sem_dono" | "implantacao"; label: string };

// Sinais de atenção de uma barbearia (só para as que ainda estão no ar).
export function shopFlags(r: ShopInsight): Flag[] {
  if (r.status === "cancelled" || r.status === "suspended") return [];
  const today = daysAgo(0);
  const out: Flag[] = [];
  const late = r.due_on ? daysBetween(r.due_on, today) : 0;
  if (r.status === "overdue" || late > 0) out.push({ key: "vencida", label: late > 0 ? `vencida há ${late} ${late === 1 ? "dia" : "dias"}` : "em atraso" });
  const last = r.last_appointment_at ? daysBetween(r.last_appointment_at.slice(0, 10), today) : null;
  const age = daysBetween(r.created_at.slice(0, 10), today);
  if (r.owner_joined && age > 7 && (last === null || last > 14)) out.push({ key: "inativa", label: last === null ? "nunca usou a agenda" : `sem agendamentos há ${last} dias` });
  if (!r.owner_joined) out.push({ key: "sem_dono", label: "dono ainda não entrou" });
  if (r.setup_fee_cents > r.setup_paid_cents) out.push({ key: "implantacao", label: "implantação a receber" });
  return out;
}
