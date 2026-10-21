-- Aplicar como postgres en SQL Editor antes de desplegar. Solo service_role.
-- admin.signOut exige el JWT del destinatario: no es un user_id.
-- Al no almacenar JWT ajenos, invalidamos sus refresh tokens y sesiones por id.
begin;
create or replace function public.cerrar_sesiones_usuario(usuario uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.refresh_tokens where user_id = usuario::text;
  delete from auth.sessions where user_id = usuario;
end;
$$;
create or replace function public.sesion_usuario_vigente(usuario uuid, sesion uuid)
returns boolean language sql security definer set search_path = '' as $$
  select exists(select 1 from auth.sessions where id = sesion and user_id = usuario);
$$;
revoke all on function public.cerrar_sesiones_usuario(uuid) from public, anon, authenticated;
revoke all on function public.sesion_usuario_vigente(uuid, uuid) from public, anon, authenticated;
grant execute on function public.cerrar_sesiones_usuario(uuid) to service_role;
grant execute on function public.sesion_usuario_vigente(uuid, uuid) to service_role;
commit;
