import { requireShopAccess } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { dateTimeBR, nowISO } from "@/lib/format";
import { closeSupport } from "@/app/actions/master";
import { ShopNav } from "@/components/shop-nav";
import { ShieldAlert } from "lucide-react";
import { Logo } from "@/components/logo";

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
          <div className="mb-8"><Logo tone="dark" size="md" /></div>
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
      <div className="min-w-0 flex-1">
        {access.support && (
          <div className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-warn/30 bg-warn-bg px-4 py-2.5 text-sm text-warn">
            <ShieldAlert size={18} aria-hidden />
            <span className="flex-1">Modo suporte em {access.barbershop.name} até {dateTimeBR(access.support.expiresAt)}. Alterações feitas aqui valem de verdade.</span>
            <a className="rounded-lg border border-warn/50 px-3 py-1 hover:bg-white/60" href={`/master/barbearias/${slug}`}>Voltar ao Master</a>
            <form action={closeSupport}>
              <input type="hidden" name="id" value={access.support.sessionId} />
              <button className="rounded-lg border border-warn/50 px-3 py-1 hover:bg-white/60">Encerrar suporte</button>
            </form>
          </div>
        )}
        <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 md:px-8 md:pb-12 md:pt-9">{children}</main>
      </div>
    </div>
  );
}
