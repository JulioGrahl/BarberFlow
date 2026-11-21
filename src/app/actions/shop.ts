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
  const nextRaw = s(fd, "next");
  const root = `/painel/${access.barbershop.slug}`;
  // "next" só aceita caminhos internos do próprio painel (evita redirecionamento aberto)
  const nextOk = nextRaw === root || (nextRaw.startsWith(`${root}/`) && !nextRaw.includes("//") && !nextRaw.includes("\\"));
  const back = nextOk ? nextRaw : `${root}/agenda?dia=${/^\d{4}-\d{2}-\d{2}$/.test(s(fd, "dia")) ? s(fd, "dia") : ""}`;
  const sep = back.includes("?") ? "&" : "?";
  if (!id.success || !status.success || (status.data === "cancelled" && access.role !== "owner")) redirect(`${back}${sep}erro=1`);
  const supabase = await createClient();
  const { error } = await supabase.from("appointments").update({ status: status.data }).eq("id", id.data).eq("barbershop_id", access.barbershop.id).eq("status", "scheduled");
  revalidatePath(`/painel/${slug}`, "layout");
  redirect(error ? `${back}${sep}erro=1` : back);
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

// Financeiro (somente dono): lançamentos manuais. Receitas de atendimentos são automáticas e não se editam aqui.
export async function addTransaction(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const type = z.enum(["income", "expense"]).safeParse(s(fd, "type"));
  const amount = toCents(s(fd, "amount"));
  const date = z.iso.date().safeParse(s(fd, "date"));
  const category = s(fd, "category") || "geral";
  if (!type.success || !Number.isFinite(amount) || amount <= 0 || !date.success || category.length > 60)
    return { error: "Informe tipo, valor maior que zero e data válida." };
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").insert({
    barbershop_id: shop.id, type: type.data, category, amount_cents: amount,
    description: s(fd, "description").slice(0, 200) || null, occurred_on: date.data,
  });
  if (error) return fail();
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: "Lançamento registrado." };
}

export async function deleteTransaction(fd: FormData): Promise<void> {
  const shop = await owner(fd);
  const id = z.uuid().safeParse(s(fd, "id"));
  const back = `/painel/${shop.slug}/financeiro?mes=${/^\d{4}-\d{2}$/.test(s(fd, "mes")) ? s(fd, "mes") : ""}`;
  if (!id.success) redirect(back);
  const supabase = await createClient();
  await supabase.from("transactions").delete().eq("id", id.data).eq("barbershop_id", shop.id).is("appointment_id", null);
  revalidatePath(`/painel/${shop.slug}`, "layout");
  redirect(back);
}

// Folgas, feriados e bloqueios: o banco já os respeita ao calcular horários livres (blocked_times).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const plusDay = (ymd: string) => new Date(Date.parse(`${ymd}T12:00:00Z`) + 864e5).toISOString().slice(0, 10);

export async function addBlock(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const from = s(fd, "from");
  const to = s(fd, "to") || from;
  const allDay = fd.get("all_day") === "on";
  const proRaw = s(fd, "pro");
  const pro = proRaw ? z.uuid().safeParse(proRaw) : null;
  if (pro && !pro.success) return { error: "Profissional inválido." };
  if (!DATE.test(from) || !DATE.test(to) || to < from) return { error: "Informe a data inicial e, se for mais de um dia, uma data final igual ou posterior." };
  let startsAt: string, endsAt: string;
  if (allDay) {
    startsAt = `${from}T00:00:00-03:00`;
    endsAt = `${plusDay(to)}T00:00:00-03:00`;
  } else {
    const [a, b] = [s(fd, "start"), s(fd, "end")];
    if (!TIME.test(a) || !TIME.test(b) || a >= b || to !== from) return { error: "Para bloquear só parte do dia, use um único dia e informe início e fim válidos." };
    startsAt = `${from}T${a}:00-03:00`;
    endsAt = `${from}T${b}:00-03:00`;
  }
  const proId = pro?.success ? pro.data : null;
  const supabase = await createClient();
  const { error } = await supabase.from("blocked_times").insert({ barbershop_id: shop.id, professional_id: proId, starts_at: startsAt, ends_at: endsAt, reason: s(fd, "reason") || null });
  if (error) return fail();
  // Bloquear não cancela o que já está marcado: avisa quantos atendimentos caem no período.
  let q = supabase.from("appointments").select("id", { count: "exact", head: true }).eq("barbershop_id", shop.id).eq("status", "scheduled").gte("starts_at", startsAt).lt("starts_at", endsAt);
  if (proId) q = q.eq("professional_id", proId);
  const { count } = await q;
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: count ? `Bloqueio salvo. Atenção: já há ${count} atendimento(s) agendado(s) nesse período; cancele-os na agenda.` : "Bloqueio salvo." };
}

export async function deleteBlock(fd: FormData): Promise<void> {
  const shop = await owner(fd);
  const id = z.uuid().safeParse(s(fd, "id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("blocked_times").delete().eq("id", id.data).eq("barbershop_id", shop.id);
    revalidatePath(`/painel/${shop.slug}`, "layout");
  }
  redirect(`/painel/${shop.slug}/horarios`);
}

// ---- Encaixe, remarcação e política de faltas ----
const STAFF_ERR: Record<string, string> = {
  slot_unavailable: "Esse horário já está ocupado para este profissional.",
  slot_blocked: "Esse horário está bloqueado (folga ou feriado).",
  in_the_past: "Esse horário já passou.",
  invalid_name: "Informe o nome do cliente (mínimo 2 letras).",
  invalid_phone: "WhatsApp inválido. Use DDD e número, ou deixe em branco.",
  service_unavailable: "Esse profissional não faz esse serviço.",
  professional_unavailable: "Esse profissional não está disponível para este serviço.",
  forbidden: "Você só pode mexer nos seus próprios horários.",
  barbershop_unavailable: "O acesso da barbearia está suspenso.",
  not_found: "Atendimento não encontrado ou já encerrado.",
};
const staffErr = (m: string): State => {
  const k = Object.keys(STAFF_ERR).find((x) => m.includes(x));
  return { error: k ? STAFF_ERR[k] : MSG_FAIL };
};
const startsAtOf = (date: string, time: string) => (DATE.test(date) && TIME.test(time) ? new Date(`${date}T${time}:00-03:00`).toISOString() : null);

// Encaixe: a equipe agenda para um cliente que não tem conta (nome + WhatsApp). O banco valida tudo.
export async function createWalkIn(_p: State, fd: FormData): Promise<State> {
  const { barbershop } = await requireShopAccess(s(fd, "slug"));
  const pro = z.uuid().safeParse(s(fd, "pro"));
  const svc = z.uuid().safeParse(s(fd, "service"));
  const at = startsAtOf(s(fd, "date"), s(fd, "time"));
  if (!pro.success || !svc.success || !at) return { error: "Escolha profissional, serviço, dia e horário." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("staff_create_appointment", {
    p_shop: barbershop.id, p_professional: pro.data, p_service: svc.data, p_starts_at: at,
    p_name: s(fd, "name"), p_phone: s(fd, "phone") || null, p_notes: null,
  });
  if (error) return staffErr(error.message);
  revalidatePath(`/painel/${barbershop.slug}`, "layout");
  return { message: "Atendimento agendado." };
}

export async function staffReschedule(_p: State, fd: FormData): Promise<State> {
  const { barbershop } = await requireShopAccess(s(fd, "slug"));
  const id = z.uuid().safeParse(s(fd, "id"));
  const proRaw = s(fd, "pro");
  const pro = proRaw ? z.uuid().safeParse(proRaw) : null;
  const at = startsAtOf(s(fd, "date"), s(fd, "time"));
  if (!id.success || !at || (pro && !pro.success)) return { error: "Informe o novo dia e horário." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("reschedule_appointment", { p_id: id.data, p_starts_at: at, p_professional: pro?.success ? pro.data : null });
  if (error) return staffErr(error.message);
  revalidatePath(`/painel/${barbershop.slug}`, "layout");
  return { message: "Horário remarcado." };
}

// Regras de agendamento (dono): prazo mínimo para cancelar/remarcar e bloqueio automático por faltas.
export async function saveShopPolicy(_p: State, fd: FormData): Promise<State> {
  const shop = await owner(fd);
  const hours = Number.parseInt(s(fd, "hours"), 10);
  const limitRaw = s(fd, "limit");
  const limit = limitRaw === "" ? null : Number.parseInt(limitRaw, 10);
  if (!Number.isInteger(hours) || hours < 0 || hours > 72) return { error: "O prazo para cancelar deve ficar entre 0 e 72 horas." };
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 20)) return { error: "O limite de faltas deve ficar entre 1 e 20, ou vazio para desligar." };
  const supabase = await createClient();
  const { error } = await supabase.from("barbershops").update({ cancel_min_hours: hours, no_show_limit: limit }).eq("id", shop.id);
  if (error) return fail();
  revalidatePath(`/painel/${shop.slug}`, "layout");
  return { message: "Regras salvas." };
}

export async function toggleCustomerBlock(fd: FormData): Promise<void> {
  const shop = await owner(fd);
  const id = z.uuid().safeParse(s(fd, "id"));
  if (id.success) {
    const supabase = await createClient();
    await supabase.from("customers").update({ booking_blocked: s(fd, "block") === "1" }).eq("id", id.data).eq("barbershop_id", shop.id);
    revalidatePath(`/painel/${shop.slug}/clientes`);
  }
  redirect(`/painel/${shop.slug}/clientes`);
}
