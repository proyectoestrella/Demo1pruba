do $$ declare r text; begin
  r := 'cambios=' || (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='cambios');
  r := r || ' | versiones=' || (select string_agg(column_name, ',' order by ordinal_position) from information_schema.columns where table_schema='public' and table_name='perfil_versiones');
  r := r || ' | rls=' || (select string_agg(relname||':'||relrowsecurity, ',' order by relname) from pg_class where relname in ('cambios','perfil_versiones','salon_invitaciones'));
  -- Un cambio y su deshacer, idempotente (insert on conflict do nothing).
  insert into cambios (id, salon_slug, tipo, entidad, id_entidad, antes, despues, resumen) values ('prueba-1','x','cita.cancelar','cita','a1','{"status":"confirmed"}','{"status":"cancelled"}','prueba') on conflict (id) do nothing;
  insert into cambios (id, salon_slug, tipo, entidad, id_entidad, antes, despues, resumen) values ('prueba-1','x','cita.cancelar','cita','a1','{}','{}','dup') on conflict (id) do nothing;
  insert into cambios (id, salon_slug, tipo, entidad, id_entidad, antes, despues, resumen, deshace_a) values ('prueba-2','x','cita.cancelar','cita','a1','{"status":"cancelled"}','{"status":"confirmed"}','deshecho','prueba-1');
  r := r || ' | filas_prueba=' || (select count(*) from cambios where salon_slug='x') || ' resumen1=' || (select resumen from cambios where id='prueba-1');
  raise exception 'COMPROBACION %', r;
end $$;
