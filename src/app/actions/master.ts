"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import * as z from "zod";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

// Toda ação aqui revalida o SUPER_ADMIN e depois chama RPCs/tabelas protegidas por RLS.
// A validação do servidor é a que vale; a do navegador é só conforto.

export type MasterState = { error?: string; message?: string; inviteUrl?: string } | undefined;

const s = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string).trim() : "");
const uuid = z.uuid();
const toCents = (v: string) => Math.round(Number(v.replace(/\./g, "").replace(",", ".")) * 100);

async function origin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function friendly(message: string): string {
  if (message.includes("barbershops_slug_key") || message.includes("duplicate key")) return "Este endereço (slug) já está em uso.";
  if (message.includes("not_found")) return "Registro não encontrado.";
  if (message.includes("forbidden")) return "Acesso negado.";
  if (message.includes("not_closed")) return "Só é possível excluir uma barbearia já encerrada.";
  if (message.includes("confirm_mismatch")) return "O endereço digitado não confere. Nada foi excluído.";
  if (message.includes("invalid_amount")) return "Informe um valor válido.";
  if (message.includes("check constraint") && message.includes("slug")) return "Slug inválido: use letras minúsculas, números e hífens (3 a 60).";
  return "Não foi possível concluir a operação. Verifique os dados e tente novamente.";
}

// --------------------------------------------------------------- barbearias
const NewShop = z.object({
  name: z.string().min(2, "Informe o nome da barbearia."),
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug: minúsculas, números e hífens.").min(3).max(60),
  ownerName: z.string().min(3, "Informe o nome do proprietário."),
  ownerEmail: z.email("E-mail do proprietário inválido.").toLowerCase(),
  phone: z.string(),
  planId: z.uuid("Escolha um plano."),
  dueOn: z.iso.date("Informe o vencimento."),
  setupFee: z.string(),
});

export async function createBarbershop(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const parsed = NewShop.safeParse({
    name: s(fd, "name"),
    slug: s(fd, "slug").toLowerCase(),
    ownerName: s(fd, "ownerName"),
    ownerEmail: s(fd, "ownerEmail"),
    phone: s(fd, "phone"),
    planId: s(fd, "planId"),
    dueOn: s(fd, "dueOn"),
    setupFee: s(fd, "setupFee"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const setupFee = d.setupFee ? toCents(d.setupFee) : 0;
  if (!Number.isFinite(setupFee) || setupFee < 0) return { error: "Valor de implantação inválido." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_barbershop", {
    p_name: d.name,
    p_slug: d.slug,
    p_owner_name: d.ownerName,
    p_owner_email: d.ownerEmail,
    p_phone: d.phone || null,
    p_plan_id: d.planId,
    p_started_on: new Date().toISOString().slice(0, 10),
    p_due_on: d.dueOn,
    p_setup_fee_cents: setupFee,
  });
  if (error) return { error: friendly(error.message) };
  const r = data as { barbershop_id: string; owner_invitation_token: string };
  revalidatePath("/master", "layout");
  return {
    message: `Barbearia "${d.name}" criada. Envie o link abaixo ao proprietário (vale 14 dias).`,
    inviteUrl: `${await origin()}/convite/${r.owner_invitation_token}`,
  };
}

export async function updateBarbershop(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const name = s(fd, "name");
  const slug = s(fd, "slug").toLowerCase();
  if (!id.success || name.length < 2 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_update_barbershop", {
    p_shop: id.data, p_name: name, p_slug: slug, p_phone: s(fd, "phone") || null,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: "Dados atualizados." };
}

export async function reissueOwnerInvitation(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const email = z.email().safeParse(s(fd, "email"));
  if (!id.success || !email.success) return { error: "Informe o e-mail do proprietário." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_create_owner_invitation", {
    p_shop: id.data, p_email: email.data, p_name: s(fd, "name") || null,
  });
  if (error) return { error: friendly(error.message) };
  return { message: "Novo convite gerado (os anteriores foram revogados).", inviteUrl: `${await origin()}/convite/${data as string}` };
}

// --------------------------------------------------------------- assinatura
const Status = z.enum(["active", "pending", "overdue", "suspended", "cancelled"]);

export async function setSubscriptionStatus(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const status = Status.safeParse(s(fd, "status"));
  if (!id.success || !status.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const note = s(fd, "note").slice(0, 300);
  if (status.data === "suspended" && note.length < 3) return { error: "Informe o motivo do bloqueio (ex.: mensalidade em atraso)." };
  const { error } = await supabase.rpc("admin_set_subscription_status", { p_shop: id.data, p_status: status.data, p_note: note || null });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: { suspended: "Acesso bloqueado.", active: "Acesso reativado.", cancelled: "Contrato encerrado.", pending: "Marcada como pendente.", overdue: "Marcada em atraso." }[status.data] };
}

export async function setSetupFee(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const cents = toCents(s(fd, "amount") || "0");
  if (!id.success || !Number.isFinite(cents) || cents < 0) return { error: "Informe um valor válido." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_setup_fee", { p_shop: id.data, p_cents: cents });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: "Valor da implantação atualizado." };
}

// Exclusão definitiva: só depois de encerrada e digitando o endereço. Apaga agenda, clientes e financeiro da barbearia.
export async function deleteBarbershop(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  if (!id.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_delete_barbershop", { p_shop: id.data, p_confirm: s(fd, "confirm").toLowerCase() });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  redirect("/master/barbearias?excluida=1");
}

export async function registerPayment(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const amount = toCents(s(fd, "amount"));
  const paidOn = z.iso.date().safeParse(s(fd, "paidOn"));
  const month = z.string().regex(/^\d{4}-\d{2}$/).safeParse(s(fd, "month"));
  const kind = z.enum(["monthly", "setup"]).safeParse(s(fd, "kind") || "monthly");
  if (!id.success || !Number.isFinite(amount) || amount <= 0 || !paidOn.success || !month.success || !kind.success)
    return { error: "Informe valor, data e mês de referência válidos." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_register_payment", {
    p_shop: id.data, p_amount_cents: amount, p_paid_on: paidOn.data,
    p_reference_month: `${month.data}-01`, p_note: s(fd, "note") || null, p_kind: kind.data,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: kind.data === "setup" ? "Implantação registrada." : "Mensalidade registrada." };
}

export async function changePlan(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const planId = uuid.safeParse(s(fd, "planId"));
  const dueOn = z.iso.date().safeParse(s(fd, "dueOn"));
  if (!id.success || !planId.success || !dueOn.success) return { error: "Dados inválidos." };
  const supabase = await createClient();
  const { data: plan } = await supabase.from("plans").select("price_cents").eq("id", planId.data).maybeSingle();
  if (!plan) return { error: "Plano não encontrado." };
  const { error } = await supabase
    .from("subscriptions")
    .update({ plan_id: planId.data, price_cents: plan.price_cents, due_on: dueOn.data })
    .eq("barbershop_id", id.data);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: "Plano e vencimento atualizados." };
}

// --------------------------------------------------------------- planos
export async function savePlan(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const name = s(fd, "name");
  const price = toCents(s(fd, "price") || "0");
  const maxRaw = s(fd, "max");
  const max = maxRaw ? Number.parseInt(maxRaw, 10) : null;
  if (name.length < 2 || !Number.isFinite(price) || price < 0 || (max !== null && (!Number.isInteger(max) || max < 1)))
    return { error: "Informe nome, preço (≥ 0) e limite de profissionais (≥ 1 ou vazio)." };
  const row = { name, price_cents: price, max_professionals: max, active: fd.get("active") === "on" };
  const supabase = await createClient();
  const id = s(fd, "id");
  const { error } = id
    ? await supabase.from("plans").update(row).eq("id", id)
    : await supabase.from("plans").insert(row);
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: id ? "Plano atualizado." : "Plano criado." };
}

// --------------------------------------------------------------- suporte
export async function openSupport(_prev: MasterState, fd: FormData): Promise<MasterState> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  const reason = s(fd, "reason");
  if (!id.success || reason.length < 5) return { error: "Descreva o motivo do acesso (mínimo 5 caracteres)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_open_support_session", { p_shop: id.data, p_reason: reason });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/master", "layout");
  return { message: "Acesso de suporte aberto por 2 horas e registrado na auditoria." };
}

export async function closeSupport(fd: FormData): Promise<void> {
  await requireSuperAdmin();
  const id = uuid.safeParse(s(fd, "id"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.rpc("admin_close_support_session", { p_id: id.data });
  revalidatePath("/master", "layout");
}
