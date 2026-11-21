# Publicação (Netlify + Supabase)

Custo: zero nos planos gratuitos. Chave `service_role` **nunca** vai para o Netlify nem para o código.

## 1. Netlify
1. Em app.netlify.com: **Add new project → Import an existing project → GitHub** e escolha `JulioGrahl/BarberFlow`.
2. Branch `main`. O build é lido do `netlify.toml` (`npm run build`).
3. Em **Site configuration → Environment variables**, crie só estas duas:
   - `NEXT_PUBLIC_SUPABASE_URL` = URL do projeto (Supabase → Project Settings → API)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = chave `sb_publishable_...`
4. Faça o deploy e anote o endereço (`https://nome.netlify.app`).

## 2. Supabase: URLs de autenticação
Authentication → URL Configuration:
- **Site URL**: o endereço do site publicado.
- **Redirect URLs**: `https://SEU-SITE/auth/callback` (e `http://localhost:3000/auth/callback` para testes locais).
Sem isso, links de e-mail e logins levam ao endereço errado.

## 3. E-mail (obrigatório antes de clientes reais)
O envio embutido do Supabase entrega 2 e-mails/hora e só para a equipe do projeto. Configure SMTP próprio
(Authentication → Emails → SMTP Settings; ex.: Brevo, com domínio autenticado) e reative **Confirm email**.
Ligue também o CAPTCHA (Authentication → Attack Protection) se a confirmação ficar desligada.

## 4. Domínio próprio (opcional)
Netlify → Domain management → Add a domain. Depois atualize o Site URL e as Redirect URLs no Supabase.

## 5. Depois do deploy, confira
- `/` abre; `/login` entra; `/b/<slug>` abre sem login.
- `/painel/<slug>` exige login; `/master` devolve 404 para quem não é super admin.
- Rode `supabase/tests/rls_isolation.sql` no SQL Editor: todos os itens do relatório devem ter `"ok": true`.

## 6. Limites a vigiar (planos gratuitos)
- Netlify: franquia mensal de créditos (build, banda e funções). Acompanhe em Usage.
- Supabase: banco de 500 MB e pausa por inatividade no plano gratuito; para cliente pagante, avalie o plano Pro.
