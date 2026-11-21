import type { Metadata } from "next";
import { markNotificationSent } from "@/app/actions/shop";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fullDateTimeBR, nextDays, nowISO } from "@/lib/format";
import { Empty, PageHead, WhatsAppLink } from "@/components/kit";
import { buildMessage, waLink, type MsgKind } from "@/lib/whatsapp";

export const metadata: Metadata = { title: "Lembretes" };

type Row = {
  id: string; starts_at: string;
  customers: { full_name: string; phone: string | null } | null;
  services: { name: string } | null;
  professionals: { display_name: string } | null;
};
const KINDS: [MsgKind, string][] = [["confirmation", "Confirmação"], ["reminder", "Lembrete"]];

export default async function RemindersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ erro?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const { barbershop } = await requireShopAccess(slug, ["owner"]);
  const [today, , dayAfter] = nextDays(3);
  const from = new Date(`${today}T00:00:00-03:00`).toISOString();
  const to = new Date(`${dayAfter}T00:00:00-03:00`).toISOString(); // hoje e amanhã
  const supabase = await createClient();
  const { data } = await supabase
    .from("appointments")
    .select("id, starts_at, customers(full_name, phone), services(name), professionals(display_name)")
    .eq("barbershop_id", barbershop.id).eq("status", "scheduled")
    .gte("starts_at", (nowISO() > from ? nowISO() : from)).lt("starts_at", to).order("starts_at");
  const rows = (data ?? []) as unknown as Row[];
  const { data: sent } = await supabase.from("notifications").select("appointment_id, kind").eq("barbershop_id", barbershop.id).eq("status", "sent").in("appointment_id", rows.map((r) => r.id));
  const done = new Set((sent ?? []).map((n) => `${n.appointment_id}:${n.kind}`));

  return (
    <>
      <PageHead title="Lembretes" sub="Hoje e amanhã. O botão abre o WhatsApp com a mensagem pronta; você envia e marca como enviado. Nada é enviado automaticamente." />
      {sp.erro ? <p role="alert" className="mb-4 rounded-lg border border-danger/30 bg-danger-bg px-3.5 py-2.5 text-sm text-danger">Não foi possível registrar o envio.</p> : null}
      {rows.length === 0 ? <Empty>Nenhum atendimento agendado para hoje ou amanhã.</Empty> : (
        <ul className="space-y-3">
          {rows.map((r) => {
            const info = { customer: r.customers?.full_name ?? "", shop: barbershop.name, service: r.services?.name ?? "", pro: r.professionals?.display_name ?? "", when: fullDateTimeBR(r.starts_at) };
            return (
              <li key={r.id} className="grid gap-x-6 gap-y-3 rounded-xl border border-line bg-surface p-4 text-sm lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
                <div className="min-w-0">
                  <p className="font-display text-2xl leading-tight">{r.customers?.full_name}</p>
                  <p>{r.services?.name} · {r.professionals?.display_name}</p>
                  <p className="text-muted">{fullDateTimeBR(r.starts_at)}</p>
                  <p className="tabular-nums text-muted">{r.customers?.phone ?? "sem telefone"}</p>
                </div>
                <div className="divide-y divide-line border-t border-line lg:border-l lg:border-t-0 lg:pl-6">
                  {KINDS.map(([kind, label]) => {
                    const text = buildMessage(kind, info);
                    const link = waLink(r.customers?.phone, text);
                    const isDone = done.has(`${r.id}:${kind}`);
                    return (
                      <div key={kind} className="flex flex-wrap items-center gap-2 py-2 first:pt-3 last:pb-0 lg:first:pt-0">
                        <span className="min-w-28 flex-1 font-medium">{label}</span>
                        {link ? <WhatsAppLink href={link} className="min-h-9" /> : <span className="text-xs text-warn">telefone inválido</span>}
                        {isDone ? <span className="inline-flex min-h-9 items-center gap-1 px-2 text-xs font-medium text-success">Enviado</span> : link ? (
                          <form action={markNotificationSent}>
                            <input type="hidden" name="slug" value={slug} /><input type="hidden" name="appointment" value={r.id} /><input type="hidden" name="kind" value={kind} /><input type="hidden" name="message" value={text} />
                            <button className="min-h-9 rounded-lg border border-line px-3 hover:bg-surface-2">Marcar enviado</button>
                          </form>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
