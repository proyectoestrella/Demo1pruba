import { useState } from "react";
import { Loader2, Mail, MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { EXPLICA_ROL, NOMBRE_ROL } from "@/lib/accesos-maqueta";
import type { Miembro } from "@/lib/accesos-maqueta";
import {
  useAccesos,
  useEsDemo,
  useMiembroActual,
  useTienePlan,
  type ResultadoAccesosPanel,
} from "@/lib/accesos-panel";
import { permisosDe, puede, ROLES, type PermisosExtra, type Rol } from "@/lib/permisos";
import { useEquipo } from "@/lib/use-equipo";
import { AvatarPersona } from "@/components/ArenaShell";
import { LlegaConPlan } from "@/components/LlegaConPlan";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

const fechaCorta = (iso?: string) =>
  iso
    ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "")
    : "";

function resultado(r: ResultadoAccesosPanel, ok: string, deshacer?: () => void) {
  if (r.ok)
    toast.success(ok, deshacer ? { action: { label: "Deshacer", onClick: deshacer } } : undefined);
  else
    toast.error(
      r.mensaje,
      r.codigo === "PLAN"
        ? {
            description:
              "Esta combinación llega con el plan Embajador. Puedes ver el ejemplo en Accesos.",
          }
        : undefined,
    );
}

/** Los únicos tres accesos que la gerente puede configurar sin cambiar roles. */
function PermisosPorPersona({
  miembro,
  ocupado,
  onCambiar,
}: {
  miembro: Miembro;
  ocupado: boolean;
  onCambiar: (permisos: PermisosExtra) => void;
}) {
  if (
    miembro.estado !== "activa" ||
    (miembro.rol !== "estilista" && miembro.rol !== "subencargado")
  )
    return null;
  const efectivos = permisosDe(miembro.rol, miembro.permisosExtra);
  const permisos: Required<PermisosExtra> = {
    verAgendaCompleta: puede(efectivos, "cita.ver-todas"),
    accesoWeb: puede(efectivos, "web.editar"),
    accesoReservas: puede(efectivos, "reservas.editar"),
    editarAgendaAjena: miembro.permisosExtra?.editarAgendaAjena === true,
  };
  const opciones: Array<{
    clave: keyof PermisosExtra;
    titulo: string;
    ayuda: string;
    activo: boolean;
  }> = [
    {
      clave: "verAgendaCompleta",
      titulo: "Ve toda la agenda / solo su día",
      ayuda: permisos.verAgendaCompleta
        ? "Ahora puede ver las citas de todo el equipo y todas las clientas."
        : "Ahora solo ve sus citas; las demás no salen del servidor con datos personales.",
      activo: permisos.verAgendaCompleta,
    },
    {
      clave: "accesoWeb",
      titulo: "Puede editar la web",
      ayuda: "Incluye publicar cambios y restaurar versiones de la web del salón.",
      activo: permisos.accesoWeb,
    },
    {
      clave: "accesoReservas",
      titulo: "Puede gestionar la página de reservas",
      ayuda: "Puede cambiar preguntas, precios visibles y reparto de las reservas por internet.",
      activo: permisos.accesoReservas,
    },
  ];
  if (miembro.rol === "estilista")
    opciones.push({
      clave: "editarAgendaAjena",
      titulo: "Puede modificar la agenda de las demás",
      ayuda: permisos.editarAgendaAjena
        ? "Ahora puede ver, crear, mover, editar y cancelar citas de cualquier profesional."
        : "Ahora solo modifica sus propias citas.",
      activo: permisos.editarAgendaAjena,
    });

  return (
    <div
      className="basis-full rounded-xl border border-lino bg-nata/60 p-3"
      aria-label={`Accesos configurables de ${miembro.displayName ?? miembro.email}`}
    >
      <p className="mb-1 text-[12.5px] font-bold text-cafe-medio">Accesos configurables</p>
      <div className="grid gap-1.5 lg:grid-cols-2">
        {opciones.map((opcion) => (
          <label
            key={opcion.clave}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 py-1.5 transition-colors hover:bg-beige/70"
          >
            <Switch
              aria-label={opcion.titulo}
              checked={opcion.activo}
              disabled={ocupado}
              onCheckedChange={(activo) => onCambiar({ ...permisos, [opcion.clave]: activo })}
            />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold text-cafe">{opcion.titulo}</span>
              <span className="block text-[12px] leading-snug text-cafe-suave">{opcion.ayuda}</span>
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-cafe-suave">
        No cambia dinero, plan, accesos ni otros permisos de gestión.
      </p>
    </div>
  );
}

/**
 * Ajustes › Accesos (lote 10, conectado): quién entra en el panel y con qué
 * rol. Solo para quien tiene `accesos.gestionar`. `useAccesos()` (en
 * `accesos-panel.ts`) da la misma API en demo (la maqueta, envuelta en
 * promesas) y en un salón real (las funciones de servidor de
 * `accesos.functions.ts`), así que esta pantalla no distingue una de otra.
 */
export function AjustesAccesos() {
  const rolesAmpliados = useTienePlan("roles-ampliados");
  const esDemo = useEsDemo();
  const equipo = useEquipo();
  const yo = useMiembroActual();
  const acc = useAccesos();
  const lista = acc.miembros;
  const [invitar, setInvitar] = useState<{ employeeId: string | null } | null>(null);
  // userId (o id de invitación) de la fila con una acción en marcha: para no
  // dejar pulsar dos veces y para enseñar que se está esperando al servidor.
  const [ocupado, setOcupado] = useState<string | null>(null);

  const [confirmacion, setConfirmacion] = useState<{ texto: string; pregunta?: string; peligro?: boolean; accion: () => Promise<void> } | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  async function ejecutar(
    id: string,
    accion: () => Promise<ResultadoAccesosPanel>,
    ok: string,
    deshacer?: () => void,
    /** 22-oct: la pregunta del aviso; sin ella, «¿Confirmas este cambio?». */
    pregunta?: { titulo: string; texto: string; peligro?: boolean },
  ) {
    setConfirmacion({ texto: pregunta?.texto ?? ok, pregunta: pregunta?.titulo, peligro: pregunta?.peligro, accion: async () => {
    setOcupado(id);
    try {
      resultado(await accion(), ok, deshacer);
    } finally {
      setOcupado(null);
    }
    } });
  }

  if (!esDemo && acc.cargando && lista.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-lino px-4 py-6 text-[14px] text-cafe-medio">
        <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        Cargando accesos…
      </div>
    );
  }

  if (!esDemo && acc.error) {
    return (
      <div className="space-y-3 rounded-2xl border border-lino px-4 py-6 text-[14px] text-cafe-medio">
        <p>No se pudo cargar Accesos: {acc.error}</p>
        <Button variant="outline" size="sm" onClick={acc.recargar}>
          Reintentar
        </Button>
      </div>
    );
  }

  const sinCuenta = equipo.filter((e) => !lista.some((m) => m.employeeId === e.id));
  const nombreDe = (id: string | null) => equipo.find((e) => e.id === id)?.name ?? null;

  return (
    <div className="space-y-4">
      {/* 22-oct: aviso en ventana (antes salía arriba del bloque, fuera de la vista
          si la persona estaba más abajo) y con la pregunta de cada acción. */}
      <AlertDialog open={!!confirmacion} onOpenChange={(abierto) => !abierto && !confirmando && setConfirmacion(null)}>
        <AlertDialogContent aria-label="Confirmar cambio">
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmacion?.pregunta ?? "¿Confirmas este cambio?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirmacion?.texto}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={confirmando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmando}
              className={confirmacion?.peligro ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
              onClick={async (e) => {
                e.preventDefault();
                if (!confirmacion) return;
                setConfirmando(true);
                try {
                  await confirmacion.accion();
                  setConfirmacion(null);
                } catch {
                  toast.error("No se pudo aplicar el cambio. Inténtalo de nuevo.");
                } finally {
                  setConfirmando(false);
                }
              }}
            >
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-[1_1_12rem] text-[14px] text-cafe-medio">
          Quién entra en el panel y qué puede hacer. Cada persona entra con un enlace a su correo,
          sin contraseña.
        </p>
        <Button
          className="gap-1.5 rounded-full font-bold"
          onClick={() => setInvitar({ employeeId: null })}
        >
          <Plus className="size-4" strokeWidth={1.8} /> Invitar
        </Button>
      </div>

      <ul className="divide-y divide-lino overflow-hidden tarjeta-anidada">
        {lista.map((m) => {
          const vinculo = nombreDe(m.employeeId);
          const puedeEditar = esDemo || m.estado === "activa";
          const enCurso = ocupado === m.userId;
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <AvatarPersona nombre={m.displayName ?? m.email} size={36} />
              <div className="min-w-0 flex-[1_1_10rem] leading-tight">
                <p className="truncate font-bold">
                  {m.displayName ?? m.email}
                  {yo?.userId === m.userId && (
                    <span className="ml-1.5 text-[12.5px] font-semibold text-muted-foreground">
                      · tú
                    </span>
                  )}
                </p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {m.estado === "invitada"
                    ? `Invitación enviada el ${fechaCorta(m.invitadaEn)} · caduca el ${fechaCorta(m.caducaEn)}`
                    : m.email}
                </p>
                {m.estado !== "invitada" && <p className="text-xs text-muted-foreground">Última entrada: {m.ultimoAcceso ? new Date(m.ultimoAcceso).toLocaleString("es-ES") : "Sin datos"}</p>}
              </div>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-[12.5px] font-bold",
                  m.estado === "invitada"
                    ? "bg-arena text-cafe-medio"
                    : "bg-salvia-clara text-hoja-tinta",
                )}
              >
                {m.estado === "invitada" ? (m.caducada ? "Caducada · " : "Invitada · ") : ""}
                {m.estado === "baja" ? "Dada de baja · " : m.estado === "activa" ? "Activa · " : ""}
                {NOMBRE_ROL[m.rol]}
                {vinculo && m.rol !== "gerente" ? ` → ${vinculo}` : ""}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto size-11"
                    disabled={enCurso}
                    aria-label={`Opciones de ${m.displayName ?? m.email}`}
                  >
                    {enCurso ? (
                      <Loader2 className="size-[18px] animate-spin" strokeWidth={1.6} />
                    ) : (
                      <MoreHorizontal className="size-[18px]" strokeWidth={1.6} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {m.estado === "invitada" && (
                    <>
                      <DropdownMenuItem
                        onClick={() =>
                          ejecutar(
                            m.userId,
                            () => acc.reenviarInvitacion(m),
                            `Invitación reenviada a ${m.email}`,
                          )
                        }
                      >
                        Reenviar invitación
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          ejecutar(
                            m.userId,
                            () => acc.revocarInvitacion(m),
                            "Invitación anulada",
                            esDemo
                              ? () => ejecutar(m.userId, () => acc.restaurar(m), "Restaurada")
                              : undefined,
                            {
                              titulo: `¿Anular la invitación de ${m.email}?`,
                              texto: "El enlace que le llegó al correo dejará de servir. Podrás invitarla otra vez cuando quieras.",
                              peligro: true,
                            },
                          )
                        }
                      >
                        Anular invitación
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {puedeEditar && yo?.userId !== m.userId && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Cambiar rol</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={m.rol}
                          onValueChange={(v) => {
                            const rol = v as Rol;
                            ejecutar(
                              m.userId,
                              () => acc.cambiarRol(m, rol),
                              `${m.displayName ?? m.email} ahora es ${NOMBRE_ROL[rol].toLowerCase()}`,
                              () => ejecutar(m.userId, () => acc.restaurar(m), "Deshecho"),
                            );
                          }}
                        >
                          {ROLES.filter(
                            (r) => rolesAmpliados || r === m.rol || (r !== "subencargado" && r !== "recepcion"),
                          ).map((r) => (
                            <DropdownMenuRadioItem key={r} value={r}>
                              {NOMBRE_ROL[r]}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {puedeEditar && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>Vincular a profesional</DropdownMenuSubTrigger>
                      <DropdownMenuSubContent>
                        <DropdownMenuRadioGroup
                          value={m.employeeId ?? ""}
                          onValueChange={(v) => {
                            const employeeId = v || null;
                            ejecutar(
                              m.userId,
                              () => acc.vincular(m, employeeId),
                              employeeId
                                ? `${m.displayName ?? m.email} es ${nombreDe(employeeId)} en el equipo`
                                : "Sin vincular",
                              () => ejecutar(m.userId, () => acc.restaurar(m), "Deshecho"),
                            );
                          }}
                        >
                          <DropdownMenuRadioItem value="">Nadie</DropdownMenuRadioItem>
                          {equipo.map((e) => (
                            <DropdownMenuRadioItem key={e.id} value={e.id}>
                              {e.name}
                            </DropdownMenuRadioItem>
                          ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                  {m.estado !== "invitada" && !esDemo && <DropdownMenuItem onClick={() => ejecutar(m.userId, () => acc.cerrarSesiones(m), "Sesiones cerradas", undefined, { titulo: `¿Cerrar la sesión de ${m.displayName ?? m.email} en todos sus dispositivos?`, texto: "Tendrá que volver a entrar con el enlace de su correo, también en otros salones de esta cuenta. No pierde nada." })}>Cerrar sesión en todos sus dispositivos</DropdownMenuItem>}
                  {m.estado === "baja" && <DropdownMenuItem onClick={() => ejecutar(m.userId, () => acc.restaurar(m), "Acceso reactivado", undefined, { titulo: `¿Reactivar el acceso de ${m.displayName ?? m.email}?`, texto: "Podrá volver a entrar en el panel con su rol de antes." })}>Reactivar acceso</DropdownMenuItem>}
                  {m.estado === "activa" && yo?.userId !== m.userId && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() =>
                          ejecutar(
                            m.userId,
                            () => acc.darDeBaja(m),
                            `${m.displayName ?? m.email} ya no entra al panel. Sus citas se quedan.`,
                            () => ejecutar(m.userId, () => acc.restaurar(m), "Restaurada"),
                            {
                              titulo: `¿Dar de baja a ${m.displayName ?? m.email}?`,
                              texto: "Dejará de entrar en el panel al momento. Sus citas y su ficha del equipo se quedan, y puedes reactivarla después.",
                              peligro: true,
                            },
                          )
                        }
                      >
                        Dar de baja
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <PermisosPorPersona
                miembro={m}
                ocupado={enCurso}
                onCambiar={(permisosExtra) =>
                  ejecutar(
                    m.userId,
                    () => acc.cambiarPermisosExtra(m, permisosExtra),
                    `Accesos de ${m.displayName ?? m.email} actualizados`,
                  )
                }
              />
            </li>
          );
        })}
      </ul>

      {sinCuenta.length > 0 && (
        <div className="rounded-2xl border border-dashed border-lino px-4 py-3">
          <p className="text-[13px] font-bold text-cafe-medio">Profesionales sin cuenta</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sinCuenta.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => setInvitar({ employeeId: e.id })}
                className="inline-flex items-center gap-1.5 rounded-full border border-lino bg-superficie px-3 py-1 text-[13px] font-semibold hover:border-salvia hover:bg-salvia-suave"
              >
                <UserPlus className="size-3.5" strokeWidth={1.8} /> Invitar a {e.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <HojaInvitar
        abierta={!!invitar}
        employeeIdInicial={invitar?.employeeId ?? null}
        onCerrar={() => setInvitar(null)}
        onInvitar={async (d) => {
          const r = await acc.invitar(d);
          resultado(r, `Invitación enviada a ${d.email}`);
          if (r.ok) setInvitar(null);
        }}
      />
    </div>
  );
}

function HojaInvitar({
  abierta,
  employeeIdInicial,
  onCerrar,
  onInvitar,
}: {
  abierta: boolean;
  employeeIdInicial: string | null;
  onCerrar: () => void;
  onInvitar: (d: {
    email: string;
    rol: Rol;
    employeeId: string | null;
    displayName: string | null;
  }) => Promise<void>;
}) {
  const equipo = useEquipo();
  const rolesAmpliados = useTienePlan("roles-ampliados");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("estilista");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [clave, setClave] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  // Al abrir, parte de la profesional pulsada (si se abrió desde «Invitar a Sara»).
  const k = `${abierta}-${employeeIdInicial}`;
  if (abierta && clave !== k) {
    setClave(k);
    setEmail("");
    setRol("estilista");
    setEmployeeId(employeeIdInicial);
    setEnviando(false);
  }
  const valido = /^\S+@\S+\.\S+$/.test(email.trim()) && (rol !== "estilista" || !!employeeId);
  const nombre = equipo.find((e) => e.id === employeeId)?.name.split(" ")[0] ?? null;
  return (
    <Sheet open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="text-base font-extrabold">Invitar al panel</SheetTitle>
          <SheetDescription>
            Le llega un enlace a su correo: al abrirlo entra directamente, sin contraseña. Caduca en
            7 días.
          </SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valido || enviando) return;
            setEnviando(true);
            onInvitar({
              email: email.trim(),
              rol,
              employeeId: rol === "gerente" && !employeeId ? null : employeeId,
              displayName: nombre,
            }).finally(() => setEnviando(false));
          }}
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-bold">Correo</span>
              <span className="flex items-center gap-2">
                <Mail
                  className="size-4 text-muted-foreground"
                  strokeWidth={1.7}
                  aria-hidden="true"
                />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="sara@correo.com"
                  autoComplete="off"
                />
              </span>
            </label>
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-bold">Qué puede hacer</legend>
              {ROLES.map((r) => (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-2xl border px-3.5 py-2.5",
                    rol === r ? "border-salvia bg-salvia-suave" : "border-lino hover:bg-beige/50",
                  )}
                >
                  <input
                    type="radio"
                    name="rol"
                    value={r}
                    checked={rol === r}
                    disabled={!rolesAmpliados && (r === "subencargado" || r === "recepcion")}
                    onChange={() => setRol(r)}
                    className="mt-1 accent-[var(--hoja)]"
                  />
                  <span>
                    <b className="block text-[14px]">
                      {NOMBRE_ROL[r]}
                      {!rolesAmpliados && (r === "subencargado" || r === "recepcion") && (
                        <span className="ml-1.5 rounded-full bg-salvia-clara px-2 py-0.5 text-[11.5px] text-hoja-tinta">
                          Embajador
                        </span>
                      )}
                    </b>
                    <span className="block text-[13px] text-cafe-medio">{EXPLICA_ROL[r]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {!rolesAmpliados && <LlegaConPlan funcion="roles-ampliados" compacta />}
            {(rol === "estilista" || rol === "gerente") && (
              <label className="block space-y-1.5">
                <span className="text-[13px] font-bold">
                  ¿Quién es en tu equipo?{rol === "gerente" ? " (si también atiende)" : ""}
                </span>
                <select
                  aria-label="Profesional del equipo"
                  value={employeeId ?? ""}
                  onChange={(e) => setEmployeeId(e.target.value || null)}
                  className="h-10 w-full rounded-xl border border-input bg-blanco px-3 text-[14px]"
                >
                  <option value="">
                    {rol === "estilista" ? "Elige una profesional" : "Nadie"}
                  </option>
                  {equipo.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          <SheetFooter className="border-t border-border px-5 py-4">
            <Button
              type="submit"
              disabled={!valido || enviando}
              className="w-full gap-1.5 rounded-full font-bold"
            >
              {enviando && (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              )}
              {enviando ? "Enviando…" : "Enviar invitación"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
