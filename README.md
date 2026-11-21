# BarberFlow

Plataforma SaaS multi-barbearia: agendamento online, agenda, clientes, financeiro e lembretes via WhatsApp (links `wa.me`). Uma única aplicação atende todas as barbearias, com dados isolados por RLS no Supabase.

Stack: Next.js 16 (App Router, TypeScript), Tailwind CSS 4, Lucide, Supabase (Postgres, Auth, RLS). Hospedagem prevista: Netlify (plano gratuito). Custo zero em desenvolvimento e testes.

## Documentação
- [Arquitetura e decisões](docs/ARQUITETURA.md)
- [Políticas de acesso (RLS, grants, RPCs)](docs/RLS.md)
- [Diretrizes de interface](docs/DESIGN.md)
- Migrações SQL: `supabase/migrations/` — teste de isolamento: `supabase/tests/rls_isolation.sql`

## Status
| Etapa | Situação |
|---|---|
| 1. Arquitetura | feita |
| 2. Banco, RLS e RPCs | feita e testada (46 verificações no Supabase) |
| 3. Autenticação e rotas por papel | código pronto; build, lint e proteção de rotas verificados; **login/cadastro reais ainda não testados contra o Supabase** |
| 3. Autenticação — teste real | cadastro e promoção a Super Admin confirmados pelo usuário |
| 6–7. Painel Master | código pronto (dashboard, barbearias, Nova Barbearia com link de convite, planos, mensalidades manuais, suporte auditado); build/lint OK e RPCs testadas no banco; **telas ainda não conferidas no navegador** |
| 8–10. Painel do proprietário (parcial) | convite do proprietário testado de ponta a ponta; serviços, profissionais (comissão, serviços que realiza) e convite de barbeiro prontos — build/lint OK e operações testadas no banco; **telas ainda não conferidas no navegador** |
| 11–12. Horários e reserva pública | horários da barbearia/profissionais, fluxo `/b/[slug]/agendar` (serviço → profissional → data → horário → login/cadastro → confirmação) e lista/cancelamento na área do cliente; build/lint OK, regras testadas no banco (conflito, intervalo, cancelamento); **telas ainda não conferidas no navegador** |
| 13. Agenda | `/painel/[slug]/agenda`: dia a dia, filtro por profissional, concluir/não compareceu/cancelar; barbeiro só vê e conclui os próprios; concluir gera a receita; build/lint OK e regras testadas no banco |
| 14. WhatsApp | `/painel/[slug]/lembretes`: atendimentos de hoje e amanhã com link `wa.me` e mensagem pronta (confirmação/lembrete); você envia manualmente e marca como enviado. Nenhuma mensagem sai sozinha; sem API paga; build/lint OK, links e banco testados |
| 15 em diante | pendentes: financeiro, relatórios, testes de segurança, publicação (seção 15 da especificação) |

## Rodando localmente
Requisitos: Node 20+ e npm.

```bash
git clone https://github.com/JulioGrahl/BarberFlow.git
cd BarberFlow
npm install
cp .env.example .env.local   # preencha com a URL e a chave publishable do seu projeto Supabase
npm run dev                  # http://localhost:3000
```

Variáveis (`.env.local`, nunca versionado):
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase › Project Settings › API
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — chave `sb_publishable_...` (pública por design)

A `service_role` **não é usada** e não deve ser colocada no frontend nem no repositório.

## Configuração do Supabase Auth (uma vez)
No painel do Supabase › Authentication:
1. **URL Configuration**: Site URL = `http://localhost:3000` em desenvolvimento (depois o domínio publicado). Em Redirect URLs, adicione `http://localhost:3000/auth/callback` (e a URL de produção `/auth/callback` ao publicar).
2. **Providers › Email › Confirm email**: decisão pendente.
   - O envio de e-mail embutido do plano gratuito tem limite muito baixo. Com a confirmação ligada, poucos cadastros por hora já esbarram nele.
   - Para desenvolvimento, deixe **desligada**. Para produção, as opções são manter desligada (qualquer pessoa cadastra qualquer e-mail, o que para clientes é aceitável) ou configurar um SMTP próprio (exige serviço externo, precisa da sua autorização).
3. Criar o Super Admin: cadastre-se normalmente em `/cadastro` e depois rode no SQL Editor:
   `update public.profiles set is_super_admin = true where email = 'seu@email.com';`

## Rotas
| Rota | Acesso |
|---|---|
| `/` | pública |
| `/login`, `/cadastro` | públicas (redirecionam quem já está logado) |
| `/b/[slug]` | pública: página da barbearia (reserva completa na Etapa 11) |
| `/convite/[token]` | pública: aceitar convite de barbeiro ou proprietário |
| `/app` | cliente logado |
| `/painel/[slug]` | dono ou barbeiro daquela barbearia |
| `/painel/[slug]/servicos`, `/profissionais`, `/horarios`, `/lembretes` | somente o dono |
| `/b/[slug]/agendar`, `/b/[slug]/agendar/confirmar` | pública (a confirmação exige login ou cadastro) |
| `/master`, `/master/barbearias`, `/master/barbearias/nova`, `/master/barbearias/[slug]`, `/master/planos` | somente Super Admin |

A checagem no proxy (`src/proxy.ts`) é só otimista. A autorização real está em `src/lib/auth.ts` (nas páginas) e na RLS do banco.

## Limites dos planos gratuitos (conferir antes de lançar)
- **Supabase Free**: o projeto pausa após cerca de 1 semana sem atividade, sem backup diário, e o envio de e-mail embutido é muito limitado.
- **Netlify Free**: 300 créditos/mês; ao esgotar, o projeto é suspenso até o próximo ciclo (não cobra). A Vercel Hobby não serve: é restrita a uso não comercial.
