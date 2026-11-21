"use client";

import { useActionState } from "react";
import { updateMyProfile, type AccountState } from "@/app/actions/account";
import { SubmitButton } from "@/components/ui";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const [state, run] = useActionState<AccountState, FormData>(updateMyProfile, undefined);
  const cls = "w-full rounded-lg border border-line bg-surface-2 px-3.5 py-2.5 text-base text-ink";
  return (
    <form action={run} className="space-y-4 rounded-xl border border-line bg-surface p-5">
      <label className="block space-y-1.5"><span className="text-sm text-muted">Nome</span><input name="name" defaultValue={name} required minLength={2} maxLength={120} autoComplete="name" className={cls} /></label>
      <label className="block space-y-1.5"><span className="text-sm text-muted">WhatsApp (com DDD)</span><input name="phone" defaultValue={phone} type="tel" inputMode="tel" autoComplete="tel" className={cls} /></label>
      <p className="text-sm text-muted">E-mail de acesso: <span className="text-ink">{email}</span></p>
      {state?.error ? <p role="alert" className="text-sm text-danger">{state.error}</p> : null}
      {state?.ok ? <p role="status" className="text-sm text-success">{state.ok}</p> : null}
      <SubmitButton pendingText="Salvando…">Salvar dados</SubmitButton>
    </form>
  );
}
