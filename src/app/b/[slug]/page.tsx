import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";
import { waLink } from "@/lib/whatsapp";

type Props = { params: Promise<{ slug: string }> };

async function loadShop(slug: string) {
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name,slug,phone").eq("slug", slug).maybeSingle();
  if (!shop) return null;
  const [{ data: services }, { data: pros }] = await Promise.all([
    supabase.from("services").select("id,name,description,price_cents,duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("price_cents"),
    supabase.from("professionals").select("id,display_name").eq("barbershop_id", shop.id).eq("active", true).order("display_name"),
  ]);
  return { shop, services: services ?? [], pros: pros ?? [] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadShop((await params).slug);
  return { title: data?.shop.name ?? "Barbearia" };
}

// Página pública da barbearia (visível para anônimos graças à RLS: só barbearias com acesso liberado).
export default async function ShopPage({ params }: Props) {
  const data = await loadShop((await params).slug);
  if (!data) notFound();
  const { shop, services, pros } = data;
  const wa = waLink(shop.phone, `Olá! Vim pela página da ${shop.name}.`);
  return (
    <div className="flex-1">
      <div className="pole h-2 w-full" aria-hidden />
      <main className="mx-auto w-full max-w-2xl px-5 pb-16 pt-12">
        <p className="text-sm text-muted">Barbearia</p>
        <h1 className="font-display mt-1 text-5xl leading-[1.05] sm:text-6xl">{shop.name}</h1>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href={`/b/${shop.slug}/agendar`} className="rounded-lg bg-accent px-6 py-3 font-semibold text-accent-ink transition hover:brightness-110">Agendar horário</Link>
          {wa ? <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-lg border border-line px-5 py-3 hover:bg-surface"><MessageCircle size={18} aria-hidden /> WhatsApp</a> : null}
        </div>

        <h2 className="font-display mt-14 text-2xl">Serviços</h2>
        {services.length === 0 ? (
          <p className="mt-3 text-sm text-muted">Esta barbearia ainda não cadastrou serviços.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {services.map((s) => (
              <li key={s.id} className="flex items-baseline gap-3 py-4">
                <span className="min-w-0">
                  <span className="font-display text-xl">{s.name}</span>
                  <span className="block text-xs text-muted">{s.duration_minutes} min{s.description ? ` · ${s.description}` : ""}</span>
                </span>
                <span className="mb-1.5 min-w-6 flex-1 self-end border-b border-dotted border-line" aria-hidden />
                <span className="font-display text-xl">{brl(s.price_cents)}</span>
              </li>
            ))}
          </ul>
        )}

        {pros.length > 0 ? (
          <>
            <h2 className="font-display mt-14 text-2xl">Quem atende</h2>
            <ul className="mt-4 flex flex-wrap gap-3">
              {pros.map((p) => (
                <li key={p.id} className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4">
                  <span className="font-display flex size-9 items-center justify-center rounded-full bg-surface-2 text-accent">{p.display_name.slice(0, 1)}</span>
                  <span className="text-sm">{p.display_name}</span>
                </li>
              ))}
            </ul>
          </>
        ) : null}

        <p className="mt-16 text-xs text-muted">Para agendar você cria uma conta gratuita em menos de um minuto. <Link href="/login" className="underline hover:text-ink">Já tenho conta</Link></p>
      </main>
    </div>
  );
}
