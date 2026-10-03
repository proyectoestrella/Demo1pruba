import { expect, test } from "bun:test";

const [esquemaCompleto, migracionesPendientes, semillaPeluChic, rollbackPeluChic, altaPeluChic] =
  await Promise.all([
    Bun.file(new URL("../../supabase/schema.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/pendiente.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/seed-peluchic.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/rollback-peluchic.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/alta-primer-usuario-peluchic.sql", import.meta.url)).text(),
  ]);

test("ambos caminos DDL crean el campo de fecha del aviso de privacidad", () => {
  const ddl =
    "alter table appointments add column if not exists privacy_notice_acknowledged_at timestamptz;";
  expect(esquemaCompleto).toContain(ddl);
  expect(migracionesPendientes).toContain(ddl);
});

test("la semilla de PeluChic se bloquea con datos pendientes y nunca sobreescribe", () => {
  expect(semillaPeluChic).toContain("__PENDIENTE_");
  expect(semillaPeluChic.indexOf("strpos(perfil::text, '__PENDIENTE_')")).toBeLessThan(
    semillaPeluChic.indexOf("insert into salons"),
  );
  expect(semillaPeluChic).toContain("on conflict (slug) do nothing");
  expect(semillaPeluChic).toContain("perfil->>'plan' <> 'reservas'");
  expect(semillaPeluChic).toContain(
    "jsonb_array_length(perfil->'teamIds') <> jsonb_array_length(perfil->'team')",
  );
  expect(semillaPeluChic).toContain("Cada horario debe usar rangos HH:MM");
  expect(semillaPeluChic).toContain("split_part(servicio.valor, '~', 4)");
});

test("el rollback de perfil no borra citas, clientas ni otras tablas", () => {
  expect(rollbackPeluChic).toContain("__PEGAR_AQUI_EL_JSON_COMPLETO_DEL_BACKUP_PREVIO__");
  expect(rollbackPeluChic).toContain("update salons");
  expect(rollbackPeluChic.toLowerCase()).not.toContain("delete from");
});

test("el alta de María requiere su usuario Auth existente y un correo por confirmar", () => {
  expect(altaPeluChic).toContain("__CORREO_CONFIRMADO_POR_MARIA__");
  expect(altaPeluChic).toContain("from auth.users");
  expect(altaPeluChic).toContain("on conflict (user_id, salon_slug) do nothing");
  expect(altaPeluChic).not.toContain("service_role");
});
