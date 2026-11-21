"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { MasterState } from "@/app/actions/master";

// Ações do painel da barbearia. O dono é validado no servidor e a RLS garante o isolamento por barbearia.
type State = MasterState;
const s = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const toCents = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);

async function owner(fd: FormData) {
  const slug = s(fd, "slug");
  return (await requireShopAccess(slug, ["owner"])).barbershop;
}

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  return `${host.startsWith("localhost") ? "http" : "https"}://${host}`;
}

const MSG_FAIL = "Não foi possível salvar. Verifique os dados e tente novamente.";
const fail = (): State => ({ error: MSG_FAIL });

export async function saveService(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const name = s(fd, "name");
  const price = toCents(s(fd, "price") || "0");
  const minutes = Number.parseInt(s(fd, "minutes"), 10);
  if (name.length < 2 || !Number.isFinite(price) || price < 0 || !Number.isInteger(minutes) || minutes < 5 || minutes > 480)
    return { error: "Informe nome, preço (≥ 0) e duração entre 5 e 480 minutos." };
  const row = { name, description: s(fd, "description") || null, price_cents: price, duration_minutes: minutes, active: fd.get("active") === "on" };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("services").update(row).eq("id", id).eq("barbershop_id", shop.id)
    : await supabase.from("services").insert({ ...row, barbershop_id: shop.id });
  if (error) return fail();
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: id ? "Serviço atualizado." : "Serviço criado." };
}

export async function saveProfessional(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const name = s(fd, "name");
  const percent = Number(s(fd, "percent").replace(",", ".") || "0");
  if (name.length < 2 || !Number.isFinite(percent) || percent < 0 || percent > 100)
    return { error: "Informe o nome e uma comissão entre 0 e 100%." };
  const serviceIds = fd.getAll("services").filter((v): v is string => typeof v === "string" && z.uuid().safeParse(v).success);
  const supabase = await createClient();
  let id = s(fd, "id");
  if (id) {
    const { error } = await supabase.from("professionals").update({ display_name: name, active: fd.get("active") === "on" }).eq("id", id).eq("barbershop_id", shop.id);
    if (error) return fail();
  } else {
    const { data, error } = await supabase.from("professionals").insert({ barbershop_id: shop.id, display_name: name, active: true }).select("id").single();
    if (error || !data) return fail();
    id = data.id;
  }
  const c = await supabase.from("professional_commissions").upsert({ professional_id: id, barbershop_id: shop.id, percent });
  if (c.error) return fail();
  const del = await supabase.from("professional_services").delete().eq("professional_id", id).eq("barbershop_id", shop.id);
  if (del.error) return fail();
  if (serviceIds.length > 0) {
    const ins = await supabase.from("professional_services").insert(serviceIds.map((service_id) => ({ professional_id: id, service_id, barbershop_id: shop.id })));
    if (ins.error) return fail();
  }
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: "Profissional salvo." };
}

export async function inviteBarber(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const professional = z.uuid().safeParse(s(fd, "professional"));
  const emailRaw = s(fd, "email");
  const email = emailRaw ? z.email().safeParse(emailRaw.toLowerCase()) : null;
  if (!professional.success || (email && !email.success)) return { error: "Informe um e-mail válido (ou deixe em branco)." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invitation", {
    p_shop: shop.id, p_email: email?.success ? email.data : null, p_professional: professional.data,
  });
  if (error) return { error: error.message.includes("invalid_professional") ? "Este profissional já tem conta vinculada." : MSG_FAIL };
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: "Convite criado (vale 7 dias).", inviteUrl: `${await origin()}/convite/${data as string}` };
}

export async function revokeInvite(fd: FormData): Promise<void> {
  const shop = await owner(fd);
  const id = z.uuid().safeParse(s(fd, "id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("revoke_invitation", { p_id: id.data });
  revalidatePath(`/painel/${shop.slug}`, "layout");
}

// Horários: professional vazio = horário de funcionamento da barbearia.
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
export async function saveHours(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const proRaw = s(fd, "pro");
  const pro = proRaw ? z.uuid().safeParse(proRaw) : null;
  if (pro && !pro.success) return { error: "Profissional inválido." };
  const proId = pro?.success ? pro.data : null;
  const rows: { barbershop_id: string; professional_id: string | null; weekday: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null }[] = [];
  for (let d = 0; d < 7; d++) {
    if (fd.get(`on_${d}`) !== "on") continue;
    const [a, b, bs, be] = [s(fd, `start_${d}`), s(fd, `end_${d}`), s(fd, `bs_${d}`), s(fd, `be_${d}`)];
    if (!TIME.test(a) || !TIME.test(b) || a >= b) return { error: "Em cada dia aberto, informe abertura e fechamento válidos (fechamento depois da abertura)." };
    if ((bs && !be) || (!bs && be)) return { error: "Informe início e fim do intervalo, ou deixe os dois vazios." };
    if (bs && (!TIME.test(bs) || !TIME.test(be) || bs >= be || bs < a || be > b)) return { error: "O intervalo precisa estar dentro do horário de funcionamento." };
    rows.push({ barbershop_id: shop.id, professional_id: proId, weekday: d, start_time: a, end_time: b, break_start: bs || null, break_end: be || null });
  }
  const supabase = await createClient();
  const del = supabase.from("schedules").delete().eq("barbershop_id", shop.id);
  const { error: e1 } = await (proId ? del.eq("professional_id", proId) : del.is("professional_id", null));
  if (e1) return fail();
  if (rows.length > 0) {
    const { error: e2 } = await supabase.from("schedules").insert(rows);
    if (e2) return fail();
  }
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: "Horários salvos." };
}

// Agenda: dono conclui/marca falta/cancela; barbeiro só conclui ou marca falta dos próprios (trigger + RLS garantem).
export async function setAppointmentStatus(fd: FormData): Promise<void> {
  const slug = s(fd, "slug");
  const access = await requireShopAccess(slug);
  const id = z.uuid().safeParse(s(fd, "id"));
  const status = z.enum(["completed", "no_show", "cancelled"]).safeParse(s(fd, "status"));
  const back = `/painel/${access.barbershop.slug}/agenda?dia=${/^\d{4}-\d{2}-\d{2}$/.test(s(fd, "dia")) ? s(fd, "dia") : ""}`;
  if (!id.success || !status.success || (status.data === "cancelled" && access.role !== "owner")) redirect(`${back}&erro=1`);
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ status: status.data }).eq("id", id.data).eq("barbershop_id", access.barbershop.id).eq("status", "scheduled");
  revalidatePath(`/painel/${slug}`, "layout");
  redirect(error ? `${back}&erro=1` : back);
}

// Registra que o dono enviou (manualmente) a mensagem de WhatsApp. O sistema não envia nada sozinho.
export async function markNotificationSent(fd: FormData): Promise<void> {
  const shop = await owner(fd);
  const appt = z.uuid().safeParse(s(fd, "appointment"));
  const kind = z.enum(["confirmation", "reminder"]).safeParse(s(fd, "kind"));
  const message = s(fd, "message").slice(0, 1000);
  const back = `/painel/${shop.slug}/lembretes`;
  if (!appt.success || !kind.success || !message) redirect(`${back}?erro=1`);
  const supabase = await createClient();
  const { data: a } = await supabase.from("appointments").select("customer_id").eq("id", appt.data).eq("barbershop_id", shop.id).maybeSingle();
  if (!a) redirect(`${back}?erro=1`);
  const ins = await supabase.from("notifications").insert({ barbershop_id: shop.id, customer_id: a.customer_id, appointment_id: appt.data, kind: kind.data, message });
  if (ins.error) redirect(`${back}?erro=1`);
  // o grant de insert não inclui status/sent_at (ficam com o padrão); marcamos como enviado em seguida
  await supabase.from("notifications").update({ status: "sent", sent_at: new Date().toISOString() }).eq("appointment_id", appt.data).eq("kind", kind.data).eq("status", "pending");
  revalidatePath(back);
  redirect(back);
}
