import type { Metadata } from "next";
import Link from "next/link";
import { AcceptInvitationForm } from "@/components/auth-forms";
import { AuthCard } from "@/components/ui";
import { getProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Convite", robots: { index: false } };

type Preview = { barbershop_name: string; role: "owner" | "barber"; email: string | null; invitee_name: string | null };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_invitation_preview", { p_token: token });
  const preview = (data ?? null) as Preview | null;

  if (!preview) {
    return (
      <AuthCard title="Convite indisponível">
        <p className="text-sm text-muted">Este convite é inválido, expirou ou já foi utilizado. Peça um novo link a quem convidou você.</p>
      </AuthCard>
    );
  }

  const profile = await getProfile();
  const roleLabel = preview.role === "owner" ? "proprietário(a)" : "barbeiro(a)";
  const next = `/convite/${token}`;
  const qs = `?next=${encodeURIComponent(next)}${preview.email ? `&email=${encodeURIComponent(preview.email)}` : ""}`;

  return (
    <AuthCard title={preview.barbershop_name} subtitle={`Você foi convidado(a) como ${roleLabel}.`}>
      {profile ? (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Conectado como <span className="text-ink">{profile.email}</span>.
          </p>
          <AcceptInvitationForm token={token} />
          <form action="/auth/signout" method="post">
            <button className="w-full text-sm text-muted hover:text-ink">Entrar com outra conta</button>
          </form>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">
            {preview.email ? `Entre ou crie sua conta com ${preview.email} para aceitar.` : "Entre ou crie sua conta para aceitar."}
          </p>
          <Link href={`/cadastro${qs}`} className="block rounded-xl bg-accent px-4 py-2.5 text-center font-semibold text-accent-ink">
            Criar conta e aceitar
          </Link>
          <Link href={`/login${qs}`} className="block rounded-xl border border-line px-4 py-2.5 text-center font-semibold">
            Já tenho conta
          </Link>
        </div>
      )}
    </AuthCard>
  );
}
