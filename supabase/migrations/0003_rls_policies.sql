-- BarberFlow — 0003: RLS e policies

-- =============================================================== RLS
alter table public.profiles                 enable row level security;
alter table public.plans                    enable row level security;
alter table public.barbershops              enable row level security;
alter table public.subscriptions            enable row level security;
alter table public.payments                 enable row level security;
alter table public.memberships              enable row level security;
alter table public.customers                enable row level security;
alter table public.professionals            enable row level security;
alter table public.professional_commissions enable row level security;
alter table public.invitations              enable row level security;
alter table public.services                 enable row level security;
alter table public.professional_services    enable row level security;
alter table public.schedules                enable row level security;
alter table public.blocked_times            enable row level security;
alter table public.appointments             enable row level security;
alter table public.transactions             enable row level security;
alter table public.notifications            enable row level security;
alter table public.support_sessions         enable row level security;
alter table public.audit_logs               enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or private.is_super_admin());
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- plans
create policy plans_select on public.plans for select to authenticated using (true);
create policy plans_admin_write on public.plans for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());

-- barbershops (leitura pública apenas de barbearias com acesso liberado)
create policy barbershops_select on public.barbershops for select to anon, authenticated
  using (private.shop_active(id) or private.has_membership(id) or private.is_super_admin());
create policy barbershops_update on public.barbershops for update to authenticated
  using (private.can_manage(id)) with check (private.can_manage(id));

-- subscriptions / payments
create policy subscriptions_select on public.subscriptions for select to authenticated
  using (private.is_super_admin() or private.has_membership(barbershop_id, 'owner'));
create policy subscriptions_admin_write on public.subscriptions for all to authenticated
  using (private.is_super_admin()) with check (private.is_super_admin());
create policy payments_select on public.payments for select to authenticated
  using (private.is_super_admin() or private.has_membership(barbershop_id, 'owner'));

-- memberships
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or private.can_manage(barbershop_id) or private.is_super_admin());
create policy memberships_update on public.memberships for update to authenticated
  using (private.can_manage(barbershop_id) and role = 'barber')
  with check (private.can_manage(barbershop_id) and role = 'barber');

-- invitations (escrita somente via RPC)
create policy invitations_select on public.invitations for select to authenticated
  using (private.can_manage(barbershop_id) or private.is_super_admin());

-- customers
create policy customers_select on public.customers for select to authenticated
  using (private.can_manage(barbershop_id) or profile_id = (select auth.uid()) or private.barber_sees_customer(id));
create policy customers_insert on public.customers for insert to authenticated
  with check (private.can_manage(barbershop_id));
create policy customers_update on public.customers for update to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));

-- professionals
create policy professionals_select on public.professionals for select to anon, authenticated
  using ((active and private.shop_active(barbershop_id)) or private.can_manage(barbershop_id) or private.is_my_professional(id));
create policy professionals_insert on public.professionals for insert to authenticated
  with check (private.can_manage(barbershop_id));
create policy professionals_update on public.professionals for update to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));

create policy commissions_all on public.professional_commissions for all to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));

-- services / professional_services
create policy services_select on public.services for select to anon, authenticated
  using ((active and private.shop_active(barbershop_id)) or private.can_manage(barbershop_id) or private.is_member(barbershop_id, 'barber'));
create policy services_insert on public.services for insert to authenticated
  with check (private.can_manage(barbershop_id));
create policy services_update on public.services for update to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));

create policy prof_services_select on public.professional_services for select to anon, authenticated
  using (private.shop_active(barbershop_id) or private.can_manage(barbershop_id));
create policy prof_services_insert on public.professional_services for insert to authenticated
  with check (private.can_manage(barbershop_id));
create policy prof_services_delete on public.professional_services for delete to authenticated
  using (private.can_manage(barbershop_id));

-- schedules / blocked_times
create policy schedules_select on public.schedules for select to authenticated
  using (private.can_manage(barbershop_id) or (professional_id is not null and private.is_my_professional(professional_id)));
create policy schedules_write on public.schedules for all to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));
create policy blocked_select on public.blocked_times for select to authenticated
  using (private.can_manage(barbershop_id) or (professional_id is not null and private.is_my_professional(professional_id)));
create policy blocked_write on public.blocked_times for all to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));

-- appointments (cliente cria/cancela via RPC; barbeiro só altera status, reforçado pelo trigger)
create policy appointments_select on public.appointments for select to authenticated
  using (private.can_manage(barbershop_id) or private.is_my_professional(professional_id) or private.is_my_customer(customer_id));
create policy appointments_insert on public.appointments for insert to authenticated
  with check (private.can_manage(barbershop_id));
create policy appointments_update on public.appointments for update to authenticated
  using (private.can_manage(barbershop_id) or private.is_my_professional(professional_id))
  with check (private.can_manage(barbershop_id) or private.is_my_professional(professional_id));

-- financeiro e lembretes: somente proprietário (ou suporte com sessão aberta)
create policy transactions_all on public.transactions for all to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));
create policy notifications_all on public.notifications for all to authenticated
  using (private.can_manage(barbershop_id)) with check (private.can_manage(barbershop_id));

-- suporte e auditoria (leitura apenas)
create policy support_select on public.support_sessions for select to authenticated
  using (private.is_super_admin() or private.has_membership(barbershop_id, 'owner'));
create policy audit_select on public.audit_logs for select to authenticated
  using (private.is_super_admin() or private.has_membership(barbershop_id, 'owner'));

