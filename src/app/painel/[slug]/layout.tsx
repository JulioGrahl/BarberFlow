import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { nowISO } from "@/lib/format";
import { ShopNav } from "@/components/shop-nav";
import { ShieldAlert } from "lucide-react";

export default async function ShopLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const access = await requireShopAccess(slug);
  const supabase = await createClient();
  // Acesso bloqueado pelo BarberFlow (mensalidade em atraso ou contrato encerrado): aviso claro em vez de painel vazio.
  const { data: block } = await supabase.rpc("my_shop_block_info", { p_slug: slug });
  const blockInfo = ((block ?? []) as { status: string; note: string | null }[])[0];
  if (blockInfo) {
    return (
      <main className="hex-dark relative flex min-h-dvh flex-1 items-center justify-center bg-night px-5 py-10 text-night-ink">
        <span className="pole absolute inset-x-0 top-0 h-2" aria-hidden />
        <div className="w-full max-w-md">
          <ShieldAlert size={40} className="text-flare" aria-hidden />
          <h1 className="font-display mt-4 text-5xl leading-[0.95]">{blockInfo.status === "cancelled" ? "Contrato encerrado" : "Acesso suspenso"}</h1>
          <p className="mt-4 text-night-muted">O acesso da <strong className="text-night-ink">{access.barbershop.name}</strong> ao BarberFlow está {blockInfo.status === "cancelled" ? "encerrado" : "suspenso"}. {blockInfo.note ? `Motivo: ${blockInfo.note}. ` : ""}A página de agendamento dos seus clientes também está fora do ar.</p>
          <p className="mt-3 text-sm text-night-muted">Seus dados continuam guardados. Para regularizar, fale com a equipe do BarberFlow.</p>
          <form action="/auth/signout" method="post" className="mt-8"><button className="min-h-12 rounded-lg border border-night-line px-5 text-sm hover:bg-night-2">Sair da conta</button></form>
        </div>
      </main>
    );
  }
  // atendimentos cujo horário já passou e ainda não foram concluídos nem marcados como falta
  const { count } = await supabase.from("appointments").select("id", { count: "exact", head: true })
    .eq("barbershop_id", access.barbershop.id).eq("status", "scheduled").lt("ends_at", nowISO());
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <ShopNav slug={slug} owner={access.role === "owner"} name={access.barbershop.name} pending={count ?? 0} />
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-9">{children}</main>
    </div>
  );
}
