"use client";

import { useActionState } from "react";
import { createBooking, type BookingState } from "@/app/actions/booking";
import { FormMessage, SubmitButton } from "@/components/ui";

export function ConfirmForm(p: { slug: string; shop: string; service: string; pro: string; at: string }) {
  const [state, action] = useActionState<BookingState, FormData>(createBooking, undefined);
  return (
    <form action={action} className="mt-6 space-y-4">
      {(Object.entries(p) as [string, string][]).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <FormMessage error={state?.error} />
      <SubmitButton pendingText="Confirmando...">Confirmar agendamento</SubmitButton>
    </form>
  );
}
