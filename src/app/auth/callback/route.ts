import { NextResponse, type NextRequest } from "next/server";
import { resolveHome } from "@/lib/auth";
import { safeNext } from "@/lib/redirect";
import { createClient } from "@/lib/supabase/server";

// Destino do link de confirmação de e-mail (fluxo PKCE do Supabase Auth).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const next = safeNext(searchParams.get("next"));
      return NextResponse.redirect(`${origin}${next ?? (await resolveHome())}`);
    }
  }
  return NextResponse.redirect(`${origin}/login?erro=confirmacao`);
}
