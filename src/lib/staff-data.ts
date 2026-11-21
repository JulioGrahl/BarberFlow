import type { SupabaseClient } from "@supabase/supabase-js";

export type StaffPro = { id: string; name: string; services: { id: string; name: string; price_cents: number }[] };

// Profissionais ativos com os serviços que fazem. O barbeiro só enxerga a si mesmo; o dono, todos.
export async function loadStaffPros(supabase: SupabaseClient, shopId: string, owner: boolean, userId: string): Promise<StaffPro[]> {
  const [{ data: pros }, { data: links }, { data: services }, mine] = await Promise.all([
    supabase.from("professionals").select("id, display_name").eq("barbershop_id", shopId).eq("active", true).order("display_name"),
    supabase.from("professional_services").select("professional_id, service_id").eq("barbershop_id", shopId),
    supabase.from("services").select("id, name, price_cents").eq("barbershop_id", shopId).eq("active", true).order("name"),
    // user_id não é legível pelo cliente (grant por coluna); o banco diz quais profissionais são do usuário logado.
    owner ? Promise.resolve({ data: null }) : supabase.rpc("my_professional_ids", { p_shop: shopId }),
  ]);
  void userId;
  const own = new Set(((mine.data ?? []) as unknown as string[]).map(String));
  const svc = new Map((services ?? []).map((x) => [x.id as string, x as { id: string; name: string; price_cents: number }]));
  return (pros ?? [])
    .filter((p) => owner || own.has(p.id as string))
    .map((p) => ({
      id: p.id as string,
      name: p.display_name as string,
      services: (links ?? []).filter((l) => l.professional_id === p.id).flatMap((l) => (svc.get(l.service_id as string) ? [svc.get(l.service_id as string)!] : [])),
    }))
    .filter((p) => p.services.length > 0);
}

// Faltas dos últimos 90 dias e bloqueio de cada cliente (a função do banco só responde para a equipe da barbearia).
export async function loadFlags(supabase: SupabaseClient, shopId: string, ids: string[]) {
  const out = new Map<string, { no_shows: number; blocked: boolean }>();
  if (ids.length === 0) return out;
  const { data } = await supabase.rpc("customer_flags", { p_shop: shopId, p_customers: [...new Set(ids)] });
  for (const r of (data ?? []) as { customer_id: string; no_shows: number; blocked: boolean }[]) out.set(r.customer_id, { no_shows: r.no_shows, blocked: r.blocked });
  return out;
}
