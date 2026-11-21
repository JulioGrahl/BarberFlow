import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicTop } from "@/components/public-shell";
import { BookingFlow } from "@/components/booking-flow";
import { createClient } from "@/lib/supabase/server";
import { nextDays } from "@/lib/format";

export const metadata: Metadata = { title: "Agendar" };

export default async function BookPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name,slug").eq("slug", slug).maybeSingle();
  if (!shop) notFound();
  const [services, pros, links] = await Promise.all([
    supabase.from("services").select("id,name,price_cents,duration_minutes").eq("barbershop_id", shop.id).eq("active", true).order("name"),
    supabase.from("professionals").select("id,display_name").eq("barbershop_id", shop.id).eq("active", true).order("display_name"),
    supabase.from("professional_services").select("professional_id,service_id").eq("barbershop_id", shop.id),
  ]);
  const proList = (pros.data ?? []).map((p) => ({
    id: p.id, name: p.display_name,
    serviceIds: (links.data ?? []).filter((l) => l.professional_id === p.id).map((l) => l.service_id),
  }));
  return (
    <div className="flex-1">
      <PublicTop title="Agendar horário" kicker={shop.name} back={{ href: `/b/${slug}`, label: "Voltar" }} />
      <main className="mx-auto w-full max-w-2xl px-5 py-10">
        {(services.data ?? []).length === 0 || proList.length === 0 ? (
          <p className="text-sm text-muted">Esta barbearia ainda não liberou agendamentos online.</p>
        ) : (
          <BookingFlow shop={shop.id} slug={slug} services={services.data ?? []} pros={proList} days={nextDays(14)} />
        )}
      </main>
    </div>
  );
}
