do $$ declare r text; begin
  r := 'ultimo_deshacer_en=' || coalesce((select data_type from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='ultimo_deshacer_en'), 'NO');
  r := r || ' | origen_intacto=' || (select column_default from information_schema.columns where table_schema='public' and table_name='appointments' and column_name='origen');
  r := r || ' | citas=' || (select count(*) from appointments);
  raise exception 'COMPROBACION %', r;
end $$;
