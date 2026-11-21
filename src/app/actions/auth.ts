"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import * as z from "zod";
import { resolveHome } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string } | undefined;

const LoginSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
});

const SignupSchema = z
  .object({
    name: z.string().trim().min(3, "Informe seu nome completo."),
    email: z.email("Informe um e-mail válido.").trim().toLowerCase(),
    phone: z
      .string()
      .transform((v) => v.replace(/\D/g, ""))
      .pipe(z.string().min(10, "Informe o telefone com DDD.").max(13, "Telefone inválido.")),
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

const field = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = LoginSchema.safeParse({ email: field(formData, "email"), password: field(formData, "password") });
  if (!parsed.success) return { error: "Informe um e-mail válido e a senha." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    return { error: error.code === "email_not_confirmed" ? "Confirme seu e-mail antes de entrar." : "E-mail ou senha incorretos." };
  }
  redirect(safeNext(field(formData, "next")) ?? (await resolveHome()));
}

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = SignupSchema.safeParse({
    name: field(formData, "name"),
    email: field(formData, "email"),
    phone: field(formData, "phone"),
    password: field(formData, "password"),
    confirm: field(formData, "confirm"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const next = safeNext(field(formData, "next")) ?? "/app";
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name, phone: parsed.data.phone },
      emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      return { error: "Muitos cadastros em pouco tempo. Tente novamente em alguns minutos." };
    }
    if (error.code === "weak_password") return { error: "Escolha uma senha mais forte." };
    return { error: "Não foi possível criar a conta. Verifique os dados e tente novamente." };
  }
  // Com confirmação de e-mail ativa, não há sessão até o clique no link.
  if (!data.session) {
    return { message: "Conta criada. Enviamos um link de confirmação para o seu e-mail." };
  }
  redirect(safeNext(field(formData, "next")) ?? (await resolveHome()));
}

const ResetRequestSchema = z.object({ email: z.email().trim().toLowerCase() });

const NewPasswordSchema = z
  .object({
    password: z.string().min(8, "A senha precisa ter ao menos 8 caracteres."),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "As senhas não conferem.", path: ["confirm"] });

// Pede o link de redefinição. A resposta é sempre a mesma, exista ou não a conta,
// para não revelar quais e-mails estão cadastrados.
export async function requestPasswordReset(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = ResetRequestSchema.safeParse({ email: field(formData, "email") });
  if (!parsed.success) return { error: "Informe um e-mail válido." };

  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();
  // redirectTo só vale se o modelo de e-mail usar {{ .ConfirmationURL }}; o modelo padrão do app usa /auth/confirm.
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/nova-senha")}`,
  });
  if (error?.code === "over_email_send_rate_limit") {
    return { error: "Muitos pedidos em pouco tempo. Aguarde alguns minutos e tente novamente." };
  }
  return { message: "Se existir uma conta com esse e-mail, enviamos um link para redefinir a senha. Confira também a caixa de spam." };
}

// Chamada na tela aberta pelo link do e-mail (a sessão de recuperação já existe).
export async function updatePassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = NewPasswordSchema.safeParse({ password: field(formData, "password"), confirm: field(formData, "confirm") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (error.code === "weak_password") return { error: "Escolha uma senha mais forte." };
    if (error.code === "same_password") return { error: "A nova senha precisa ser diferente da atual." };
    if (error.code === "session_not_found" || error.status === 401) {
      return { error: "O link expirou. Peça um novo link de redefinição." };
    }
    return { error: "Não foi possível alterar a senha. Tente novamente." };
  }
  redirect(await resolveHome());
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const INVITE_ERRORS: Record<string, string> = {
  invalid_invitation: "Convite inválido, expirado ou já utilizado.",
  email_mismatch: "Este convite foi emitido para outro e-mail. Entre com a conta correta.",
  not_authenticated: "Entre na sua conta para aceitar o convite.",
};

export async function acceptInvitation(token: string): Promise<FormState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });
  if (error) return { error: INVITE_ERRORS[error.message] ?? "Não foi possível aceitar o convite." };
  const slug = (data as { slug?: string } | null)?.slug;
  redirect(slug ? `/painel/${slug}` : await resolveHome());
}
