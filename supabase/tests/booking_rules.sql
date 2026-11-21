-- Regras de agendamento (encaixe, remarcação, faltas, bloqueio). Rode no SQL Editor; termina com um erro de propósito
-- ("RESULTADO: ...") para desfazer tudo. Ajuste os UUIDs abaixo para o seu banco de teste.
-- Esperado: todas as entradas com "ok".
do $t$
declare
  shop uuid := '5cead2de-6766-46d3-af37-1a7d674ffcd2';       -- barbearia de teste
  owner_id uuid := 'f8476c89-a752-433e-bbf9-78403020d3fd';    -- dono
  barber_id uuid := '7d6ed12b-1a7a-4ddb-992f-d31a408a8509';   -- barbeiro (vinculado ao profissional abaixo)
  cu uuid := '38a16e0f-7119-4ec9-8bdf-1e90bf5be2d9';         -- usuário sem papel na barbearia (cliente)
  joao uuid := '41250465-36d8-4626-b88d-ca948ae272cb';        -- profissional do barbeiro
  svc uuid := '4b58ed3a-cedb-4f8b-a7f3-1506cab48c7a';         -- serviço que o profissional faz
  fut uuid; a1 uuid; a2 uuid; c1 uuid; slot timestamptz; res text := ''; n int; cnt bigint; marcos uuid;
begin
  select id into marcos from professionals where barbershop_id=shop and id <> joao and active limit 1;
  insert into customers(barbershop_id, profile_id, full_name) values (shop, cu, 'Cliente teste') returning id into c1;
  insert into appointments(barbershop_id, customer_id, professional_id, service_id, starts_at, ends_at, price_cents)
    values (shop, c1, joao, svc, now() + interval '3 days', now() + interval '3 days' + interval '30 min', 4000) returning id into fut;

  -- concluir/faltar antes do horário é recusado (dono e barbeiro)
  perform set_config('request.jwt.claims', json_build_object('sub', owner_id, 'role','authenticated')::text, true); set local role authenticated;
  begin update appointments set status='completed' where id=fut; res := res||'A:FALHOU; '; exception when others then res := res||'A:ok('||sqlerrm||'); '; end; reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', barber_id, 'role','authenticated')::text, true); set local role authenticated;
  begin update appointments set status='no_show' where id=fut; res := res||'B:FALHOU; '; exception when others then res := res||'B:ok('||sqlerrm||'); '; end;

  -- encaixe: barbeiro cria para si, mesmo WhatsApp reaproveita cliente, não cria para outro profissional
  a1 := public.staff_create_appointment(shop, joao, svc, now() + interval '5 days', 'Cliente Balcão', '(47) 99999-1234', null); res := res||'C:ok; ';
  a2 := public.staff_create_appointment(shop, joao, svc, now() + interval '5 days 2 hours', 'Outro Nome', '47999991234');
  select count(*) into n from customers where barbershop_id=shop and regexp_replace(coalesce(phone,''),'\D','','g')='47999991234'; res := res||'D:'||case when n=1 then 'ok' else 'FALHOU' end||'; ';
  if marcos is not null then
    begin perform public.staff_create_appointment(shop, marcos, svc, now() + interval '6 days', 'Fulano'); res := res||'E:FALHOU; '; exception when others then res := res||'E:ok('||sqlerrm||'); '; end;
  end if;
  begin perform public.staff_create_appointment(shop, joao, svc, now() + interval '5 days 10 minutes', 'Fulano'); res := res||'F:FALHOU; '; exception when others then res := res||'F:ok('||sqlerrm||'); '; end;
  begin perform public.reschedule_appointment(a1, now() + interval '5 days 3 hours'); res := res||'H:ok; '; exception when others then res := res||'H:ERRO('||sqlerrm||'); '; end;
  reset role;

  -- cliente: só remarca o próprio, apenas para horário oferecido; não cria encaixe
  select s.starts_at into slot from public.get_available_slots(shop, joao, svc, (now() + interval '8 days')::date) s order by 1 limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role','authenticated')::text, true); set local role authenticated;
  begin perform public.reschedule_appointment(fut, slot); res := res||'K1:ok; '; exception when others then res := res||'K1:ERRO('||sqlerrm||'); '; end;
  begin perform public.reschedule_appointment(a1, slot); res := res||'K2:FALHOU(mexeu no de outro); '; exception when others then res := res||'K2:ok('||sqlerrm||'); '; end;
  begin perform public.staff_create_appointment(shop, joao, svc, now() + interval '7 days', 'Fulano'); res := res||'K3:FALHOU; '; exception when others then res := res||'K3:ok('||sqlerrm||'); '; end;
  reset role;
  set local role anon;
  begin perform public.reschedule_appointment(fut, slot); res := res||'L:FALHOU; '; exception when others then res := res||'L:ok; '; end; reset role;

  -- faltas: limite 1 bloqueia quem já tem 1 falta nos últimos 90 dias; bloqueio manual do dono; barbeiro não mexe
  insert into appointments(barbershop_id, customer_id, professional_id, service_id, starts_at, ends_at, status, price_cents)
    values (shop, c1, joao, svc, now() - interval '10 days', now() - interval '10 days' + interval '30 min', 'no_show', 4000);
  update barbershops set no_show_limit = 1 where id = shop;
  perform set_config('request.jwt.claims', json_build_object('sub', cu, 'role','authenticated')::text, true); set local role authenticated;
  begin perform public.create_appointment(shop, joao, svc, slot); res := res||'M:FALHOU; '; exception when others then res := res||'M:ok('||sqlerrm||'); '; end; reset role;
  update barbershops set no_show_limit = null where id = shop;
  perform set_config('request.jwt.claims', json_build_object('sub', barber_id, 'role','authenticated')::text, true); set local role authenticated;
  update customers set booking_blocked = true where id = c1; get diagnostics n = row_count; res := res||'N:barbeiro bloqueia='||n||' (esperado 0); ';
  reset role;
  set local role anon;
  select count(*) into cnt from public.get_public_hours(shop); res := res||'O:horario publico anon='||cnt||'; '; reset role;

  raise exception 'RESULTADO: %', res;
end $t$;
