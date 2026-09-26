do $$ declare r text; begin
  r := 'payments_tabla=' || coalesce((select 'SI' from information_schema.tables where table_schema='public' and table_name='payments'), 'NO');
  r := r || ' | metodo=' || coalesce((select data_type from information_schema.columns where table_schema='public' and table_name='payments' and column_name='metodo'), 'NO');
  r := r || ' | ref_externa=' || coalesce((select data_type from information_schema.columns where table_schema='public' and table_name='payments' and column_name='ref_externa'), 'NO');
  r := r || ' | indice_unico_ref=' || coalesce((select 'SI' from pg_indexes where schemaname='public' and tablename='payments' and indexname='payments_salon_origen_ref_idx'), 'NO');
  r := r || ' | rls=' || coalesce((select relrowsecurity::text from pg_class where relname='payments' and relnamespace='public'::regnamespace), 'NO');
  r := r || ' | filas=' || coalesce((select count(*)::text from payments), 'NO');
  raise exception 'COMPROBACION %', r;
end $$;
