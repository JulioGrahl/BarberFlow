"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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
