do $$ declare r text; begin
  r := 'conexiones=' || coalesce((select data_type from information_schema.columns where table_schema='public' and table_name='calendario_conexiones' and column_name='credencial_cifrada'), 'NO');
  r := r || ' | bloquear_huecos_default=' || coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='calendario_conexiones' and column_name='bloquear_huecos'), 'NO');
  r := r || ' | escribir_citas_default=' || coalesce((select column_default from information_schema.columns where table_schema='public' and table_name='calendario_conexiones' and column_name='escribir_citas'), 'NO');
  r := r || ' | mapeo_unico=' || (select count(*) from pg_constraint where conname like 'calendario_mapeo_eventos%cita_id%' or conrelid = 'calendario_mapeo_eventos'::regclass);
  r := r || ' | rls_conexiones=' || (select relrowsecurity from pg_class where relname = 'calendario_conexiones');
  r := r || ' | rls_mapeo=' || (select relrowsecurity from pg_class where relname = 'calendario_mapeo_eventos');
  r := r || ' | rls_bloqueos=' || (select relrowsecurity from pg_class where relname = 'calendario_bloqueos_externos');
  r := r || ' | filas_conexiones=' || (select count(*) from calendario_conexiones);
  raise exception 'COMPROBACION %', r;
end $$;
