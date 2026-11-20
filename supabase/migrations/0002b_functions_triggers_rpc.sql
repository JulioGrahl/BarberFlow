-- BarberFlow — 0002b: funções auxiliares, triggers e RPCs


-- =============================================================== funções auxiliares (schema private, não exposto pela API)
create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_super_admin from public.profiles p where p.id = (select auth.uid())), false)
$$;

create function private.shop_active(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.subscriptions s
    where s.barbershop_id = p_shop and s.status not in ('suspended', 'cancelled')
  )
$$;

-- vínculo ativo, independente do status da mensalidade
create function private.has_membership(p_shop uuid, p_role public.member_role default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.user_id = (select auth.uid()) and m.barbershop_id = p_shop and m.status = 'active'
      and (p_role is null or m.role = p_role)
  )
$$;

-- vínculo ativo E barbearia com acesso liberado
create function private.is_member(p_shop uuid, p_role public.member_role default null) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.has_membership(p_shop, p_role) and private.shop_active(p_shop)
$$;

create function private.has_support_access(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_super_admin() and exists (
    select 1 from public.support_sessions ss
    where ss.barbershop_id = p_shop and ss.admin_id = (select auth.uid())
      and ss.ended_at is null and ss.expires_at > now()
  )
$$;

create function private.can_manage(p_shop uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_member(p_shop, 'owner') or private.has_support_access(p_shop)
$$;

create function private.is_my_professional(p_prof uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.professionals pr
    where pr.id = p_prof and pr.user_id = (select auth.uid()) and private.is_member(pr.barbershop_id, 'barber')
  )
$$;

create function private.is_my_customer(p_cust uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.customers c where c.id = p_cust and c.profile_id = (select auth.uid()))
$$;

create function private.barber_sees_customer(p_cust uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.appointments a
    join public.professionals pr on pr.id = a.professional_id and pr.barbershop_id = a.barbershop_id
    where a.customer_id = p_cust and pr.user_id = (select auth.uid()) and private.is_member(a.barbershop_id, 'barber')
  )
$$;

create function private.log_audit(p_shop uuid, p_action text, p_entity text, p_entity_id text, p_meta jsonb default '{}')
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_logs (actor_id, barbershop_id, action, entity, entity_id, metadata)
  values ((select auth.uid()), p_shop, p_action, p_entity, p_entity_id, coalesce(p_meta, '{}'::jsonb))
$$;

create function private.require_super_admin() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
end $$;

-- =============================================================== triggers
-- perfil criado automaticamente a partir do auth.users (papel nunca vem do cadastro)
create function private.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data ->> 'full_name', ''), nullif(new.raw_user_meta_data ->> 'phone', ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();

-- guardas rodam como o chamador (security invoker): SQL administrativo e RPCs definer passam; cliente da API é restringido
create function private.profiles_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if current_user in ('anon', 'authenticated') then
    if new.id <> old.id or new.email <> old.email or new.is_super_admin <> old.is_super_admin then
      raise exception 'protected_field' using errcode = '42501';
    end if;
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles
  for each row execute function private.profiles_guard();

create function private.appointments_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.status = 'cancelled' and old.status <> 'cancelled' then
    new.cancelled_at := now();
  end if;
  if current_user in ('anon', 'authenticated') then
    if new.barbershop_id <> old.barbershop_id then
      raise exception 'protected_field' using errcode = '42501';
    end if;
    if not private.can_manage(old.barbershop_id) then
      -- barbeiro: só pode concluir ou marcar ausência dos próprios atendimentos
      if not private.is_my_professional(old.professional_id)
         or old.status <> 'scheduled'
         or new.status not in ('completed', 'no_show')
         or (to_jsonb(new) - 'status' - 'cancelled_at') <> (to_jsonb(old) - 'status' - 'cancelled_at') then
        raise exception 'forbidden_update' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;
create trigger appointments_guard before update on public.appointments
  for each row execute function private.appointments_guard();

-- atendimento concluído gera a receita correspondente (e a remove se deixar de estar concluído)
create function private.appointment_financials() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status <> 'completed' and new.price_cents > 0 then
    insert into public.transactions
      (barbershop_id, type, category, amount_cents, description, occurred_on, appointment_id, professional_id, created_by)
    values (
      new.barbershop_id, 'income', 'servico', new.price_cents, 'Atendimento concluído',
      (new.starts_at at time zone (select b.timezone from public.barbershops b where b.id = new.barbershop_id))::date,
      new.id, new.professional_id, (select auth.uid())
    )
    on conflict (appointment_id) do nothing;
  elsif old.status = 'completed' and new.status <> 'completed' then
    delete from public.transactions where appointment_id = new.id;
  end if;
  return new;
end $$;
create trigger appointments_financials after update on public.appointments
  for each row execute function private.appointment_financials();

-- =============================================================== RPCs públicas (API)
-- horários livres de um profissional para um serviço em um dia (calendário local da barbearia)
create function public.get_available_slots(p_shop uuid, p_professional uuid, p_service uuid, p_day date)
returns table (starts_at timestamptz)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_tz text; v_step int; v_dur int; v_dow int;
  v_sh public.schedules%rowtype; v_pr public.schedules%rowtype;
  v_has_sh boolean; v_has_pr boolean;
  v_start time; v_end time;
  v_b1s time; v_b1e time; v_b2s time; v_b2e time;
begin
  if not private.shop_active(p_shop) then return; end if;
  select b.timezone, b.slot_step_minutes into v_tz, v_step from public.barbershops b where b.id = p_shop;
  select s.duration_minutes into v_dur from public.services s where s.id = p_service and s.barbershop_id = p_shop and s.active;
  if v_dur is null then return; end if;
  if not exists (
    select 1 from public.professionals pr
    join public.professional_services ps on ps.professional_id = pr.id
    where pr.id = p_professional and pr.barbershop_id = p_shop and pr.active and ps.service_id = p_service
  ) then return; end if;

  v_dow := extract(dow from p_day)::int;
  select * into v_sh from public.schedules where barbershop_id = p_shop and professional_id is null and weekday = v_dow;
  v_has_sh := found;
  select * into v_pr from public.schedules where barbershop_id = p_shop and professional_id = p_professional and weekday = v_dow;
  v_has_pr := found;
  if not v_has_sh and not v_has_pr then return; end if;

  -- janela efetiva = interseção entre horário da barbearia e do profissional (quando ambos existem)
  v_start := greatest(case when v_has_sh then v_sh.start_time end, case when v_has_pr then v_pr.start_time end);
  v_end   := least(case when v_has_sh then v_sh.end_time end, case when v_has_pr then v_pr.end_time end);
  if v_has_sh then v_b1s := v_sh.break_start; v_b1e := v_sh.break_end; end if;
  if v_has_pr then v_b2s := v_pr.break_start; v_b2e := v_pr.break_end; end if;
  if v_end <= v_start then return; end if;

  return query
  select g.slot
  from generate_series(
         (p_day + v_start) at time zone v_tz,
         ((p_day + v_end) at time zone v_tz) - make_interval(mins => v_dur),
         make_interval(mins => v_step)
       ) as g(slot)
  where g.slot > now()
    and not (v_b1s is not null and tstzrange(g.slot, g.slot + make_interval(mins => v_dur))
             && tstzrange((p_day + v_b1s) at time zone v_tz, (p_day + v_b1e) at time zone v_tz))
    and not (v_b2s is not null and tstzrange(g.slot, g.slot + make_interval(mins => v_dur))
             && tstzrange((p_day + v_b2s) at time zone v_tz, (p_day + v_b2e) at time zone v_tz))
    and not exists (
      select 1 from public.blocked_times bt
      where bt.barbershop_id = p_shop and (bt.professional_id is null or bt.professional_id = p_professional)
        and tstzrange(bt.starts_at, bt.ends_at) && tstzrange(g.slot, g.slot + make_interval(mins => v_dur)))
    and not exists (
      select 1 from public.appointments a
      where a.professional_id = p_professional and a.status in ('scheduled', 'completed')
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(g.slot, g.slot + make_interval(mins => v_dur)))
  order by g.slot;
end $$;

create function public.create_appointment(
  p_shop uuid, p_professional uuid, p_service uuid, p_starts_at timestamptz, p_notes text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_tz text; v_svc public.services%rowtype; v_prof public.profiles%rowtype;
  v_cust uuid; v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select b.timezone into v_tz from public.barbershops b where b.id = p_shop;
  if v_tz is null or not private.shop_active(p_shop) then raise exception 'barbershop_unavailable'; end if;
  select * into v_svc from public.services where id = p_service and barbershop_id = p_shop and active;
  if not found then raise exception 'service_unavailable'; end if;

  if not exists (
    select 1 from public.get_available_slots(p_shop, p_professional, p_service, (p_starts_at at time zone v_tz)::date) s
    where s.starts_at = p_starts_at
  ) then raise exception 'slot_unavailable'; end if;

  select * into v_prof from public.profiles where id = v_uid;
  insert into public.customers as c (barbershop_id, profile_id, full_name, phone)
  values (p_shop, v_uid, coalesce(nullif(v_prof.full_name, ''), v_prof.email), v_prof.phone)
  on conflict (barbershop_id, profile_id)
  do update set full_name = excluded.full_name, phone = coalesce(excluded.phone, c.phone)
  returning c.id into v_cust;

  begin
    insert into public.appointments
      (barbershop_id, customer_id, professional_id, service_id, starts_at, ends_at, status, price_cents, notes, created_by)
    values
      (p_shop, v_cust, p_professional, p_service, p_starts_at,
       p_starts_at + make_interval(mins => v_svc.duration_minutes), 'scheduled', v_svc.price_cents, left(p_notes, 500), v_uid)
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'slot_unavailable';
  end;
  return v_id;
end $$;

create function public.cancel_my_appointment(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_a public.appointments%rowtype; v_min int;
begin
  select a.* into v_a
  from public.appointments a
  join public.customers c on c.id = a.customer_id and c.barbershop_id = a.barbershop_id
  where a.id = p_id and c.profile_id = (select auth.uid()) and a.status = 'scheduled';
  if not found then raise exception 'not_found'; end if;
  select b.cancel_min_hours into v_min from public.barbershops b where b.id = v_a.barbershop_id;
  if v_a.starts_at - make_interval(hours => v_min) < now() then raise exception 'too_late_to_cancel'; end if;
  update public.appointments set status = 'cancelled' where id = p_id;
end $$;

-- convites ------------------------------------------------------------
create function public.create_invitation(p_shop uuid, p_email text default null, p_professional uuid default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid;
begin
  if not private.is_member(p_shop, 'owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_professional is not null and not exists (
    select 1 from public.professionals where id = p_professional and barbershop_id = p_shop and user_id is null
  ) then raise exception 'invalid_professional'; end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (barbershop_id, professional_id, email, role, token_hash, expires_at, created_by)
  values (p_shop, p_professional, nullif(lower(trim(p_email)), ''), 'barber',
          encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '7 days', (select auth.uid()))
  returning id into v_id;
  perform private.log_audit(p_shop, 'invitation.create', 'invitation', v_id::text, jsonb_build_object('role', 'barber'));
  return v_token; -- exibido uma única vez; só o hash fica no banco
end $$;

create function public.revoke_invitation(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  select barbershop_id into v_shop from public.invitations where id = p_id;
  if v_shop is null or not private.is_member(v_shop, 'owner') then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.invitations set revoked_at = now() where id = p_id and accepted_at is null and revoked_at is null;
  perform private.log_audit(v_shop, 'invitation.revoke', 'invitation', p_id::text);
end $$;

create function public.get_invitation_preview(p_token text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('barbershop_name', b.name, 'role', i.role, 'email', i.email, 'invitee_name', i.invitee_name)
  from public.invitations i
  join public.barbershops b on b.id = i.barbershop_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
$$;

create function public.accept_invitation(p_token text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_inv public.invitations%rowtype; v_slug text; v_prof public.profiles%rowtype;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode = '28000'; end if;
  select * into v_inv from public.invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex') for update;
  if not found or v_inv.accepted_at is not null or v_inv.revoked_at is not null or v_inv.expires_at <= now() then
    raise exception 'invalid_invitation';
  end if;
  if v_inv.email is not null and lower(v_inv.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    raise exception 'email_mismatch';
  end if;
  select * into v_prof from public.profiles where id = v_uid;

  insert into public.memberships (user_id, barbershop_id, role) values (v_uid, v_inv.barbershop_id, v_inv.role)
  on conflict (user_id, barbershop_id, role) do nothing;

  if v_inv.role = 'barber' then
    if v_inv.professional_id is not null then
      update public.professionals set user_id = v_uid
      where id = v_inv.professional_id and barbershop_id = v_inv.barbershop_id and user_id is null;
      if not found then raise exception 'invalid_invitation'; end if;
    else
      insert into public.professionals (barbershop_id, user_id, display_name)
      values (v_inv.barbershop_id, v_uid, coalesce(nullif(v_prof.full_name, ''), v_prof.email))
      on conflict (barbershop_id, user_id) do nothing;
    end if;
  end if;

  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;
  perform private.log_audit(v_inv.barbershop_id, 'invitation.accept', 'invitation', v_inv.id::text, jsonb_build_object('role', v_inv.role));
  select slug into v_slug from public.barbershops where id = v_inv.barbershop_id;
  return jsonb_build_object('slug', v_slug, 'role', v_inv.role);
end $$;

-- =============================================================== RPCs do Painel Master
create function public.admin_create_barbershop(
  p_name text, p_slug text, p_owner_name text, p_owner_email text, p_phone text,
  p_plan_id uuid, p_started_on date default current_date, p_due_on date default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid; v_price int := 0; v_token text;
begin
  perform private.require_super_admin();
  if p_plan_id is not null then select price_cents into v_price from public.plans where id = p_plan_id; end if;
  insert into public.barbershops (name, slug, phone) values (trim(p_name), lower(trim(p_slug)), p_phone) returning id into v_shop;
  insert into public.subscriptions (barbershop_id, plan_id, price_cents, status, started_on, due_on)
  values (v_shop, p_plan_id, coalesce(v_price, 0), 'active', p_started_on, coalesce(p_due_on, p_started_on + 30));
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (barbershop_id, email, invitee_name, role, token_hash, expires_at, created_by)
  values (v_shop, nullif(lower(trim(p_owner_email)), ''), p_owner_name, 'owner',
          encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '14 days', (select auth.uid()));
  perform private.log_audit(v_shop, 'barbershop.create', 'barbershop', v_shop::text, jsonb_build_object('slug', p_slug));
  return jsonb_build_object('barbershop_id', v_shop, 'owner_invitation_token', v_token);
end $$;

create function public.admin_update_barbershop(p_shop uuid, p_name text, p_slug text, p_phone text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_super_admin();
  update public.barbershops set name = trim(p_name), slug = lower(trim(p_slug)), phone = p_phone where id = p_shop;
  perform private.log_audit(p_shop, 'barbershop.update', 'barbershop', p_shop::text);
end $$;

create function public.admin_set_subscription_status(p_shop uuid, p_status public.subscription_status) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform private.require_super_admin();
  update public.subscriptions set status = p_status where barbershop_id = p_shop;
  if not found then raise exception 'not_found'; end if;
  perform private.log_audit(p_shop, 'subscription.status', 'subscription', p_shop::text, jsonb_build_object('status', p_status));
end $$;

create function public.admin_register_payment(
  p_shop uuid, p_amount_cents int, p_paid_on date, p_reference_month date, p_note text default null
) returns void
language plpgsql security definer set search_path = '' as $$
declare v_sub public.subscriptions%rowtype;
begin
  perform private.require_super_admin();
  select * into v_sub from public.subscriptions where barbershop_id = p_shop for update;
  if not found then raise exception 'not_found'; end if;
  insert into public.payments (subscription_id, barbershop_id, amount_cents, paid_on, reference_month, note, recorded_by)
  values (v_sub.id, p_shop, p_amount_cents, p_paid_on, date_trunc('month', p_reference_month)::date, p_note, (select auth.uid()));
  update public.subscriptions
  set status = 'active', due_on = (greatest(due_on, p_paid_on) + interval '1 month')::date
  where id = v_sub.id;
  perform private.log_audit(p_shop, 'payment.register', 'subscription', v_sub.id::text, jsonb_build_object('amount_cents', p_amount_cents));
end $$;

create function public.admin_open_support_session(p_shop uuid, p_reason text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.require_super_admin();
  if not exists (select 1 from public.barbershops where id = p_shop) then raise exception 'not_found'; end if;
  update public.support_sessions set ended_at = now()
  where barbershop_id = p_shop and admin_id = (select auth.uid()) and ended_at is null;
  insert into public.support_sessions (barbershop_id, admin_id, reason, expires_at)
  values (p_shop, (select auth.uid()), p_reason, now() + interval '2 hours') returning id into v_id;
  perform private.log_audit(p_shop, 'support.open', 'support_session', v_id::text, jsonb_build_object('reason', p_reason));
  return v_id;
end $$;

create function public.admin_close_support_session(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_shop uuid;
begin
  perform private.require_super_admin();
  update public.support_sessions set ended_at = now()
  where id = p_id and admin_id = (select auth.uid()) and ended_at is null returning barbershop_id into v_shop;
  if v_shop is not null then
    perform private.log_audit(v_shop, 'support.close', 'support_session', p_id::text);
  end if;
end $$;

create function public.master_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform private.require_super_admin();
  return jsonb_build_object(
    'barbershops_total',     (select count(*) from public.barbershops),
    'barbershops_active',    (select count(*) from public.subscriptions where status in ('active', 'pending', 'overdue')),
    'barbershops_suspended', (select count(*) from public.subscriptions where status in ('suspended', 'cancelled')),
    'users_total',           (select count(*) from public.profiles),
    'appointments_total',    (select count(*) from public.appointments),
    'received_this_month_cents', coalesce((select sum(amount_cents) from public.payments
                                           where paid_on >= date_trunc('month', current_date)), 0),
    'pending_cents',         coalesce((select sum(price_cents) from public.subscriptions where status in ('pending', 'overdue')), 0),
    'by_plan', coalesce((select jsonb_agg(jsonb_build_object('plan', coalesce(p.name, 'sem plano'), 'count', t.c))
                         from (select plan_id, count(*) c from public.subscriptions group by plan_id) t
                         left join public.plans p on p.id = t.plan_id), '[]'::jsonb)
  );
end $$;

