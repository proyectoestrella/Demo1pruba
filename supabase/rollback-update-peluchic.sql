-- Rollback de update-peluchic.sql. Pega el JSON completo que emitió su RAISE NOTICE.
begin;
do $rollback$
declare perfil_anterior jsonb := $perfil${"__PEGAR_BACKUP_JSON_DEL_RAISE_NOTICE__":true}$perfil$::jsonb;
begin
  if perfil_anterior ? '__PEGAR_BACKUP_JSON_DEL_RAISE_NOTICE__' then raise exception 'Pega el JSON de backup antes de ejecutar el rollback.'; end if;
  update salons set profile=perfil_anterior, updated_at=now() where slug='peluchic';
  if not found then raise exception 'No existe salons.slug=peluchic.'; end if;
end $rollback$;
commit;
