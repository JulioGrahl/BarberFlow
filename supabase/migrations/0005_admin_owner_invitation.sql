-- BarberFlow — 0005: Super Admin gera (ou reemite) o convite do proprietário
create function public.admin_create_owner_invitation(p_shop uuid, p_email text, p_name text default null)
returns text
language plpgsql security definer set search_path = '' as $$
declare v_token text; v_id uuid;
begin
  perform private.require_super_admin();
  if not exists (select 1 from public.barbershops where id = p_shop) then raise exception 'not_found'; end if;
  update public.invitations set revoked_at = now()
  where barbershop_id = p_shop and role = 'owner' and accepted_at is null and revoked_at is null;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.invitations (barbershop_id, email, invitee_name, role, token_hash, expires_at, created_by)
  values (p_shop, nullif(lower(trim(p_email)), ''), p_name, 'owner',
          encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '14 days', (select auth.uid()))
  returning id into v_id;
  perform private.log_audit(p_shop, 'invitation.create_owner', 'invitation', v_id::text);
  return v_token;
end $$;

revoke execute on function public.admin_create_owner_invitation(uuid, text, text) from public, anon, authenticated;
grant execute on function public.admin_create_owner_invitation(uuid, text, text) to authenticated;
