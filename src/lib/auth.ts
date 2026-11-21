import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "barber";

export type Profile = {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  is_super_admin: boolean;
};

export type ShopMembership = {
  role: Role;
  support?: { sessionId: string; expiresAt: string };
  barbershop: { id: string; slug: string; name: string };
};

// Camada de acesso a dados (DAL): toda decisão de acesso nas páginas passa por aqui.
// A proteção real continua sendo a RLS; isto só decide o que mostrar e para onde redirecionar.

export type SessionUser = { id: string; email: string | undefined };

// getClaims() confere assinatura e validade do token localmente (chaves ES256 do projeto, em cache), sem ida e volta ao Supabase.
// Antes era getUser(), que consulta o servidor de autenticação a cada página. A RLS do banco já confia no mesmo token,
// então a proteção dos dados não muda; a única diferença é que um logout em outro aparelho vale só no fim da validade do token (1 h).
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined };
});

export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,phone,is_super_admin")
    .eq("id", user.id)
    .maybeSingle();
  return data;
});

export const getMemberships = cache(async (): Promise<ShopMembership[]> => {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("role, barbershops(id,slug,name)")
    .eq("user_id", user.id)
    .eq("status", "active");
  const rows = (data ?? []) as unknown as {
    role: Role;
    barbershops: { id: string; slug: string; name: string } | null;
  }[];
  return rows.flatMap((r) => (r.barbershops ? [{ role: r.role, barbershop: r.barbershops }] : []));
});

// Para onde o usuário vai depois de entrar (quando não há ?next=).
export async function resolveHome(): Promise<string> {
  const profile = await getProfile();
  if (profile?.is_super_admin) return "/master";
  const memberships = await getMemberships();
  if (memberships.length > 0) return `/painel/${memberships[0].barbershop.slug}`;
  return "/app";
}

export async function requireUser(nextPath?: string) {
  const user = await getUser();
  if (!user) redirect(nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : "/login");
  return user;
}

export async function requireSuperAdmin() {
  await requireUser("/master");
  const profile = await getProfile();
  if (!profile?.is_super_admin) notFound();
  return profile;
}

export async function requireShopAccess(slug: string, roles: Role[] = ["owner", "barber"]) {
  await requireUser(`/painel/${slug}`);
  const memberships = await getMemberships();
  const found = memberships.find((m) => m.barbershop.slug === slug && roles.includes(m.role));
  if (found) return found;
  // Super admin com acesso de suporte aberto (2h, auditado) entra com poderes de dono.
  const profile = await getProfile();
  if (profile?.is_super_admin && roles.includes("owner")) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("support_sessions")
      .select("id, expires_at, barbershops!inner(id, slug, name)")
      .eq("admin_id", profile.id)
      .eq("barbershops.slug", slug)
      .is("ended_at", null)
      .gt("expires_at", new Date().toISOString())
      .limit(1);
    const row = (data ?? [])[0] as unknown as { id: string; expires_at: string; barbershops: { id: string; slug: string; name: string } } | undefined;
    if (row) {
      return { role: "owner" as Role, barbershop: row.barbershops, support: { sessionId: row.id, expiresAt: row.expires_at } } as ShopMembership;
    }
  }
  notFound(); // não revela se a barbearia existe
}
