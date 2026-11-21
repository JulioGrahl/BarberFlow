"use server";

import { redirect } from "next/navigation";
import * as z from "zod";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { timeBR } from "@/lib/format";

export type BookingState = { error?: string } | undefined;
export type Slot = { iso: string; label: string };

const Ids = z.object({ shop: z.uuid(), pro: z.uuid(), service: z.uuid() });

// Público (anônimo pode consultar): só devolve horários livres calculados pelo banco.
export async function getSlots(shop: string, pro: string, service: string, day: string): Promise<Slot[]> {
  const ok = Ids.safeParse({ shop, pro, service });
  if (!ok.success || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_available_slots", {
    p_shop: shop, p_professional: pro, p_service: service, p_day: day,
  });
  return ((data ?? []) as { starts_at: string }[]).map((r) => ({ iso: r.starts_at, label: timeBR(r.starts_at) }));
}

const ERRORS: Record<string, string> = {
  slot_unavailable: "Esse horário acabou de ser ocupado. Volte e escolha outro.",
  barbershop_unavailable: "Esta barbearia não está disponível para agendamentos no momento.",
  service_unavailable: "Este serviço não está mais disponível.",
};

export async function createBooking(_prev: BookingState, fd: FormData): Promise<BookingState> {
  const slug = String(fd.get("slug") ?? "");
  const parsed = Ids.safeParse({ shop: fd.get("shop"), pro: fd.get("pro"), service: fd.get("service") });
  const at = String(fd.get("at") ?? "");
  if (!parsed.success || Number.isNaN(Date.parse(at)) || !/^[a-z0-9-]+$/.test(slug)) return { error: "Dados do agendamento inválidos." };
  const user = await requireUser();
  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").replace(/\D/g, "");
  if (name.length < 2 || phone.length < 10 || phone.length > 13) return { error: "Informe seu nome e um WhatsApp com DDD." };
  const supabase = await createClient();
  // Atualiza o próprio perfil (RLS: só full_name e phone, só do próprio usuário); o banco copia para o cadastro de cliente.
  const { error: upErr } = await supabase.from("profiles").update({ full_name: name, phone }).eq("id", user.id);
  if (upErr) return { error: "Não foi possível salvar seus dados. Tente novamente." };
  const { error } = await supabase.rpc("create_appointment", {
    p_shop: parsed.data.shop, p_professional: parsed.data.pro, p_service: parsed.data.service,
    p_starts_at: new Date(at).toISOString(), p_notes: null,
  });
  if (error) {
    const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
    return { error: key ? ERRORS[key] : "Não foi possível confirmar o agendamento. Tente novamente." };
  }
  redirect("/app?agendado=1");
}

export async function cancelMyBooking(fd: FormData): Promise<void> {
  await requireUser("/app");
  const id = z.uuid().safeParse(fd.get("id"));
  if (!id.success) redirect("/app");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_my_appointment", { p_id: id.data });
  redirect(error ? (error.message.includes("too_late") ? "/app?erro=prazo" : "/app?erro=cancelamento") : "/app?cancelado=1");
}
