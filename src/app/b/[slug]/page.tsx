import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { brl, nowISO, spParts } from "@/lib/format";
import { WhatsAppLink } from "@/components/kit";
import { waLink } from "@/lib/whatsapp";

type Hour = { weekday: number; start_time: string; end_time: string; break_start: string | null; break_end: string | null };
const DAYS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const hm = (t: string) => t.slice(0, 5).replace(/^0/, "").replace(":00", "h").replace(":", "h");
type Props = { params: Promise<{ slug: string }> };

async function loadShop(slug: string) {
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name,slug,phone").eq("slug", slug).maybeSingle();
  if (!shop) return null;
  const [{ data: services }, { data: pros }, { data: hours }] = await Promise.all([
    supabase.from("services").select("id,name,description,price_cents,duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("price_cents"),
    supabase.from("professionals").select("id,display_name").eq("barbershop_id", shop.id).eq("active", true).order("display_name"),
    supabase.rpc("get_public_hours", { p_shop: shop.id }),
  ]);
  return { shop, services: services ?? [], pros: pros ?? [], hours: (hours ?? []) as Hour[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await loadShop((await params).slug);
  return { title: data?.shop.name ?? "Barbearia" };
}

// Página pública da barbearia (visível para anônimos graças à RLS: só barbearias com acesso liberado).
export default async function ShopPage({ params }: Props) {
  const data = await loadShop((await params).slug);
  if (!data) notFound();
  const { shop, services, pros, hours } = data;
  const open = new Map(hours.map((h) => [h.weekday, h]));
  const wa = waLink(shop.phone, `Olá! Vim pela página da ${shop.name}.`);
  const todayDow = new Date(`${spParts(nowISO()).ymd}T12:00:00Z`).getUTCDay();
  const todayHours = open.get(todayDow);
  return (
    <div className="flex-1">
      <section className="hex-dark relative overflow-hidden bg-night text-night-ink">
        <span className="pole absolute inset-x-0 bottom-0 h-2" aria-hidden />
        <div className="mx-auto w-full max-w-4xl px-5 pb-14 pt-[max(1.5rem,env(safe-area-inset-top))] sm:pb-20">
          <div className="flex items-center justify-between">
            <span className="font-display text-lg text-night-muted">Barbearia</span>
            <Link href="/login" className="rounded-lg border border-night-line px-3.5 py-2 text-sm hover:bg-night-2">Entrar</Link>
          </div>
          <h1 className="font-display rise mt-12 text-[3.6rem] leading-[0.9] sm:mt-16 sm:text-[6.5rem]">{shop.name}</h1>
          {hours.length > 0 ? (
            <p className="mt-5 inline-flex items-center gap-2 rounded-full bg-night-2 px-3.5 py-1.5 text-sm">
              <span className={`size-2 rounded-full ${todayHours ? "bg-success" : "bg-night-muted"}`} aria-hidden />
              {todayHours ? `Hoje: ${hm(todayHours.start_time)} às ${hm(todayHours.end_time)}` : "Fechado hoje"}
            </p>
          ) : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href={`/b/${shop.slug}/agendar`} className="min-h-13 rounded-xl bg-accent px-7 py-3.5 text-lg font-semibold text-white shadow-[0_8px_20px_rgb(210_55_43/.35)] transition hover:bg-accent-hover active:translate-y-px">Agendar horário</Link>
            {wa ? <WhatsAppLink href={wa} dark className="min-h-13 rounded-xl px-6 text-lg" /> : null}
          </div>
        </div>
      </section>

      <main className="mx-auto grid w-full max-w-4xl gap-8 px-5 py-12 md:grid-cols-[1.4fr_1fr] md:gap-12">
        <section aria-label="Serviços e preços">
          <h2 className="font-display text-4xl leading-none">Serviços</h2>
          {services.length === 0 ? (
            <p className="mt-4 text-sm text-muted">Esta barbearia ainda não cadastrou serviços.</p>
          ) : (
            <ul className="hex-dark relative mt-5 overflow-hidden rounded-2xl bg-night px-5 py-2 text-night-ink">
              {services.map((sv) => (
                <li key={sv.id} className="flex items-baseline gap-3 border-b border-night-line py-4 last:border-0">
                  <span className="min-w-0">
                    <span className="font-display text-2xl leading-tight">{sv.name}</span>
                    <span className="block text-xs text-night-muted">{sv.duration_minutes} min{sv.description ? ` · ${sv.description}` : ""}</span>
                  </span>
                  <span className="mb-1.5 min-w-6 flex-1 self-end border-b-2 border-dotted border-night-line" aria-hidden />
                  <span className="font-display text-3xl leading-none text-flare">{brl(sv.price_cents)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="space-y-10">
          {hours.length > 0 ? (
            <section aria-label="Horário de funcionamento">
              <h2 className="font-display text-4xl leading-none">Horários</h2>
              <ul className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface text-sm">
                {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                  const h = open.get(d);
                  const now = d === todayDow;
                  return (
                    <li key={d} className={`flex justify-between gap-4 border-b border-line px-4 py-2.5 last:border-0 ${now ? "bg-night font-medium text-night-ink" : ""}`}>
                      <span>{DAYS[d]}</span>
                      <span className={`text-right ${h ? "" : now ? "text-night-muted" : "text-muted"}`}>{h ? `${hm(h.start_time)} às ${hm(h.end_time)}${h.break_start && h.break_end ? ` · pausa ${hm(h.break_start)} às ${hm(h.break_end)}` : ""}` : "Fechado"}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          {pros.length > 0 ? (
            <section aria-label="Quem atende">
              <h2 className="font-display text-4xl leading-none">Quem atende</h2>
              <ul className="mt-5 flex flex-wrap gap-2.5">
                {pros.map((p) => (
                  <li key={p.id} className="flex items-center gap-2.5 rounded-full border border-line bg-surface py-1.5 pl-1.5 pr-4">
                    <span className="font-display flex size-9 items-center justify-center rounded-full bg-night text-xl text-white">{p.display_name.slice(0, 1)}</span>
                    <span className="text-sm font-medium">{p.display_name}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </main>
      <p className="mx-auto w-full max-w-4xl px-5 pb-14 text-xs text-muted">Para agendar você cria uma conta gratuita em menos de um minuto. <Link href="/login" className="underline hover:text-ink">Já tenho conta</Link></p>
    </div>
  );
}
