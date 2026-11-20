# BarberFlow — Políticas de acesso (RLS, grants e RPCs)

Fonte da verdade: `supabase/migrations/`. Teste automatizado: `supabase/tests/rls_isolation.sql`.

## Camadas de defesa
1. **Grants por coluna.** `anon` e `authenticated` começam sem nenhum privilégio (`revoke all`). Só recebem o mínimo. Exemplos: `professionals.user_id` e `barbershops.contact_*` não são legíveis pela API; `memberships.role` e `profiles.is_super_admin` não são atualizáveis.
2. **RLS em todas as tabelas.** Funções auxiliares em `private` (schema não exposto pela API) decidem quem é quem: `is_super_admin`, `has_membership`, `is_member` (vínculo + mensalidade liberada), `can_manage` (dono, ou super admin com sessão de suporte aberta), `is_my_professional`, `is_my_customer`.
3. **Triggers de guarda.** `profiles_guard` e `appointments_guard` restringem o que um usuário da API pode alterar (barbeiro só conclui ou marca ausência dos próprios atendimentos).
4. **Integridade entre barbearias.** Chaves estrangeiras compostas `(id, barbershop_id)` impedem ligar registros de barbearias diferentes (cliente da A em reserva da B, por exemplo).
5. **RPCs `SECURITY DEFINER`** para tudo que exige regra de negócio ou privilégio (reservar, cancelar, convites, painel master). Todas validam o chamador no início.

## Matriz resumida
| Tabela | anon | CUSTOMER | BARBER | OWNER | SUPER_ADMIN |
|---|---|---|---|---|---|
| barbershops | lê ativas (sem contato) | idem | idem + a própria | edita nome, telefone, regras | cria/edita via RPC; lê todas |
| services, professionals, professional_services | lê ativos | idem | lê serviços | CRUD (sem delete) | só com sessão de suporte |
| schedules, blocked_times | – | – | lê os próprios | CRUD | só com sessão de suporte |
| appointments | – | lê os próprios; cria/cancela por RPC | lê os próprios; só altera status (concluir/ausência) | CRUD (sem delete) | só com sessão de suporte |
| customers | – | lê o próprio | lê os agendados com ele | CRUD | só com sessão de suporte |
| transactions, notifications, commissions | – | – | – | CRUD | só com sessão de suporte |
| memberships | – | – | lê a própria | lê e edita status/permissões de barbeiros | lê |
| invitations | – | – | – | lê; cria/revoga por RPC (só barbeiros) | lê; convite do dono via RPC |
| plans, subscriptions, payments | – | lê planos | – | lê a própria assinatura/pagamentos | CRUD / RPCs |
| support_sessions, audit_logs | – | – | – | lê os da própria barbearia | lê tudo |

## Regras que merecem atenção
- **Mensalidade suspensa ou cancelada** tira de circulação a barbearia: some da vitrine pública, não oferece horários, e dono/barbeiros perdem acesso aos dados (`is_member` fica falso). O proprietário ainda enxerga a própria barbearia e a assinatura.
- **Super Admin não tem acesso silencioso.** Para ver dados de negócio de uma barbearia, precisa abrir uma sessão de suporte (`admin_open_support_session`, com motivo, validade de 2 h), que grava em `audit_logs` e fica visível ao dono. Dados da plataforma (planos, assinaturas, pagamentos, estatísticas) ele lê sem sessão.
- **Super Admin só existe por SQL.** `profiles.is_super_admin` não é gravável pela API nem pelo cadastro. Para promover alguém: `update public.profiles set is_super_admin = true where email = '...';` no SQL Editor.
- **Reserva dupla.** `create_appointment` valida o horário via `get_available_slots` e a constraint `appointments_no_overlap` (exclusão por profissional e intervalo) é a garantia final, inclusive em requisições simultâneas.
- **Convites.** Só o hash do token é gravado. O token aparece uma vez, para o proprietário copiar o link. O papel vem do convite; se o convite tem e-mail, a conta que aceitar precisa ter o mesmo e-mail.

## Avisos do linter do Supabase (aceitos)
`anon_security_definer_function_executable` (2) e `authenticated_security_definer_function_executable` (14) listam as RPCs expostas de propósito. Cada uma checa permissão internamente; o teste cobre os casos de negação. Nenhum aviso de tabela sem RLS.

## Pendências conhecidas
- As colunas `barbershops.contact_name` e `contact_email` ficaram sem uso e não expostas, porque o `DROP COLUMN` exige confirmação manual no MCP. Podem ser removidas depois com `alter table public.barbershops drop column contact_name, drop column contact_email;`.
- `profiles.email` não é sincronizado se o usuário trocar o e-mail em `auth.users`. Tratar quando existir tela de troca de e-mail.
- A confirmação de e-mail do Supabase Auth fica para a Etapa 4 (o envio gratuito é muito limitado); a decisão afeta a regra de e-mail dos convites.
