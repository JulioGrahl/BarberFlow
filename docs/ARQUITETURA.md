# BarberFlow — Arquitetura e Planejamento (Etapa 1)

Status: proposta para aprovação. Nada foi aplicado ao banco ainda.

## 1. Visão geral

Uma única aplicação Next.js (App Router, TypeScript), hospedada no Netlify, atende todas as barbearias. O isolamento é feito no banco (Supabase Postgres + RLS), não no código da aplicação.

```
Navegador ──> Next.js (Vercel) ──> Supabase Auth + Postgres (RLS)
                 │
                 └─ Server Actions / Route Handlers (validação com Zod, sessão via @supabase/ssr)
```

- O frontend usa apenas a chave publishable (anon). A `service_role` não é usada em nenhum fluxo planejado (ver 4).
- Toda regra de permissão existe em RLS e em funções SQL. O frontend só esconde menus.
- Datas gravadas em `timestamptz` (UTC). Exibição e cálculo de slots em `America/Sao_Paulo`.

## 2. Estrutura do repositório

```
src/
  app/
    (public)/b/[slug]/            página pública e fluxo de reserva
    (auth)/login, cadastro, convite/[token]
    app/                          área do cliente (/app/minhas-reservas ...)
    painel/[slug]/                painel OWNER e BARBER
    master/                       painel SUPER_ADMIN
  components/ ui/ agenda/ charts/
  lib/ supabase/ (client, server, middleware)  permissions.ts  slots.ts  whatsapp.ts
supabase/
  migrations/                     SQL versionado (fonte da verdade do schema)
  tests/                          testes de RLS (pgTAP ou scripts SQL)
docs/                             arquitetura, RLS, guias de instalação/deploy
```

Migrações ficam em `supabase/migrations` e são aplicadas ao projeto remoto. O repositório é a fonte da verdade, não o painel do Supabase.

## 3. Multi-tenant e papéis

Modelo: banco compartilhado, esquema compartilhado, coluna `barbershop_id` em toda tabela de negócio.

| Conceito | Onde fica |
|---|---|
| SUPER_ADMIN | `profiles.is_super_admin boolean`. Só alterável por SQL direto; trigger bloqueia qualquer UPDATE vindo de usuário comum. Nunca por cadastro público. |
| OWNER / BARBER | `memberships (user_id, barbershop_id, role, status)`, único por usuário+barbearia+papel |
| CUSTOMER | não usa membership: o vínculo com cada barbearia é a linha em `customers` |
| Dados globais do cliente | `profiles` (nome, e-mail, telefone) |
| Cliente dentro de uma barbearia | `customers (barbershop_id, profile_id, ...)`, criado no primeiro agendamento |

Funções auxiliares em schema privado, `SECURITY DEFINER`, com `search_path` fixo: `is_super_admin()`, `has_role(barbershop_id, role)`, `is_member(barbershop_id)`, `barbershop_is_active(barbershop_id)`. As policies chamam essas funções, o que evita recursão de RLS em `memberships`.

Regras de RLS (resumo; o detalhamento por tabela vai em `docs/RLS.md` na Etapa 2):
- OWNER: leitura e escrita em tudo com o `barbershop_id` das suas memberships.
- BARBER: lê só `appointments` onde `professional_id` é ele; atualiza apenas `status` (concluído / ausente). Não lê `transactions` nem comissões de terceiros. Permissões extras por barbeiro ficam em `memberships.permissions jsonb`, controladas pelo OWNER.
- CUSTOMER: lê e cria apenas os próprios `appointments`; cancelamento via função que aplica a regra de antecedência da barbearia.
- Barbearia suspensa: `barbershop_is_active()` falso bloqueia painel e reservas públicas em nível de RLS.
- Leitura pública (anon): somente barbearia ativa por slug, serviços ativos, profissionais ativos e horários. Nada de dados de clientes.

## 4. Decisões que divergem ou complementam a especificação

1. **Convite por link como fluxo principal.** `invitations` guarda só o hash do token, papel, e-mail, validade e uso único. O convidado abre `/convite/[token]`, cria conta (ou entra) e chama a função `accept_invitation(token)`, que valida e cria a membership. O papel vem do convite, nunca do usuário. Isso dispensa `service_role` e e-mail transacional (o envio do Supabase no plano gratuito é muito limitado). E-mail fica como opcional.
2. **Dono de nova barbearia também por convite.** O Super Admin cria a barbearia e a assinatura via função SQL (só super admin) e gera um convite OWNER. Assim o proprietário define a própria senha e o sistema não manipula senhas.
3. **Acesso de suporte imposto pelo banco.** Para o requisito "sem acesso silencioso", proponho a tabela adicional `support_sessions`. O Super Admin só enxerga dados de uma barbearia se existir sessão de suporte aberta e não expirada para ela, criada por uma função que também grava em `audit_logs`. Sem isso, auditoria seria só convenção do frontend.
4. **Reserva sem conflito, mesmo concorrente.** A criação de reserva é uma função SQL (`create_appointment`) que valida horário de funcionamento, pausas, folgas, bloqueios e duração. A garantia final é uma `EXCLUDE USING gist (professional_id WITH =, tstzrange(starts_at, ends_at) WITH &&) WHERE (status IN ('scheduled','confirmed'))` (extensão `btree_gist`). Duas requisições simultâneas: uma falha com erro tratado.
5. **Fluxo de reserva com login tardio.** Seleção (serviço, profissional, data, horário) guardada no `sessionStorage` e na URL; após login ou cadastro o usuário volta ao passo 6. Se o horário foi tomado nesse intervalo, o sistema avisa e reoferece outros.
6. **Tabelas além das 15 listadas:** `support_sessions`, `professional_services` (N:N), `payments` das mensalidades (histórico de pagamentos de `subscriptions`; a spec pede histórico e a tabela `subscriptions` sozinha não comporta isso). Horários da barbearia ficam em `schedules` com `professional_id` nulo = horário do estabelecimento.
7. **Faturamento** = soma de `transactions` do tipo receita ligadas a atendimentos concluídos, mais receitas avulsas lançadas. Nada de cálculo sobre agendamento apenas marcado.

## 5. Plano de custo zero: limites e riscos

Valores abaixo vêm do meu conhecimento dos planos gratuitos e precisam ser conferidos nas páginas oficiais antes do lançamento; mudam com frequência.

- **Hospedagem: Netlify Free (decisão tomada, substitui a Vercel).** A documentação da Vercel diz que o plano Hobby é restrito a uso pessoal e não comercial, e o BarberFlow será vendido. O Netlify Free permite projetos comerciais, não exige cartão e, ao esgotar os créditos, suspende o projeto até o ciclo seguinte em vez de cobrar. Limite atual: 300 créditos/mês, consumidos por requisições, funções, builds e tráfego. Ainda não sei quantos acessos isso comporta; medir durante os testes. Reconferir os termos do Netlify antes do primeiro cliente.
- **Alternativa descartada por ora: Cloudflare Workers (via OpenNext).** Free permite uso comercial, mas o Worker tem limite de 3 MiB comprimido e 50 subrequests por invocação no plano gratuito, o que é arriscado para um app Next.js com gráficos e Supabase. A própria Cloudflare já recomenda outro caminho (vinext) para apps novos, ainda pouco maduro.
- **Portabilidade:** o código não usa nada específico de plataforma (sem `@vercel/*`, sem Vercel Cron/Edge Config), apenas Next.js padrão com runtime Node. Trocar de host depois deve exigir só configuração.
- **Supabase Free pausa o projeto após cerca de 1 semana sem atividade** e não inclui backups diários. Aceitável em teste, arriscado em produção com clientes reais.
- Limites do Supabase Free relevantes: ~500 MB de banco, número limitado de usuários ativos mensais, e envio de e-mail de autenticação muito restrito. Por isso o convite por link.
- Sem WhatsApp API, sem gateway, sem SMS: tudo via `wa.me`, com envio confirmado manualmente, como definido.

## 6. Ordem de execução

Segue a seção 15 da especificação, com teste ao fim de cada etapa. Etapa 2 entrega: migrações SQL (tabelas, enums, índices, constraints), funções auxiliares, RLS por tabela e testes de isolamento entre duas barbearias fictícias, aplicados ao projeto Supabase.

## 7. Pendências que dependem de você

- Aprovar este documento ou pedir ajustes (principalmente os itens 4.1 a 4.3).
- Criar a conta no Netlify e conectar o repositório (guia será escrito na Etapa 17; só necessário para publicar).
- Informar o e-mail que será o Super Admin; você cria a conta pelo login do app (quando existir) e eu marco a flag por SQL.
