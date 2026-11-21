import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { requireSuperAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { closeSupport } from "@/app/actions/master";
import { MasterNav } from "@/components/master-nav";
import { dateTimeBR, nowISO } from "@/lib/format";

type OpenSession = { id: string; expires_at: string; barbershops: { name: string; slug: string } | null };

export default async function MasterLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireSuperAdmin();
  const supabase = await createClient();
  // Aviso permanente enquanto houver acesso de suporte aberto (nada de acesso silencioso).
  const { data } = await supabase
    .from("support_sessions")
    .select("id, expires_at, barbershops(name, slug)")
    .eq("admin_id", profile.id)
    .is("ended_at", null)
    .gt("expires_at", nowISO());
  const sessions = (data ?? []) as unknown as OpenSession[];

  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <MasterNav />
      <div className="min-w-0 flex-1">
        {sessions.map((s) => (
          <div key={s.id} className="flex flex-wrap items-center gap-3 border-b border-warn/40 bg-warn/10 px-4 py-2.5 text-sm text-warn">
            <ShieldAlert size={18} aria-hidden />
            <span className="flex-1">
              Modo suporte ativo em{" "}
              <Link className="font-semibold underline" href={`/master/barbearias/${s.barbershops?.slug ?? ""}`}>
                {s.barbershops?.name}
              </Link>{" "}
              até {dateTimeBR(s.expires_at)}. Todos os acessos são auditados.
            </span>
            <form action={closeSupport}>
              <input type="hidden" name="id" value={s.id} />
              <button className="rounded-lg border border-warn/50 px-3 py-1 hover:bg-warn/10">Encerrar</button>
            </form>
          </div>
        ))}
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-9">{children}</main>
      </div>
    </div>
  );
}
