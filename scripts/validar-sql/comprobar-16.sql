do $$ declare r text; begin
  r := 'cambios_entidad_chk=' || coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname='cambios_entidad_check'), 'NO');
  r := r || ' | admite_pago=' || case when coalesce((select pg_get_constraintdef(oid) from pg_constraint where conname='cambios_entidad_check'), '') ilike '%pago%' then 'SI' else 'NO' end;
  r := r || ' | filas_cambios=' || coalesce((select count(*)::text from cambios), 'NO');
  raise exception 'COMPROBACION %', r;
end $$;
