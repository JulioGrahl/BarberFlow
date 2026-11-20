"use client";

import { useActionState } from "react";
import { acceptInvitation, login, signup, type FormState } from "@/app/actions/auth";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function LoginForm({ next, email }: { next?: string; email?: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="E-mail" id="email" type="email" autoComplete="email" required defaultValue={email} />
      <Field label="Senha" id="password" type="password" autoComplete="current-password" required />
      <FormMessage error={state?.error} message={state?.message} />
      <SubmitButton pendingText="Entrando...">Entrar</SubmitButton>
    </form>
  );
}

export function SignupForm({ next, email }: { next?: string; email?: string }) {
  const [state, action] = useActionState<FormState, FormData>(signup, undefined);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Nome completo" id="name" autoComplete="name" required />
      <Field label="E-mail" id="email" type="email" autoComplete="email" required defaultValue={email} />
      <Field label="Telefone (com DDD)" id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="(47) 99999-9999" required />
      <Field label="Senha (mínimo 8 caracteres)" id="password" type="password" autoComplete="new-password" minLength={8} required />
      <Field label="Confirmar senha" id="confirm" type="password" autoComplete="new-password" minLength={8} required />
      <FormMessage error={state?.error} message={state?.message} />
      <SubmitButton pendingText="Criando conta...">Criar conta</SubmitButton>
    </form>
  );
}

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(() => acceptInvitation(token), undefined);
  return (
    <form action={action} className="space-y-4">
      <FormMessage error={state?.error} message={state?.message} />
      <SubmitButton pendingText="Aceitando...">Aceitar convite</SubmitButton>
    </form>
  );
}
