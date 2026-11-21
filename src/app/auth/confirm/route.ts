import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { resolveHome } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Destino dos links dos e-mails (recuperação de senha e confirmação de cadastro).
// Usa token_hash + verifyOtp: funciona mesmo se o link for aberto em outro aparelho
// ou navegador (o fluxo por código/PKCE exige o mesmo navegador que pediu o e-mail).
const TYPES: EmailOtpType[] = ["recovery", "email", "signup", "invite", "magiclink", "email_change"];

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const isRecovery = type === "recovery";

  if (tokenHash && type && TYPES.includes(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const next = isRecovery ? "/nova-senha" : safeNext(searchParams.get("next"));
      return NextResponse.redirect(`${origin}${next ?? (await resolveHome())}`);
    }
  }
  return NextResponse.redirect(`${origin}${isRecovery ? "/recuperar-senha?erro=link" : "/login?erro=confirmacao"}`);
}
