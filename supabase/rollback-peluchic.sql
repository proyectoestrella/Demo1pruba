-- Restaura el perfil anterior a la semilla. Solo usar si el SELECT de backup
-- previo a seed-peluchic.sql devolvió una fila. No borra ni modifica clientas,
-- citas, miembros, pagos o historial.
-- Sustituye el marcador por el JSONB completo que guardaste antes del alta.

do $restaurar$
declare
  perfil_anterior_text text := $perfil_anterior$
__PEGAR_AQUI_EL_JSON_COMPLETO_DEL_BACKUP_PREVIO__
$perfil_anterior$;
  filas_actualizadas integer;
begin
  if strpos(perfil_anterior_text, '__PEGAR_AQUI_') > 0 then
    raise exception 'Rollback sin completar: pega el perfil previo guardado antes de aplicar la semilla.';
  end if;

  update salons
  set profile = perfil_anterior_text::jsonb,
      updated_at = now()
  where slug = 'peluchic';
  get diagnostics filas_actualizadas = row_count;
  if filas_actualizadas <> 1 then
    raise exception 'Se esperaba restaurar una fila salons.slug=peluchic y se restauraron %.', filas_actualizadas;
  end if;
end
$restaurar$;

select slug, profile, updated_at
from salons
where slug = 'peluchic';
