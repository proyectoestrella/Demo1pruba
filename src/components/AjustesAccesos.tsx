import { useState } from "react";
import { Mail, MoreHorizontal, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { accesos, EXPLICA_ROL, NOMBRE_ROL, useAccesosDemo, type Miembro, type ResultadoAccesos } from "@/lib/accesos-maqueta";
import { useEsDemo, useMiembroActual, usePlanSalon, useTienePlan } from "@/lib/accesos-panel";
import { ROLES, type Rol } from "@/lib/permisos";
import { useEquipo } from "@/lib/use-equipo";
import { AvatarPersona } from "@/components/ArenaShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const fechaCorta = (iso?: string) => (iso ? new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "") : "");

/**
 * Ajustes › Accesos (lote 11): quién entra en el panel y con qué rol. Solo
 * para quien tiene `accesos.gestionar`. En una demo trabaja en el navegador;
 * CONECTAR: en un salón real, las funciones de `accesos.functions.ts`.
 */
export function AjustesAccesos() {
  const esDemo = useEsDemo();
  const plan = usePlanSalon();
  const equipo = useEquipo();
  const yo = useMiembroActual();
  // Se lee la lista para que la pantalla se repinte con cada cambio.
  const miembros = useAccesosDemo((s) => s.miembros);
  const lista = (miembros ?? []).filter((m) => m.estado !== "baja");
  const [invitar, setInvitar] = useState<{ employeeId: string | null } | null>(null);

  if (!esDemo) {
    return (
      <p className="text-[14px] text-cafe-medio">
        Aquí podrás invitar a tu equipo con su correo y decidir qué ve cada una. Llega en cuanto tu salón tenga activados los accesos.
      </p>
    );
  }

  const sinCuenta = equipo.filter((e) => !lista.some((m) => m.employeeId === e.id));
  const nombreDe = (id: string | null) => equipo.find((e) => e.id === id)?.name ?? null;

  function resultado(r: ResultadoAccesos, ok: string, deshacer?: () => void) {
    if (r.ok) toast.success(ok, deshacer ? { action: { label: "Deshacer", onClick: deshacer } } : undefined);
    else toast.error(r.mensaje, r.codigo === "PLAN" ? { description: "Con el plan Todo incluido puedes usar los cuatro. Escríbenos a ejemplo@sishow.com." } : undefined);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="min-w-0 flex-1 text-[14px] text-cafe-medio">Quién entra en el panel y qué puede hacer. Cada persona entra con un enlace a su correo, sin contraseña.</p>
        <Button className="gap-1.5 rounded-full font-bold" onClick={() => setInvitar({ employeeId: null })}>
          <Plus className="size-4" strokeWidth={1.8} /> Invitar
        </Button>
      </div>

      <ul className="divide-y divide-lino overflow-hidden rounded-2xl border border-lino">
        {lista.map((m) => {
          const vinculo = nombreDe(m.employeeId);
          return (
            <li key={m.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <AvatarPersona nombre={m.displayName ?? m.email} size={36} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate font-bold">
                  {m.displayName ?? m.email}
                  {yo?.userId === m.userId && <span className="ml-1.5 text-[12.5px] font-semibold text-muted-foreground">· tú</span>}
                </p>
                <p className="truncate text-[12.5px] text-muted-foreground">
                  {m.estado === "invitada" ? `Invitación enviada el ${fechaCorta(m.invitadaEn)} · caduca el ${fechaCorta(m.caducaEn)}` : m.email}
                </p>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-[12.5px] font-bold", m.estado === "invitada" ? "bg-arena text-cafe-medio" : "bg-salvia-clara text-hoja-tinta")}>
                {m.estado === "invitada" ? "Invitada · " : ""}
                {NOMBRE_ROL[m.rol]}
                {vinculo && m.rol !== "gerente" ? ` → ${vinculo}` : ""}
              </span>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="size-9" aria-label={`Opciones de ${m.displayName ?? m.email}`}>
                    <MoreHorizontal className="size-[18px]" strokeWidth={1.6} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {m.estado === "invitada" && (
                    <>
                      <DropdownMenuItem onClick={() => resultado(accesos.reenviarInvitacion(m.userId), `Invitación reenviada a ${m.email}`)}>Reenviar invitación</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => resultado(accesos.revocarInvitacion(m.userId), "Invitación anulada", () => accesos.restaurar(m))}>Anular invitación</DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Cambiar rol</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={m.rol}
                        onValueChange={(v) => {
                          const antes: Miembro = { ...m };
                          resultado(accesos.cambiarRol(m.userId, v as Rol, plan), `${m.displayName ?? m.email} ahora es ${NOMBRE_ROL[v as Rol].toLowerCase()}`, () => accesos.restaurar(antes));
                        }}
                      >
                        {ROLES.map((r) => (
                          <DropdownMenuRadioItem key={r} value={r}>
                            {NOMBRE_ROL[r]}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>Vincular a profesional</DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={m.employeeId ?? ""}
                        onValueChange={(v) => {
                          const antes: Miembro = { ...m };
                          resultado(accesos.vincular(m.userId, v || null), v ? `${m.displayName ?? m.email} es ${nombreDe(v)} en el equipo` : "Sin vincular", () => accesos.restaurar(antes));
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
                  {m.estado === "activa" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => {
                          const antes: Miembro = { ...m };
                          resultado(accesos.darDeBaja(m.userId), `${m.displayName ?? m.email} ya no entra al panel. Sus citas se quedan.`, () => accesos.restaurar(antes));
                        }}
                      >
                        Dar de baja
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
          );
        })}
      </ul>

      {sinCuenta.length > 0 && (
        <div className="rounded-2xl border border-dashed border-lino px-4 py-3">
          <p className="text-[13px] font-bold text-cafe-medio">Profesionales sin cuenta</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sinCuenta.map((e) => (
              <button key={e.id} type="button" onClick={() => setInvitar({ employeeId: e.id })} className="inline-flex items-center gap-1.5 rounded-full border border-lino bg-superficie px-3 py-1 text-[13px] font-semibold hover:border-salvia hover:bg-salvia-suave">
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
        onInvitar={(d) => {
          const r = accesos.invitarMiembro(d, plan);
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
  onInvitar: (d: { email: string; rol: Rol; employeeId: string | null; displayName: string | null }) => void;
}) {
  const equipo = useEquipo();
  const rolesAmpliados = useTienePlan("roles-ampliados");
  const [email, setEmail] = useState("");
  const [rol, setRol] = useState<Rol>("estilista");
  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [clave, setClave] = useState<string | null>(null);
  // Al abrir, parte de la profesional pulsada (si se abrió desde «Invitar a Sara»).
  const k = `${abierta}-${employeeIdInicial}`;
  if (abierta && clave !== k) {
    setClave(k);
    setEmail("");
    setRol("estilista");
    setEmployeeId(employeeIdInicial);
  }
  const valido = /^\S+@\S+\.\S+$/.test(email.trim()) && (rol !== "estilista" || !!employeeId);
  const nombre = equipo.find((e) => e.id === employeeId)?.name.split(" ")[0] ?? null;
  return (
    <Sheet open={abierta} onOpenChange={(o) => !o && onCerrar()}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b border-border px-5 py-4 text-left">
          <SheetTitle className="text-base font-extrabold">Invitar al panel</SheetTitle>
          <SheetDescription>Le llega un enlace a su correo: al abrirlo entra directamente, sin contraseña. Caduca en 7 días.</SheetDescription>
        </SheetHeader>
        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (valido) onInvitar({ email: email.trim(), rol, employeeId: rol === "gerente" && !employeeId ? null : employeeId, displayName: nombre });
          }}
        >
          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <label className="block space-y-1.5">
              <span className="text-[13px] font-bold">Correo</span>
              <span className="flex items-center gap-2">
                <Mail className="size-4 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="sara@correo.com" autoComplete="off" />
              </span>
            </label>
            <fieldset className="space-y-2">
              <legend className="text-[13px] font-bold">Qué puede hacer</legend>
              {ROLES.map((r) => (
                <label key={r} className={cn("flex cursor-pointer gap-3 rounded-2xl border px-3.5 py-2.5", rol === r ? "border-salvia bg-salvia-suave" : "border-lino hover:bg-beige/50")}>
                  <input type="radio" name="rol" value={r} checked={rol === r} onChange={() => setRol(r)} className="mt-1 accent-[var(--hoja)]" />
                  <span>
                    <b className="block text-[14px]">
                      {NOMBRE_ROL[r]}
                      {!rolesAmpliados && (r === "subencargado" || r === "recepcion") && <span className="ml-1.5 rounded-full bg-salvia-clara px-2 py-0.5 text-[11.5px] text-hoja-tinta">Todo incluido</span>}
                    </b>
                    <span className="block text-[13px] text-cafe-medio">{EXPLICA_ROL[r]}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            {(rol === "estilista" || rol === "gerente") && (
              <label className="block space-y-1.5">
                <span className="text-[13px] font-bold">¿Quién es en tu equipo?{rol === "gerente" ? " (si también atiende)" : ""}</span>
                <select
                  value={employeeId ?? ""}
                  onChange={(e) => setEmployeeId(e.target.value || null)}
                  className="h-10 w-full rounded-xl border border-input bg-blanco px-3 text-[14px]"
                >
                  <option value="">{rol === "estilista" ? "Elige una profesional" : "Nadie"}</option>
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
            <Button type="submit" disabled={!valido} className="w-full rounded-full font-bold">
              Enviar invitación
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
