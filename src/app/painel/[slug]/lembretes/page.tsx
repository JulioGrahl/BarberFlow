import type { Metadata } from "next";
import { markNotificationSent } from "@/app/actions/shop";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fullDateTimeBR, nextDays, nowISO } from "@/lib/format";
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
      <h1 className="text-2xl font-semibold">Lembretes</h1>
      <p className="mt-1 text-sm text-muted">Atendimentos de hoje e amanhã. O botão abre o WhatsApp com a mensagem pronta; você envia e depois marca como enviado. Nada é enviado automaticamente.</p>
      {sp.erro ? <p role="alert" className="mt-4 rounded-xl border border-danger/40 px-3.5 py-2.5 text-sm text-danger">Não foi possível registrar o envio.</p> : null}
      <ul className="mt-6 space-y-3">
        {rows.length === 0 ? <li className="rounded-2xl border border-line bg-surface p-4 text-sm text-muted">Nenhum atendimento agendado para hoje ou amanhã.</li> : rows.map((r) => {
          const info = { customer: r.customers?.full_name ?? "", shop: barbershop.name, service: r.services?.name ?? "", pro: r.professionals?.display_name ?? "", when: fullDateTimeBR(r.starts_at) };
          return (
            <li key={r.id} className="rounded-2xl border border-line bg-surface p-4 text-sm">
              <p className="text-base font-medium">{r.customers?.full_name} · {r.services?.name}</p>
              <p className="text-muted">{fullDateTimeBR(r.starts_at)} · com {r.professionals?.display_name} · {r.customers?.phone ?? "sem telefone"}</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {KINDS.map(([kind, label]) => {
                  const text = buildMessage(kind, info);
                  const link = waLink(r.customers?.phone, text);
                  const isDone = done.has(`${r.id}:${kind}`);
                  return (
                    <div key={kind} className="flex items-center gap-2 rounded-xl border border-line p-2">
                      <span className="px-1 text-muted">{label}</span>
                      {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-accent px-3 py-1.5 font-semibold text-accent-ink hover:brightness-110">WhatsApp</a> : <span className="text-xs text-warn">telefone inválido</span>}
                      {isDone ? <span className="text-xs text-success">enviado</span> : link ? (
                        <form action={markNotificationSent}>
                          <input type="hidden" name="slug" value={slug} />
                          <input type="hidden" name="appointment" value={r.id} />
                          <input type="hidden" name="kind" value={kind} />
                          <input type="hidden" name="message" value={text} />
                          <button className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2">Marcar enviado</button>
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
    </>
  );
}
