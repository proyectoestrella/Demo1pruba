import { describe, expect, it } from "bun:test";
import { PermisoDenegado, type Acceso } from "./autorizacion";
import {
  aceptarInvitacion,
  cambiarRol,
  darDeBaja,
  invitarMiembro,
  listarAccesos,
  reactivarMiembro,
  reenviarInvitacion,
  revocarInvitacion,
  vincularEmpleada,
  type DepsAccesos,
  type InvitacionFila,
  type MiembroFila,
} from "./accesos";

function mundo(plan = "reservas") {
  let t = Date.parse("2026-09-25T20:00:00Z");
  let n = 0;
  const miembros: MiembroFila[] = [
    {
      userId: "maria",
      email: "maria@peluchic.es",
      rol: "gerente",
      employeeId: null,
      displayName: "María",
      estado: "activa",
    },
  ];
  const invs: InvitacionFila[] = [];
  const enviados: string[] = [];
  const correos: Record<string, string> = {
    maria: "maria@peluchic.es",
    noelia: "noelia@correo.es",
    otra: "otra@correo.es",
    s: "s@c.es",
    r: "r@c.es",
    sofia: "sofia@c.es",
  };
  const deps: DepsAccesos = {
    ahora: () => new Date(t),
    nuevoId: () => `inv${++n}`,
    plan: async () => plan,
    miembros: async () => miembros.map((m) => ({ ...m })),
    invitaciones: async () => invs.map((i) => ({ ...i })),
    guardarInvitacion: async (i) => {
      const k = invs.findIndex((x) => x.id === i.id);
      if (k >= 0) invs[k] = i;
      else invs.push(i);
    },
    enviarInvitacion: async (email) => {
      enviados.push(email);
    },
    guardarMiembro: async (m) => {
      const k = miembros.findIndex((x) => x.userId === m.userId);
      if (k >= 0) miembros[k] = m;
      else miembros.push(m);
    },
    correoDe: async (u) => correos[u] ?? null,
  };
  return {
    deps,
    miembros,
    invs,
    enviados,
    pasar: (dias: number) => {
      t += dias * 86_400_000;
    },
  };
}
const maria: Acceso = {
  tipo: "miembro",
  userId: "maria",
  rol: "gerente",
  employeeId: null,
  displayName: "María",
};
const noelia: Acceso = {
  tipo: "miembro",
  userId: "noelia",
  rol: "estilista",
  employeeId: "noelia",
  displayName: "Noelia",
};

describe("accesos: invitar y aceptar", () => {
  it("la gerente invita a una estilista vinculada a su profesional y se manda el correo", async () => {
    const w = mundo();
    const r = await invitarMiembro(
      maria,
      {
        email: " Noelia@Correo.es ",
        rol: "estilista",
        employeeId: "noelia",
        displayName: "Noelia",
      },
      w.deps,
    );
    expect(r.ok).toBe(true);
    expect(w.enviados).toEqual(["noelia@correo.es"]);
    const ok = await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    expect(ok.ok).toBe(true);
    expect(w.miembros.find((m) => m.userId === "noelia")).toMatchObject({
      rol: "estilista",
      employeeId: "noelia",
      displayName: "Noelia",
      estado: "activa",
    });
  });

  it("una estilista no puede invitar ni tocar accesos", async () => {
    const w = mundo();
    await expect(
      invitarMiembro(noelia, { email: "x@y.es", rol: "gerente" }, w.deps),
    ).rejects.toBeInstanceOf(PermisoDenegado);
    await expect(listarAccesos(noelia, w.deps)).rejects.toBeInstanceOf(PermisoDenegado);
  });

  it("guardia por rol: una estilista no puede vincular ni reactivar", async () => {
    const w = mundo();
    await expect(vincularEmpleada(noelia, "maria", "noelia", w.deps)).rejects.toBeInstanceOf(
      PermisoDenegado,
    );
    await expect(reactivarMiembro(noelia, "maria", w.deps)).rejects.toBeInstanceOf(PermisoDenegado);
  });

  it("estilista sin profesional, correo raro o rol inexistente: no", async () => {
    const w = mundo();
    expect((await invitarMiembro(maria, { email: "a@b.es", rol: "estilista" }, w.deps)).ok).toBe(
      false,
    );
    expect((await invitarMiembro(maria, { email: "nocorreo", rol: "gerente" }, w.deps)).ok).toBe(
      false,
    );
    expect((await invitarMiembro(maria, { email: "a@b.es", rol: "jefa" }, w.deps)).ok).toBe(false);
  });

  it("plan: fuera de Todo incluido, un tercer tipo de rol se rechaza con codigo PLAN", async () => {
    const w = mundo("reservas");
    expect(
      (
        await invitarMiembro(
          maria,
          { email: "n@c.es", rol: "estilista", employeeId: "noelia" },
          w.deps,
        )
      ).ok,
    ).toBe(true);
    const r = await invitarMiembro(maria, { email: "r@c.es", rol: "recepcion" }, w.deps);
    expect(r.ok === false && r.codigo).toBe("PLAN");
    const w2 = mundo("todo-incluido");
    await invitarMiembro(
      maria,
      { email: "n@c.es", rol: "estilista", employeeId: "noelia" },
      w2.deps,
    );
    expect((await invitarMiembro(maria, { email: "r@c.es", rol: "recepcion" }, w2.deps)).ok).toBe(
      true,
    );
  });

  it("aceptar con otro correo, caducada o revocada: no entra", async () => {
    const w = mundo();
    await invitarMiembro(
      maria,
      { email: "noelia@correo.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    const otro = await aceptarInvitacion("otra", w.invs[0].id, w.deps);
    expect(otro.ok === false && otro.codigo).toBe("OTRO_CORREO");
    w.pasar(8);
    const cad = await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    expect(cad.ok === false && cad.codigo).toBe("CADUCADA");
    expect((await reenviarInvitacion(maria, w.invs[0].id, w.deps)).ok).toBe(true);
    expect((await revocarInvitacion(maria, w.invs[0].id, w.deps)).ok).toBe(true);
    const rev = await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    expect(rev.ok === false && rev.codigo).toBe("NO_EXISTE");
    expect(w.miembros.some((m) => m.userId === "noelia")).toBe(false);
  });
});

describe("accesos: roles y bajas", () => {
  it("la última gerente no puede bajarse de rol ni darse de baja", async () => {
    const w = mundo();
    const a = await cambiarRol(maria, "maria", { rol: "subencargado" }, w.deps);
    expect(a.ok === false && a.codigo).toBe("ULTIMA_GERENTE");
    const b = await darDeBaja(maria, "maria", w.deps);
    expect(b.ok === false && b.codigo).toBe("ULTIMA_GERENTE");
  });

  it("dar de baja conserva la fila (para la autoría del historial) con estado baja", async () => {
    const w = mundo();
    await invitarMiembro(
      maria,
      { email: "noelia@correo.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    expect((await darDeBaja(maria, "noelia", w.deps)).ok).toBe(true);
    expect(w.miembros.find((m) => m.userId === "noelia")?.estado).toBe("baja");
    expect((await listarAccesos(maria, w.deps)).miembros.map((m) => m.userId)).toEqual(["maria"]);
  });
});

describe("accesos: vincular a una profesional", () => {
  it("vincula y desvincula a un miembro activo", async () => {
    const w = mundo();
    await invitarMiembro(maria, { email: "s@c.es", rol: "recepcion" }, w.deps);
    await aceptarInvitacion("s", w.invs[0].id, w.deps);
    expect((await vincularEmpleada(maria, "s", "sara", w.deps)).ok).toBe(true);
    expect(w.miembros.find((m) => m.userId === "s")?.employeeId).toBe("sara");
    expect((await vincularEmpleada(maria, "s", null, w.deps)).ok).toBe(true);
    expect(w.miembros.find((m) => m.userId === "s")?.employeeId).toBeNull();
  });

  it("no deja quitar el vínculo de una estilista, ni repetir profesional, ni tocar a quien no existe", async () => {
    const w = mundo();
    await invitarMiembro(
      maria,
      { email: "noelia@correo.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    const sinVinculo = await vincularEmpleada(maria, "noelia", null, w.deps);
    expect(sinVinculo.ok === false && sinVinculo.codigo).toBe("DATOS");
    const repetida = await vincularEmpleada(maria, "maria", "noelia", w.deps);
    expect(repetida.ok === false && repetida.codigo).toBe("DATOS");
    const noExiste = await vincularEmpleada(maria, "fantasma", "sara", w.deps);
    expect(noExiste.ok === false && noExiste.codigo).toBe("NO_EXISTE");
  });
});

describe("accesos: reactivar una baja", () => {
  it("reactiva con el mismo rol y vínculo que tenía", async () => {
    const w = mundo();
    await invitarMiembro(
      maria,
      { email: "noelia@correo.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    await darDeBaja(maria, "noelia", w.deps);
    expect((await reactivarMiembro(maria, "noelia", w.deps)).ok).toBe(true);
    expect(w.miembros.find((m) => m.userId === "noelia")).toMatchObject({
      estado: "activa",
      rol: "estilista",
      employeeId: "noelia",
    });
  });

  it("a quien no está de baja no se le puede reactivar", async () => {
    const r = await reactivarMiembro(maria, "maria", mundo().deps);
    expect(r.ok === false && r.codigo).toBe("NO_EXISTE");
  });

  it("no reactiva si otra persona tomó mientras tanto la misma profesional", async () => {
    const w = mundo();
    await invitarMiembro(
      maria,
      { email: "noelia@correo.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    await darDeBaja(maria, "noelia", w.deps);
    await invitarMiembro(
      maria,
      { email: "sofia@c.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    await aceptarInvitacion("sofia", w.invs[1].id, w.deps);
    const r = await reactivarMiembro(maria, "noelia", w.deps);
    expect(r.ok === false && r.codigo).toBe("DATOS");
  });

  it("no reactiva si el plan ya no cabe (bajó de Todo incluido)", async () => {
    const w = mundo("todo-incluido");
    await invitarMiembro(
      maria,
      { email: "noelia@correo.es", rol: "estilista", employeeId: "noelia" },
      w.deps,
    );
    await aceptarInvitacion("noelia", w.invs[0].id, w.deps);
    await invitarMiembro(maria, { email: "r@c.es", rol: "recepcion" }, w.deps);
    await aceptarInvitacion("r", w.invs[1].id, w.deps);
    await darDeBaja(maria, "r", w.deps);
    // Ahora activas: gerente y estilista (2 tipos). Con el plan "reservas" (límite 2), reactivar recepción sería un tercer tipo.
    const deps: DepsAccesos = { ...w.deps, plan: async () => "reservas" };
    const r = await reactivarMiembro(maria, "r", deps);
    expect(r.ok === false && r.codigo).toBe("PLAN");
  });
});
