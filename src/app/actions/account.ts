"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type AccountState = { error?: string; ok?: string } | undefined;

// O cliente edita só o próprio nome e WhatsApp (RLS + grant por coluna garantem). A barbearia vê a atualização no próximo agendamento.
export async function updateMyProfile(_p: AccountState, fd: FormData): Promise<AccountState> {
  const user = await requireUser("/app");
  const name = String(fd.get("name") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").replace(/\D/g, "");
  if (name.length < 2 || name.length > 120) return { error: "Informe seu nome (mínimo 2 letras)." };
  if (phone && (phone.length < 10 || phone.length > 13)) return { error: "WhatsApp inválido. Use DDD e número." };
  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update({ full_name: name, phone: phone || null }).eq("id", user.id);
  if (error) return { error: "Não foi possível salvar. Tente novamente." };
  revalidatePath("/app");
  return { ok: "Dados atualizados." };
}
