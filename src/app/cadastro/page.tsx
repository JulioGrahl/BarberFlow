import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/ui";
import { SignupForm } from "@/components/auth-forms";
import { getUser, resolveHome } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";

export const metadata: Metadata = { title: "Criar conta" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function SignupPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const next = safeNext(first(sp.next)) ?? undefined;
  if (await getUser()) redirect(next ?? (await resolveHome()));

  const loginHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <AuthCard title="Criar conta" subtitle="Cadastre-se para agendar seus horários em qualquer barbearia do BarberFlow.">
      <SignupForm next={next} email={first(sp.email)} />
      <p className="mt-6 text-center text-sm text-muted">
        Já tem conta?{" "}
        <Link href={loginHref} className="font-medium text-accent hover:underline">
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
