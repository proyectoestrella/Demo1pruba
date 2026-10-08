import { expect, test } from "bun:test";

const [esquemaCompleto, migracionesPendientes, semillaPeluChic, rollbackPeluChic, altaPeluChic] =
  await Promise.all([
    Bun.file(new URL("../../supabase/schema.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/pendiente.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/seed-peluchic.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/rollback-update-peluchic.sql", import.meta.url)).text(),
    Bun.file(new URL("../../supabase/alta-primer-usuario-peluchic.sql", import.meta.url)).text(),
  ]);

test("ambos caminos DDL crean el campo de fecha del aviso de privacidad", () => {
  const ddl =
    "alter table appointments add column if not exists privacy_notice_acknowledged_at timestamptz;";
  expect(esquemaCompleto).toContain(ddl);
  expect(migracionesPendientes).toContain(ddl);
});

test("la semilla de PeluChic está completa, es transaccional y nunca sobreescribe", () => {
  expect(semillaPeluChic).not.toContain("__PENDIENTE_");
  expect(semillaPeluChic).toContain("begin;");
  expect(semillaPeluChic).toContain("commit;");
  expect(semillaPeluChic).toContain("on conflict (slug) do nothing");
  expect(semillaPeluChic).toContain("jsonb_array_length(perfil->'menu') not between 1 and 60");
  expect(semillaPeluChic).toContain("serviciosPorProfesional");
});

test("el perfil de la semilla de PeluChic oculta el precio en la reserva", () => {
  const json = semillaPeluChic.match(/perfil jsonb := \$perfil\$\s*([\s\S]*?)\s*\$perfil\$::jsonb;/)?.[1];
  if (!json) throw new Error("No se encontró el JSON de perfil de PeluChic");
  expect(JSON.parse(json).ocultarPrecioReserva).toBe(true);
});

test("el rollback de perfil no borra citas, clientas ni otras tablas", () => {
  expect(rollbackPeluChic).toContain("perfil_versiones");
  expect(rollbackPeluChic).toContain("update salons");
  expect(rollbackPeluChic.toLowerCase()).not.toContain("delete from");
});

test("el alta de María requiere su usuario Auth existente y un correo por confirmar", () => {
  expect(altaPeluChic).toContain("__CORREO_CONFIRMADO_POR_MARIA__");
  expect(altaPeluChic).toContain("from auth.users");
  expect(altaPeluChic).toContain("on conflict (user_id, salon_slug) do nothing");
  expect(altaPeluChic).not.toContain("service_role");
});
