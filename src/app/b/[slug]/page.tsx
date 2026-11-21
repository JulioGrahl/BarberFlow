import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ slug: string }> };

async function loadShop(slug: string) {
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name,slug,phone").eq("slug", slug).maybeSingle();
  if (!shop) return null;
  const { data: services } = await supabase
    .from("services")
    .select("id,name,description,price_cents,duration_minutes")
    .eq("barbershop_id", shop.id)
    .eq("active", true)
    .order("name");
  return { shop, services: services ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadShop((await params).slug);
  return { title: data?.shop.name ?? "Barbearia" };
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Página pública da barbearia (visível para anônimos graças à RLS: só barbearias com acesso liberado).
export default async function ShopPage({ params }: Props) {
  const data = await loadShop((await params).slug);
  if (!data) notFound();
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-10">
      <p className="text-sm font-semibold tracking-wide text-accent">BARBERFLOW</p>
      <h1 className="mt-2 text-3xl font-semibold">{data.shop.name}</h1>
      <Link href={`/b/${data.shop.slug}/agendar`} className="mt-6 inline-block rounded-xl bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110">
        Agendar horário
      </Link>
      <h2 className="mt-8 mb-3 text-lg font-medium">Serviços</h2>
      {data.services.length === 0 ? (
        <p className="text-sm text-muted">Esta barbearia ainda não cadastrou serviços.</p>
      ) : (
        <ul className="space-y-3">
          {data.services.map((s) => (
            <li key={s.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface p-4">
              <div>
                <p className="font-medium">{s.name}</p>
                <p className="text-sm text-muted">{s.duration_minutes} min</p>
              </div>
              <p className="font-semibold">{brl(s.price_cents)}</p>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
