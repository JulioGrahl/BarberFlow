import type { Metadata } from "next";
import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Painel" };

export default async function ShopPanel({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { barbershop } = await requireShopAccess(slug);
  const supabase = await createClient();
  const [services, pros] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }).eq("barbershop_id", barbershop.id).eq("active", true),
    supabase.from("professionals").select("id", { count: "exact", head: true }).eq("barbershop_id", barbershop.id).eq("active", true),
  ]);
  const cards: [string, string][] = [["Serviços ativos", String(services.count ?? 0)], ["Profissionais ativos", String(pros.count ?? 0)]];
  return (
    <>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-muted">Agenda, clientes e financeiro chegam nas próximas etapas.</p>
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-line bg-surface p-4">
            <p className="text-xs uppercase tracking-wide text-muted">{l}</p>
            <p className="mt-1 text-2xl font-semibold">{v}</p>
          </div>
        ))}
      </div>
    </>
  );
}
