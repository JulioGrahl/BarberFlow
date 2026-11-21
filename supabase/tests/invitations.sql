-- Convites: um link válido por profissional, aceite encerra os demais e a tela do dono sabe quem já tem acesso.
-- Rode no SQL do Supabase. Termina com RAISE EXCEPTION para reverter tudo; a mensagem "RESULT" traz o resumo.
-- Troque os UUIDs abaixo pelos da barbearia de teste (dono, profissional sem conta, usuário que vai aceitar).
do $$
declare
  v_shop uuid := '5cead2de-6766-46d3-af37-1a7d674ffcd2';
  v_owner uuid := 'f8476c89-a752-433e-bbf9-78403020d3fd';
  v_pro uuid := 'dc9b3165-3cfb-4f42-82d6-421c053622e8';
  v_cust uuid := '38a16e0f-7119-4ec9-8bdf-1e90bf5be2d9';
  t1 text; t2 text; n int; ok boolean; log text := '';
begin
  insert into public.invitations (barbershop_id, professional_id, role, token_hash, expires_at, created_by)
  values (v_shop, v_pro, 'barber', 'legacy-hash-x', now() + interval '7 days', v_owner);

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'email', 'juliotmx@gmail.com')::text, true);
  set local role authenticated;
  t1 := public.create_invitation(v_shop, null, v_pro);
  t2 := public.create_invitation(v_shop, null, v_pro);
  select count(*) into n from public.invitations where professional_id = v_pro and accepted_at is null and revoked_at is null;
  if n <> 1 then raise exception 'FAIL A: apos gerar 2 convites deveria haver 1 aberto, ha %', n; end if;
  log := log || 'A ok; ';
  select exists (select 1 from public.professionals_with_access(v_shop) x where x = v_pro) into ok;
  if ok then raise exception 'FAIL B: profissional sem conta aparece com acesso'; end if;
  log := log || 'B ok; ';

  reset role;
  insert into public.invitations (barbershop_id, professional_id, role, token_hash, expires_at, created_by)
  values (v_shop, v_pro, 'barber', 'legacy-hash-y', now() + interval '7 days', v_owner);

  perform set_config('request.jwt.claims', json_build_object('sub', v_cust, 'role', 'authenticated', 'email', 'juliograhl@gmail.com')::text, true);
  set local role authenticated;
  perform public.accept_invitation(t2);
  reset role;

  select count(*) into n from public.invitations where professional_id = v_pro and accepted_at is null and revoked_at is null;
  if n <> 0 then raise exception 'FAIL C: apos aceitar ainda ha % convite(s) aberto(s)', n; end if;
  log := log || 'C ok; ';

  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated', 'email', 'juliotmx@gmail.com')::text, true);
  set local role authenticated;
  select exists (select 1 from public.professionals_with_access(v_shop) x where x = v_pro) into ok;
  if not ok then raise exception 'FAIL D: profissional com conta nao aparece com acesso'; end if;
  log := log || 'D ok; ';
  begin
    perform public.create_invitation(v_shop, null, v_pro);
    raise exception 'FAIL E: permitiu convite para profissional que ja tem acesso';
  exception when others then
    if sqlerrm not like 'invalid_professional%' then raise; end if;
  end;
  log := log || 'E ok; ';
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', v_cust, 'role', 'authenticated', 'email', 'juliograhl@gmail.com')::text, true);
  set local role authenticated;
  begin
    perform public.accept_invitation(t1);
    raise exception 'FAIL F: token antigo ainda aceita';
  exception when others then
    if sqlerrm not like 'invalid_invitation%' then raise; end if;
  end;
  log := log || 'F ok';
  reset role;
  raise exception 'RESULT (revertido): %', log;
end $$;
