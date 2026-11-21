import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/ui";
import { LoginForm } from "@/components/auth-forms";
import { getUser, resolveHome } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Entrar" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNext(first(sp.next)) ?? undefined;
  if (await getUser()) redirect(next ?? (await resolveHome()));

  const signupHref = `/cadastro${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <AuthCard title="Entrar" subtitle="Acesse sua conta para agendar ou gerenciar sua barbearia.">
      {first(sp.erro) === "confirmacao" ? (
        <p role="alert" className="mb-4 rounded-lg border border-warn/30 bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
          O link de confirmação é inválido ou expirou. Entre com sua senha ou crie a conta novamente.
        </p>
      ) : null}
      <LoginForm next={next} email={first(sp.email)} />
      <p className="mt-6 text-center text-sm text-muted">
        Ainda não tem conta?{" "}
        <Link href={signupHref} className="font-medium text-accent hover:underline">
          Cadastre-se
        </Link>
      </p>
    </AuthCard>
  );
}
