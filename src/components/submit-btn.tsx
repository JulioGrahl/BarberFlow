"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Botão de formulário que se desativa enquanto envia (evita toque duplo no celular).
export function SubmitBtn({ children, className }: { children: ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} aria-busy={pending} className={`${className ?? ""} disabled:opacity-60`}>
      {children}
    </button>
  );
}
