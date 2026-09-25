do $$ declare r text; begin
  select string_agg(column_name, ',' order by column_name) into r from information_schema.columns
   where table_schema='public' and table_name='salon_members';
  r := r || ' | invitaciones_cols=' || (select string_agg(column_name, ',' order by column_name) from information_schema.columns where table_schema='public' and table_name='salon_invitaciones');
  r := r || ' | roles=' || coalesce((select string_agg(distinct rol, ',') from salon_members), '(ninguno)');
  r := r || ' | rls_inv=' || (select relrowsecurity::text from pg_class where relname='salon_invitaciones');
  raise exception 'COMPROBACION %', r;
end $$;
