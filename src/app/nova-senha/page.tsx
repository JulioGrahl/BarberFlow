import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/ui";
import { NewPasswordForm } from "@/components/auth-forms";
import { getUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nova senha" };

// Só abre com a sessão criada pelo link do e-mail (/auth/confirm ou /auth/callback).
export default async function NewPasswordPage() {
  if (!(await getUser())) redirect("/recuperar-senha?erro=link");
  return (
    <AuthCard title="Criar nova senha" subtitle="Escolha uma senha nova para a sua conta.">
      <NewPasswordForm />
    </AuthCard>
  );
}
