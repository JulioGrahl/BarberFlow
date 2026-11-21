import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import * as z from "zod";
import { ConfirmForm } from "@/components/confirm-form";
import { getProfile, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { brl, fullDateTimeBR } from "@/lib/format";

export const metadata: Metadata = { title: "Confirmar agendamento" };

export default async function ConfirmPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; pro?: string; at?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = z.object({ service: z.uuid(), pro: z.uuid(), at: z.string().refine((v) => !Number.isNaN(Date.parse(v))) }).safeParse(sp);
  if (!q.success) notFound();
  // Cadastro/login obrigatório para confirmar; volta exatamente para esta tela depois.
  const user = await requireUser(`/b/${slug}/agendar/confirmar?service=${q.data.service}&pro=${q.data.pro}&at=${encodeURIComponent(q.data.at)}`);

  const profile = await getProfile();
  const supabase = await createClient();
  const { data: shop } = await supabase.from("barbershops").select("id,name").eq("slug", slug).maybeSingle();
  if (!shop) notFound();
  const [{ data: svc }, { data: pro }] = await Promise.all([
    supabase.from("services").select("name,price_cents,duration_minutes").eq("id", q.data.service).eq("barbershop_id", shop.id).eq("active", true).maybeSingle(),
    supabase.from("professionals").select("display_name").eq("id", q.data.pro).eq("barbershop_id", shop.id).maybeSingle(),
  ]);
  if (!svc || !pro) notFound();

  return (
    <div className="flex-1"><div className="pole h-2 w-full" aria-hidden /><main className="mx-auto w-full max-w-4xl px-5 py-10 md:px-8">
      <Link href={`/b/${slug}/agendar`} className="text-sm text-muted hover:text-ink">← Escolher outro horário</Link>
      <h1 className="font-display mt-3 text-4xl">Confirmar agendamento</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-2 md:gap-10">
      <div>
      <dl className="space-y-3 rounded-xl border border-line bg-surface p-5 text-sm">
        <div className="flex justify-between gap-4"><dt className="text-muted">Barbearia</dt><dd>{shop.name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Serviço</dt><dd>{svc.name} ({svc.duration_minutes} min)</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Profissional</dt><dd>{pro.display_name}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Quando</dt><dd className="text-right">{fullDateTimeBR(q.data.at)}</dd></div>
        <div className="flex justify-between gap-4"><dt className="text-muted">Valor</dt><dd className="font-semibold">{brl(svc.price_cents)}</dd></div>
      </dl>
      <div className="mt-4 text-sm text-muted">
        Agendando como <span className="text-ink">{user.email}</span>.{" "}
        <form action="/auth/signout" method="post" className="inline"><button className="underline hover:text-ink">Não é você? Sair</button></form>
      </div>
      </div>
      <ConfirmForm name={profile?.full_name ?? ""} phone={profile?.phone ?? ""} slug={slug} shop={shop.id} service={q.data.service} pro={q.data.pro} at={q.data.at} />
      </div>
    </main></div>
  );
}
