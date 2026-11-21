import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/ui";
import { ResetRequestForm } from "@/components/auth-forms";

export const metadata: Metadata = { title: "Recuperar senha" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function RecoverPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Recuperar senha" subtitle="Informe o e-mail da sua conta e enviaremos um link para criar uma nova senha.">
      {first(sp.erro) === "link" ? (
        <p role="alert" className="mb-4 rounded-lg border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
          O link é inválido ou expirou. Peça um novo link abaixo.
        </p>
      ) : null}
      <ResetRequestForm email={first(sp.email)} />
      <p className="mt-6 text-center text-sm text-muted">
        Lembrou a senha?{" "}
        <Link href="/login" className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
