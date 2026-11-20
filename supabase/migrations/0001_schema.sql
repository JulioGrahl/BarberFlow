-- BarberFlow — 0001: extensões, tipos, tabelas, índices e restrições
-- Convenção: dinheiro em centavos (integer); datas/horas em timestamptz (UTC).

create extension if not exists btree_gist with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;

-- ---------------------------------------------------------------- tipos
create type public.member_role as enum ('owner', 'barber');
create type public.member_status as enum ('active', 'suspended');
create type public.subscription_status as enum ('active', 'pending', 'overdue', 'suspended', 'cancelled');
create type public.appointment_status as enum ('scheduled', 'completed', 'no_show', 'cancelled');
create type public.transaction_type as enum ('income', 'expense');
create type public.notification_status as enum ('pending', 'sent', 'dismissed');

-- ---------------------------------------------------------------- profiles
create table public.profiles (
  id             uuid primary key references auth.users (id) on delete cascade,
  email          text not null,
  full_name      text not null default '',
  phone          text,
  is_super_admin boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------- plans
create table public.plans (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  price_cents       integer not null check (price_cents >= 0),
  max_professionals integer check (max_professionals is null or max_professionals > 0),
  active            boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------- barbershops
create table public.barbershops (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) between 3 and 60),
  name               text not null check (char_length(name) between 2 and 120),
  phone              text,
  contact_name       text,
  contact_email      text,
  timezone           text not null default 'America/Sao_Paulo',
  cancel_min_hours   integer not null default 2 check (cancel_min_hours >= 0),
  slot_step_minutes  integer not null default 15 check (slot_step_minutes between 5 and 120),
  created_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------- subscriptions / payments (mensalidade manual)
create table public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null unique references public.barbershops (id) on delete cascade,
  plan_id       uuid references public.plans (id),
  price_cents   integer not null default 0 check (price_cents >= 0),
  status        public.subscription_status not null default 'pending',
  started_on    date not null default current_date,
  due_on        date not null default (current_date + 30),
  created_at    timestamptz not null default now()
);

create table public.payments (
  id              uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.subscriptions (id) on delete cascade,
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  amount_cents    integer not null check (amount_cents > 0),
  paid_on         date not null default current_date,
  reference_month date not null,
  note            text,
  recorded_by     uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index payments_barbershop_idx on public.payments (barbershop_id, paid_on desc);

-- ---------------------------------------------------------------- memberships / invitations
create table public.memberships (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  role          public.member_role not null,
  status        public.member_status not null default 'active',
  permissions   jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now(),
  unique (user_id, barbershop_id, role)
);
create index memberships_shop_idx on public.memberships (barbershop_id);

-- ---------------------------------------------------------------- customers
create table public.customers (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  profile_id    uuid references public.profiles (id) on delete set null,
  full_name     text not null,
  phone         text,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (id, barbershop_id),
  unique (barbershop_id, profile_id)
);
create index customers_profile_idx on public.customers (profile_id);

-- ---------------------------------------------------------------- professionals
create table public.professionals (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  user_id       uuid references public.profiles (id) on delete set null,
  display_name  text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (id, barbershop_id),
  unique (barbershop_id, user_id)
);
create index professionals_user_idx on public.professionals (user_id);

create table public.professional_commissions (
  professional_id uuid primary key references public.professionals (id) on delete cascade,
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  percent         numeric(5,2) not null default 0 check (percent between 0 and 100)
);

-- convites (o token em si nunca é guardado, só o hash)
create table public.invitations (
  id              uuid primary key default gen_random_uuid(),
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  professional_id uuid references public.professionals (id) on delete cascade,
  email           text,
  role            public.member_role not null,
  token_hash      text not null unique,
  expires_at      timestamptz not null,
  accepted_at     timestamptz,
  accepted_by     uuid references public.profiles (id),
  revoked_at      timestamptz,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index invitations_shop_idx on public.invitations (barbershop_id);

-- ---------------------------------------------------------------- services
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  barbershop_id    uuid not null references public.barbershops (id) on delete cascade,
  name             text not null,
  description      text,
  price_cents      integer not null check (price_cents >= 0),
  duration_minutes integer not null check (duration_minutes between 5 and 480),
  active           boolean not null default true,
  created_at       timestamptz not null default now(),
  unique (id, barbershop_id)
);
create index services_shop_idx on public.services (barbershop_id);

create table public.professional_services (
  professional_id uuid not null,
  service_id      uuid not null,
  barbershop_id   uuid not null,
  primary key (professional_id, service_id),
  foreign key (professional_id, barbershop_id) references public.professionals (id, barbershop_id) on delete cascade,
  foreign key (service_id, barbershop_id) references public.services (id, barbershop_id) on delete cascade
);

-- ---------------------------------------------------------------- schedules / blocked_times
-- professional_id nulo = horário de funcionamento da barbearia
create table public.schedules (
  id              uuid primary key default gen_random_uuid(),
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  professional_id uuid,
  weekday         smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time      time not null,
  end_time        time not null,
  break_start     time,
  break_end       time,
  foreign key (professional_id, barbershop_id) references public.professionals (id, barbershop_id) on delete cascade,
  check (end_time > start_time),
  check ((break_start is null) = (break_end is null)),
  check (break_start is null or (break_end > break_start and break_start >= start_time and break_end <= end_time))
);
create unique index schedules_unique_idx
  on public.schedules (barbershop_id, coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid), weekday);

create table public.blocked_times (
  id              uuid primary key default gen_random_uuid(),
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  professional_id uuid,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  reason          text,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  foreign key (professional_id, barbershop_id) references public.professionals (id, barbershop_id) on delete cascade,
  check (ends_at > starts_at)
);
create index blocked_times_idx on public.blocked_times (barbershop_id, starts_at);

-- ---------------------------------------------------------------- appointments
create table public.appointments (
  id              uuid primary key default gen_random_uuid(),
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  customer_id     uuid not null,
  professional_id uuid not null,
  service_id      uuid not null,
  starts_at       timestamptz not null,
  ends_at         timestamptz not null,
  status          public.appointment_status not null default 'scheduled',
  price_cents     integer not null check (price_cents >= 0),
  notes           text,
  created_by      uuid references public.profiles (id),
  cancelled_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (id, barbershop_id),
  foreign key (customer_id, barbershop_id) references public.customers (id, barbershop_id),
  foreign key (professional_id, barbershop_id) references public.professionals (id, barbershop_id),
  foreign key (service_id, barbershop_id) references public.services (id, barbershop_id),
  check (ends_at > starts_at),
  -- garantia final contra reserva dupla, inclusive em requisições simultâneas
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at) with &&
  ) where (status in ('scheduled', 'completed'))
);
create index appointments_shop_time_idx on public.appointments (barbershop_id, starts_at);
create index appointments_prof_time_idx on public.appointments (professional_id, starts_at);
create index appointments_customer_idx on public.appointments (customer_id);

-- ---------------------------------------------------------------- transactions (financeiro)
create table public.transactions (
  id              uuid primary key default gen_random_uuid(),
  barbershop_id   uuid not null references public.barbershops (id) on delete cascade,
  type            public.transaction_type not null,
  category        text not null default 'geral',
  amount_cents    integer not null check (amount_cents > 0),
  description     text,
  occurred_on     date not null default current_date,
  appointment_id  uuid unique references public.appointments (id) on delete set null,
  professional_id uuid,
  created_by      uuid references public.profiles (id),
  created_at      timestamptz not null default now(),
  foreign key (professional_id, barbershop_id) references public.professionals (id, barbershop_id)
);
create index transactions_shop_date_idx on public.transactions (barbershop_id, occurred_on desc);

-- ---------------------------------------------------------------- notifications (lembretes wa.me)
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  barbershop_id  uuid not null references public.barbershops (id) on delete cascade,
  customer_id    uuid,
  appointment_id uuid references public.appointments (id) on delete cascade,
  kind           text not null check (kind in ('confirmation', 'reminder', 'cancellation', 'change', 'reactivation')),
  message        text not null,
  status         public.notification_status not null default 'pending',
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  foreign key (customer_id, barbershop_id) references public.customers (id, barbershop_id) on delete cascade
);
create index notifications_shop_idx on public.notifications (barbershop_id, status);

-- ---------------------------------------------------------------- suporte e auditoria
create table public.support_sessions (
  id            uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops (id) on delete cascade,
  admin_id      uuid not null references public.profiles (id),
  reason        text not null check (char_length(reason) >= 5),
  started_at    timestamptz not null default now(),
  expires_at    timestamptz not null,
  ended_at      timestamptz
);
create index support_sessions_idx on public.support_sessions (barbershop_id, admin_id);

create table public.audit_logs (
  id            bigint generated always as identity primary key,
  actor_id      uuid references public.profiles (id),
  barbershop_id uuid references public.barbershops (id) on delete set null,
  action        text not null,
  entity        text,
  entity_id     text,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index audit_logs_shop_idx on public.audit_logs (barbershop_id, created_at desc);
