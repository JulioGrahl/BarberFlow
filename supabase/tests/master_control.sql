-- Master: insights por barbearia, implantação, bloquear/reativar, encerrar e excluir (só encerrada + slug).
-- Termina com RAISE EXCEPTION para reverter tudo; a mensagem "RESULT" traz o resumo.
-- Troque os UUIDs pelos da barbearia de teste (dono, super admin).
do $$
declare
  v_shop uuid := '5cead2de-6766-46d3-af37-1a7d674ffcd2';
  v_owner uuid := 'f8476c89-a752-433e-bbf9-78403020d3fd';
  v_admin uuid := '38a16e0f-7119-4ec9-8bdf-1e90bf5be2d9';
  i record; n int; b boolean; log text := ''; blocked_write boolean := false;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'email', 'juliograhl@gmail.com')::text, true);
  set local role authenticated;
  select * into i from public.admin_shop_insights() where shop_id = v_shop;
  if i.customers_total is null or i.customers_total < 1 then raise exception 'FAIL A: sem clientes nos insights'; end if;
  log := log || 'A ok; ';

  perform public.admin_set_setup_fee(v_shop, 100000);
  perform public.admin_register_payment(v_shop, 60000, current_date, current_date, 'teste', 'setup');
  select * into i from public.admin_shop_insights() where shop_id = v_shop;
  if i.setup_fee_cents <> 100000 or i.setup_paid_cents <> 60000 then raise exception 'FAIL B: implantacao'; end if;
  log := log || 'B ok; ';

  perform public.admin_set_subscription_status(v_shop, 'suspended', 'Mensalidade em atraso');
  select * into i from public.admin_shop_insights() where shop_id = v_shop;
  if i.status <> 'suspended' or i.status_note <> 'Mensalidade em atraso' then raise exception 'FAIL C: status/nota'; end if;
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'email', 'juliotmx@gmail.com')::text, true);
  set local role authenticated;
  if not public.my_shop_blocked('seu-ze') then raise exception 'FAIL D1: dono nao sabe que esta bloqueado'; end if;
  if not exists (select 1 from public.my_shop_block_info('seu-ze') x where x.status = 'suspended' and x.note = 'Mensalidade em atraso') then raise exception 'FAIL D1b: info do bloqueio'; end if;
  select count(*) into n from public.services where barbershop_id = v_shop;
  if n <> 0 then raise exception 'FAIL D2: dono bloqueado ainda le servicos'; end if;
  begin insert into public.services (barbershop_id, name, price_cents, duration_minutes) values (v_shop, 'X', 1000, 30);
  exception when others then blocked_write := true; end;
  if not blocked_write then raise exception 'FAIL D3: dono bloqueado conseguiu escrever'; end if;
  begin perform public.admin_shop_insights(); raise exception 'FAIL D4: dono acessou insights do master';
  exception when others then if sqlerrm like 'FAIL%' then raise; end if; end;
  log := log || 'D ok; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'email', 'juliograhl@gmail.com')::text, true);
  set local role authenticated;
  perform public.admin_set_subscription_status(v_shop, 'active');
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'email', 'juliotmx@gmail.com')::text, true);
  set local role authenticated;
  if public.my_shop_blocked('seu-ze') then raise exception 'FAIL E1: continua bloqueado apos reativar'; end if;
  select count(*) into n from public.appointments where barbershop_id = v_shop;
  if n < 10 then raise exception 'FAIL E2: dados nao voltaram'; end if;
  log := log || 'E ok; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated', 'email', 'juliograhl@gmail.com')::text, true);
  set local role authenticated;
  begin perform public.admin_delete_barbershop(v_shop, 'seu-ze'); raise exception 'FAIL F1: excluiu barbearia ativa';
  exception when others then if sqlerrm not like 'not_closed%' then raise; end if; end;
  perform public.admin_set_subscription_status(v_shop, 'cancelled', 'Cliente encerrou');
  begin perform public.admin_delete_barbershop(v_shop, 'errado'); raise exception 'FAIL F2: excluiu com confirmacao errada';
  exception when others then if sqlerrm not like 'confirm_mismatch%' then raise; end if; end;
  perform public.admin_delete_barbershop(v_shop, 'seu-ze');
  reset role;
  select count(*) into n from public.barbershops where id = v_shop;
  if n <> 0 then raise exception 'FAIL F3: barbearia ainda existe'; end if;
  select count(*) into n from public.appointments where barbershop_id = v_shop;
  if n <> 0 then raise exception 'FAIL F4: agendamentos orfaos'; end if;
  log := log || 'F ok';
  raise exception 'RESULT (revertido): %', log;
end $$;
