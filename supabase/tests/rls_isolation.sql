-- BarberFlow — teste de isolamento, permissões e reservas (Etapa 2)
-- Como rodar: execute no SQL Editor do Supabase (ou via MCP execute_sql).
-- O script cria dados fictícios, verifica tudo e termina com um erro proposital
-- "REPORT [...]", que desfaz a transação inteira. Nenhum dado fica no banco.
-- Sucesso = todos os itens do relatório com "ok": true.

do $$
declare
  adm uuid := gen_random_uuid(); oa uuid := gen_random_uuid(); ob uuid := gen_random_uuid();
  b1 uuid := gen_random_uuid(); b2 uuid := gen_random_uuid(); c1 uuid := gen_random_uuid(); c2 uuid := gen_random_uuid();
  plan uuid; shopA uuid; shopB uuid; tokA text; tokB text; tok text;
  svc uuid; profA1 uuid; custA uuid; day date; slot timestamptz; slot2 timestamptz; apt uuid; apt2 uuid;
  n int; r jsonb; res jsonb := '[]'; st text; sid uuid; base_shops int;
begin
  select count(*) into base_shops from public.barbershops; -- o teste funciona com dados reais já no banco
  insert into auth.users (id, aud, role, email, raw_user_meta_data) values
    (adm,'authenticated','authenticated','adm@t.test','{"full_name":"Admin"}'),
    (oa,'authenticated','authenticated','oa@t.test','{"full_name":"Dono A"}'),
    (ob,'authenticated','authenticated','ob@t.test','{"full_name":"Dono B"}'),
    (b1,'authenticated','authenticated','b1@t.test','{"full_name":"Barbeiro 1"}'),
    (b2,'authenticated','authenticated','b2@t.test','{"full_name":"Barbeiro 2"}'),
    (c1,'authenticated','authenticated','c1@t.test','{"full_name":"Cliente 1","phone":"11911111111"}'),
    (c2,'authenticated','authenticated','c2@t.test','{"full_name":"Cliente 2"}');
  update public.profiles set is_super_admin = true where id = adm;
  insert into public.plans(name, price_cents) values ('Basico-teste', 4900) returning id into plan;
  day := (now() at time zone 'America/Sao_Paulo')::date + 1;

  -- admin cria barbearias
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',adm,'email','adm@t.test')::text, true); set local role authenticated;
  r := public.admin_create_barbershop('Barbearia A','barbearia-a','Dono A','oa@t.test','11999999999',plan);
  shopA := (r->>'barbershop_id')::uuid; tokA := r->>'owner_invitation_token';
  r := public.admin_create_barbershop('Barbearia B','barbearia-b','Dono B','ob@t.test',null,plan);
  shopB := (r->>'barbershop_id')::uuid; tokB := r->>'owner_invitation_token';

  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  perform public.accept_invitation(tokA);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ob,'email','ob@t.test')::text, true); set local role authenticated;
  perform public.accept_invitation(tokB);

  -- dono A configura a barbearia e convida barbeiros
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  insert into public.services(barbershop_id,name,price_cents,duration_minutes) values (shopA,'Corte',5000,30) returning id into svc;
  insert into public.professionals(barbershop_id, display_name) values (shopA,'Joao') returning id into profA1;
  insert into public.professional_services(professional_id, service_id, barbershop_id) values (profA1, svc, shopA);
  insert into public.schedules(barbershop_id, weekday, start_time, end_time) select shopA, d, '09:00', '18:00' from generate_series(0,6) d;
  tok := public.create_invitation(shopA, 'b2@t.test');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',b2,'email','b2@t.test')::text, true); set local role authenticated;
  perform public.accept_invitation(tok);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  tok := public.create_invitation(shopA, 'b1@t.test', profA1);
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',b1,'email','b1@t.test')::text, true); set local role authenticated;
  perform public.accept_invitation(tok);
  reset role;
  select count(*) into n from public.professionals where user_id = b1 and id = profA1;
  res := res || jsonb_build_array(jsonb_build_object('t','convite vincula b1 ao profissional existente','ok', n=1));
  select count(*) into n from public.memberships where role = 'barber' and barbershop_id = shopA;
  res := res || jsonb_build_array(jsonb_build_object('t','2 barbeiros vinculados à A','ok', n=2,'n',n));

  -- slots e reservas (09:00-18:00, serviço 30 min, passo 15 => 35 inícios; reservar 09:00 remove 2)
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',c1,'email','c1@t.test')::text, true); set local role authenticated;
  select min(starts_at) into slot from public.get_available_slots(shopA, profA1, svc, day);
  select count(*) into n from public.get_available_slots(shopA, profA1, svc, day);
  res := res || jsonb_build_array(jsonb_build_object('t','slots disponíveis (35)', 'ok', n = 35, 'n', n));
  apt := public.create_appointment(shopA, profA1, svc, slot);
  select count(*) into n from public.get_available_slots(shopA, profA1, svc, day);
  res := res || jsonb_build_array(jsonb_build_object('t','slots após reserva (33)', 'ok', n = 33, 'n', n));

  reset role; perform set_config('request.jwt.claims', json_build_object('sub',c2,'email','c2@t.test')::text, true); set local role authenticated;
  begin
    perform public.create_appointment(shopA, profA1, svc, slot);
    res := res || jsonb_build_array(jsonb_build_object('t','reserva dupla rejeitada','ok',false));
  exception when others then
    res := res || jsonb_build_array(jsonb_build_object('t','reserva dupla rejeitada','ok',sqlerrm='slot_unavailable','err',sqlerrm));
  end;

  -- sobreposição direta: a constraint de exclusão é a garantia final contra reservas simultâneas
  reset role;
  select id into custA from public.customers where profile_id = c1 and barbershop_id = shopA;
  begin
    insert into public.appointments(barbershop_id,customer_id,professional_id,service_id,starts_at,ends_at,price_cents)
    values (shopA, custA, profA1, svc, slot + interval '10 minutes', slot + interval '40 minutes', 5000);
    res := res || jsonb_build_array(jsonb_build_object('t','constraint bloqueia sobreposição','ok',false));
  exception when exclusion_violation then
    res := res || jsonb_build_array(jsonb_build_object('t','constraint bloqueia sobreposição','ok',true));
  end;

  reset role; perform set_config('request.jwt.claims', json_build_object('sub',c2,'email','c2@t.test')::text, true); set local role authenticated;
  select min(starts_at) into slot2 from public.get_available_slots(shopA, profA1, svc, day);
  apt2 := public.create_appointment(shopA, profA1, svc, slot2);
  perform public.cancel_my_appointment(apt2);
  select status::text into st from public.appointments where id = apt2;
  res := res || jsonb_build_array(jsonb_build_object('t','cliente cancela a própria reserva','ok', st='cancelled', 'st', st));
  select count(*) into n from public.appointments;
  res := res || jsonb_build_array(jsonb_build_object('t','c2 vê só as próprias reservas (1)','ok', n=1,'n',n));
  select count(*) into n from public.customers;
  res := res || jsonb_build_array(jsonb_build_object('t','c2 vê só o próprio cadastro de cliente (1)','ok', n=1,'n',n));
  begin
    perform public.cancel_my_appointment(apt);
    res := res || jsonb_build_array(jsonb_build_object('t','c2 não cancela reserva alheia','ok',false));
  exception when others then
    res := res || jsonb_build_array(jsonb_build_object('t','c2 não cancela reserva alheia','ok',sqlerrm='not_found'));
  end;

  -- barbeiros
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',b2,'email','b2@t.test')::text, true); set local role authenticated;
  select count(*) into n from public.appointments;
  res := res || jsonb_build_array(jsonb_build_object('t','b2 não vê agenda do b1 (0)','ok', n=0,'n',n));
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',b1,'email','b1@t.test')::text, true); set local role authenticated;
  select count(*) into n from public.appointments where status='scheduled';
  res := res || jsonb_build_array(jsonb_build_object('t','b1 vê os próprios atendimentos (1)','ok', n=1,'n',n));
  select count(*) into n from public.customers;
  res := res || jsonb_build_array(jsonb_build_object('t','b1 vê só clientes agendados com ele (2)','ok', n=2,'n',n));
  begin
    update public.appointments set price_cents = 1 where id = apt;
    res := res || jsonb_build_array(jsonb_build_object('t','b1 não altera preço','ok',false));
  exception when others then
    res := res || jsonb_build_array(jsonb_build_object('t','b1 não altera preço','ok',true,'err',sqlerrm));
  end;
  begin
    update public.appointments set starts_at = starts_at + interval '1 hour' where id = apt;
    res := res || jsonb_build_array(jsonb_build_object('t','b1 não remarca horário','ok',false));
  exception when others then
    res := res || jsonb_build_array(jsonb_build_object('t','b1 não remarca horário','ok',true,'err',sqlerrm));
  end;
  update public.appointments set status='completed' where id = apt;
  select count(*) into n from public.transactions;
  res := res || jsonb_build_array(jsonb_build_object('t','b1 lê só a própria receita (1: a do atendimento concluído)','ok', n=1,'n',n));
  select count(*) into n from public.transactions where type = 'expense';
  res := res || jsonb_build_array(jsonb_build_object('t','b1 não lê despesas (0)','ok', n=0,'n',n));
  select count(*) into n from public.professional_commissions;
  res := res || jsonb_build_array(jsonb_build_object('t','b1 lê só a própria comissão (<=1)','ok', n<=1,'n',n));

  -- dono A
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  select count(*) into n from public.transactions where appointment_id = apt and amount_cents = 5000;
  res := res || jsonb_build_array(jsonb_build_object('t','conclusão gera receita (1)','ok', n=1,'n',n));
  begin
    update public.memberships set role = 'owner' where barbershop_id = shopA and role = 'barber';
    res := res || jsonb_build_array(jsonb_build_object('t','dono não promove barbeiro a owner','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','dono não promove barbeiro a owner','ok',true,'err',sqlerrm)); end;
  begin
    update public.profiles set is_super_admin = true where id = oa;
    res := res || jsonb_build_array(jsonb_build_object('t','usuário não vira super admin','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','usuário não vira super admin','ok',true,'err',sqlerrm)); end;

  -- dono B: isolamento entre barbearias
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',ob,'email','ob@t.test')::text, true); set local role authenticated;
  select (select count(*) from public.customers) + (select count(*) from public.appointments) + (select count(*) from public.transactions)
       + (select count(*) from public.memberships where barbershop_id = shopA) + (select count(*) from public.invitations where barbershop_id = shopA)
       + (select count(*) from public.schedules where barbershop_id = shopA) + (select count(*) from public.subscriptions where barbershop_id = shopA) into n;
  res := res || jsonb_build_array(jsonb_build_object('t','dono B não vê dados administrativos da A (0)','ok', n=0,'n',n));
  begin
    insert into public.appointments(barbershop_id,customer_id,professional_id,service_id,starts_at,ends_at,price_cents)
    values (shopA, custA, profA1, svc, slot + interval '5 hours', slot + interval '6 hours', 1);
    res := res || jsonb_build_array(jsonb_build_object('t','dono B não cria reserva na A','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','dono B não cria reserva na A','ok',true,'err',sqlerrm)); end;
  begin
    insert into public.appointments(barbershop_id,customer_id,professional_id,service_id,starts_at,ends_at,price_cents)
    values (shopB, custA, profA1, svc, slot + interval '5 hours', slot + interval '6 hours', 1);
    res := res || jsonb_build_array(jsonb_build_object('t','FK composta bloqueia mistura de tenants','ok',false));
  exception when foreign_key_violation then res := res || jsonb_build_array(jsonb_build_object('t','FK composta bloqueia mistura de tenants','ok',true));
            when others then res := res || jsonb_build_array(jsonb_build_object('t','FK composta bloqueia mistura de tenants','ok',false,'err',sqlerrm)); end;
  begin
    perform public.create_invitation(shopA, 'x@t.test');
    res := res || jsonb_build_array(jsonb_build_object('t','dono B não convida na A','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','dono B não convida na A','ok',sqlstate='42501')); end;

  -- convites
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',c2,'email','c2@t.test')::text, true); set local role authenticated;
  begin perform public.accept_invitation(tokB); res := res || jsonb_build_array(jsonb_build_object('t','convite usado não reutilizável','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','convite usado não reutilizável','ok',sqlerrm='invalid_invitation')); end;
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  tok := public.create_invitation(shopA, 'someone@t.test');
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',c2,'email','c2@t.test')::text, true); set local role authenticated;
  begin perform public.accept_invitation(tok); res := res || jsonb_build_array(jsonb_build_object('t','convite com e-mail diferente rejeitado','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','convite com e-mail diferente rejeitado','ok',sqlerrm='email_mismatch')); end;

  -- super admin: sem acesso silencioso
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',adm,'email','adm@t.test')::text, true); set local role authenticated;
  select (select count(*) from public.customers) + (select count(*) from public.appointments) + (select count(*) from public.transactions) into n;
  res := res || jsonb_build_array(jsonb_build_object('t','super admin sem sessão não vê dados de negócio (0)','ok', n=0,'n',n));
  sid := public.admin_open_support_session(shopA, 'chamado de suporte teste');
  select count(*) into n from public.customers;
  res := res || jsonb_build_array(jsonb_build_object('t','com sessão aberta vê clientes da A (2)','ok', n=2,'n',n));
  select count(*) into n from public.customers where barbershop_id = shopB;
  res := res || jsonb_build_array(jsonb_build_object('t','sessão da A não abre a B (0)','ok', n=0,'n',n));
  select count(*) into n from public.audit_logs where action = 'support.open' and barbershop_id = shopA;
  res := res || jsonb_build_array(jsonb_build_object('t','abertura de suporte auditada (1)','ok', n=1,'n',n));
  perform public.admin_close_support_session(sid);
  select count(*) into n from public.customers;
  res := res || jsonb_build_array(jsonb_build_object('t','sessão encerrada fecha o acesso (0)','ok', n=0,'n',n));
  r := public.master_stats();
  res := res || jsonb_build_array(jsonb_build_object('t','master_stats funciona','ok', (r->>'barbershops_total')::int = base_shops + 2));
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  begin perform public.master_stats(); res := res || jsonb_build_array(jsonb_build_object('t','dono não chama master_stats','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','dono não chama master_stats','ok',sqlstate='42501')); end;

  -- anônimo
  reset role; perform set_config('request.jwt.claims', '{}', true); set local role anon;
  begin perform 1 from public.customers; res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a customers','ok',false));
  exception when insufficient_privilege then res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a customers','ok',true)); end;
  begin perform 1 from public.appointments; res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a appointments','ok',false));
  exception when insufficient_privilege then res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a appointments','ok',true)); end;
  begin perform contact_email from public.barbershops; res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a contact_email','ok',false));
  exception when insufficient_privilege then res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a contact_email','ok',true)); end;
  begin perform user_id from public.professionals; res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a professionals.user_id','ok',false));
  exception when insufficient_privilege then res := res || jsonb_build_array(jsonb_build_object('t','anon sem acesso a professionals.user_id','ok',true)); end;
  select count(*) into n from public.barbershops;
  res := res || jsonb_build_array(jsonb_build_object('t','anon lista barbearias ativas','ok', n = base_shops + 2,'n',n));
  select count(*) into n from public.get_available_slots(shopA, profA1, svc, day);
  res := res || jsonb_build_array(jsonb_build_object('t','anon consulta horários (>0)','ok', n>0,'n',n));
  begin perform public.create_appointment(shopA, profA1, svc, slot2); res := res || jsonb_build_array(jsonb_build_object('t','anon não reserva','ok',false));
  exception when insufficient_privilege then res := res || jsonb_build_array(jsonb_build_object('t','anon não reserva','ok',true)); end;
  begin perform public.master_stats(); res := res || jsonb_build_array(jsonb_build_object('t','anon não chama master_stats','ok',false));
  exception when insufficient_privilege then res := res || jsonb_build_array(jsonb_build_object('t','anon não chama master_stats','ok',true)); end;

  -- suspensão manual da mensalidade
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',adm,'email','adm@t.test')::text, true); set local role authenticated;
  perform public.admin_set_subscription_status(shopA, 'suspended');
  reset role; perform set_config('request.jwt.claims', '{}', true); set local role anon;
  select count(*) into n from public.barbershops;
  res := res || jsonb_build_array(jsonb_build_object('t','barbearia suspensa some da vitrine pública','ok', n = base_shops + 1,'n',n));
  select count(*) into n from public.get_available_slots(shopA, profA1, svc, day);
  res := res || jsonb_build_array(jsonb_build_object('t','suspensa não oferece horários (0)','ok', n=0,'n',n));
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',oa,'email','oa@t.test')::text, true); set local role authenticated;
  select count(*) into n from public.appointments;
  res := res || jsonb_build_array(jsonb_build_object('t','dono da suspensa perde acesso aos dados (0)','ok', n=0,'n',n));
  reset role; perform set_config('request.jwt.claims', json_build_object('sub',c1,'email','c1@t.test')::text, true); set local role authenticated;
  begin perform public.create_appointment(shopA, profA1, svc, slot2); res := res || jsonb_build_array(jsonb_build_object('t','cliente não reserva em suspensa','ok',false));
  exception when others then res := res || jsonb_build_array(jsonb_build_object('t','cliente não reserva em suspensa','ok',sqlerrm='barbershop_unavailable')); end;

  reset role;
  raise exception 'REPORT %', jsonb_pretty(res);
end $$;
