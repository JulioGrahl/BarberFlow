-- BarberFlow — 0004: grants mínimos

-- =============================================================== grants (mínimo necessário)
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

grant usage on schema private to anon, authenticated;
grant execute on all functions in schema private to anon, authenticated;

-- leitura pública
-- contact_name/contact_email existem na tabela mas NÃO são expostos (leitura pública da tabela)
grant select (id, slug, name, phone, timezone, cancel_min_hours, slot_step_minutes, created_at)
  on public.barbershops to anon, authenticated;
grant select (id, barbershop_id, display_name, active, created_at) on public.professionals to anon, authenticated;
grant select on public.services, public.professional_services to anon, authenticated;

-- leitura autenticada
grant select on public.profiles, public.plans, public.subscriptions, public.payments, public.memberships,
  public.customers, public.professional_commissions, public.schedules, public.blocked_times,
  public.appointments, public.transactions, public.notifications, public.support_sessions, public.audit_logs
  to authenticated;
grant select (id, barbershop_id, professional_id, email, invitee_name, role, expires_at, accepted_at, revoked_at, created_at)
  on public.invitations to authenticated;

-- escrita (restrita por colunas + RLS)
grant update (full_name, phone) on public.profiles to authenticated;
grant insert, update on public.plans to authenticated;
grant insert, update (plan_id, price_cents, due_on, status) on public.subscriptions to authenticated;
grant update (name, phone, cancel_min_hours, slot_step_minutes) on public.barbershops to authenticated;
grant update (status, permissions) on public.memberships to authenticated;
grant insert (barbershop_id, full_name, phone, notes), update (full_name, phone, notes) on public.customers to authenticated;
grant insert (barbershop_id, display_name, active), update (display_name, active) on public.professionals to authenticated;
grant insert, update, delete on public.professional_commissions to authenticated;
grant insert (barbershop_id, name, description, price_cents, duration_minutes, active),
      update (name, description, price_cents, duration_minutes, active) on public.services to authenticated;
grant insert, delete on public.professional_services to authenticated;
grant insert, update, delete on public.schedules, public.blocked_times to authenticated;
grant insert (barbershop_id, customer_id, professional_id, service_id, starts_at, ends_at, price_cents, notes),
      update (professional_id, service_id, starts_at, ends_at, status, price_cents, notes) on public.appointments to authenticated;
grant insert (barbershop_id, type, category, amount_cents, description, occurred_on, professional_id),
      update (type, category, amount_cents, description, occurred_on, professional_id),
      delete on public.transactions to authenticated;
grant insert (barbershop_id, customer_id, appointment_id, kind, message),
      update (message, status, sent_at) on public.notifications to authenticated;

-- RPCs
grant execute on function public.get_available_slots(uuid, uuid, uuid, date) to anon, authenticated;
grant execute on function public.get_invitation_preview(text) to anon, authenticated;
grant execute on function
  public.create_appointment(uuid, uuid, uuid, timestamptz, text),
  public.cancel_my_appointment(uuid),
  public.create_invitation(uuid, text, uuid),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.admin_create_barbershop(text, text, text, text, text, uuid, date, date),
  public.admin_update_barbershop(uuid, text, text, text),
  public.admin_set_subscription_status(uuid, public.subscription_status),
  public.admin_register_payment(uuid, int, date, date, text),
  public.admin_open_support_session(uuid, text),
  public.admin_close_support_session(uuid),
  public.master_stats()
  to authenticated;
