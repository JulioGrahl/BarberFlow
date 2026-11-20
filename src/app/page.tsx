import Link from "next/link";
import { getUser, resolveHome } from "@/lib/auth";

export default async function Home() {
  const user = await getUser();
  const home = user ? await resolveHome() : null;
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-sm font-semibold tracking-wide text-accent">BARBERFLOW</p>
      <h1 className="max-w-xl text-3xl font-semibold sm:text-4xl">Agenda, clientes e financeiro da sua barbearia em um só lugar.</h1>
      <div className="flex gap-3">
        {home ? (
          <Link href={home} className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
            Abrir meu painel
          </Link>
        ) : (
          <>
            <Link href="/login" className="rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink">
              Entrar
            </Link>
            <Link href="/cadastro" className="rounded-xl border border-line px-5 py-2.5 font-semibold">
              Criar conta de cliente
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
