"use client";

import { useActionState } from "react";
import { createBooking, type BookingState } from "@/app/actions/booking";
import { Field, FormMessage, SubmitButton } from "@/components/ui";

export function ConfirmForm({ name, phone, ...p }: { name: string; phone: string; slug: string; shop: string; service: string; pro: string; at: string }) {
  const [state, action] = useActionState<BookingState, FormData>(createBooking, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      {(Object.entries(p) as [string, string][]).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <p className="text-sm text-muted">Confirme seus dados: a barbearia usa o nome e o WhatsApp para falar com você sobre o horário.</p>
      <Field label="Seu nome" id="name" autoComplete="name" required defaultValue={name} />
      <Field label="WhatsApp (com DDD)" id="phone" type="tel" inputMode="tel" autoComplete="tel" required defaultValue={phone} placeholder="(47) 99999-9999" />
      <FormMessage error={state?.error} />
      <SubmitButton pendingText="Confirmando...">Confirmar agendamento</SubmitButton>
    </form>
  );
}
