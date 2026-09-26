do $$ declare r text; begin
  r := 'cash_closings_tabla=' || coalesce((select 'SI' from information_schema.tables where table_schema='public' and table_name='cash_closings'), 'NO');
  r := r || ' | anterior=' || coalesce((select data_type from information_schema.columns where table_schema='public' and table_name='cash_closings' and column_name='anterior'), 'NO');
  r := r || ' | unico_salon_fecha=' || coalesce((select 'SI' from pg_constraint where conname='cash_closings_salon_slug_fecha_key'), (select 'SI' from pg_indexes where schemaname='public' and tablename='cash_closings' and indexdef ilike '%unique%salon_slug%fecha%'), 'NO');
  r := r || ' | rls=' || coalesce((select relrowsecurity::text from pg_class where relname='cash_closings' and relnamespace='public'::regnamespace), 'NO');
  r := r || ' | filas=' || coalesce((select count(*)::text from cash_closings), 'NO');
  raise exception 'COMPROBACION %', r;
end $$;
