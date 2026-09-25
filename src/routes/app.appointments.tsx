import { usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { useCitasVisibles, useEquipoVisible } from "@/lib/accesos-panel";
import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { deudaDe } from "@/lib/deuda";
import { recargoActivo } from "@/lib/recargo-activo";
import { eur } from "@/lib/copy";
import { Badge } from "@/components/ui/badge";
import { serviceLabelOf } from "@/lib/appointment-services";
import type { Appointment, AppointmentStatus, Client } from "@/lib/mock/types";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/PageHeader";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { PendingRequestsBanner } from "@/components/PendingRequestsBanner";
import { CitasPorResolver } from "@/components/CitasPorResolver";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { ExportCsvButtons } from "@/components/campanas/ExportCsvButtons";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CalendarX, MoreHorizontal, Plus, Search } from "lucide-react";

export const Route = createFileRoute("/app/appointments")({
  component: Appointments,
});

/**
 * Chip de recargo para una cita pasada: motivo (nunca "plantón"/"no-show")
 * y si el recargo que originó sigue pendiente. Solo se puede saber que
 * SIGUE pendiente si esta es la cita que hoy tiene enganchada la ficha del
 * cliente (`penaltyAppointmentId`) — la ficha solo guarda un recargo activo
 * a la vez, así que una cita más antigua ya resuelta no se distingue de una
 * que nunca generó recargo.
 */
function RecargoChip({ appointment, client }: { appointment: Appointment; client?: Client }) {
  const esRetraso = (appointment.lateMinutes ?? 0) > 0;
  const esNoPresentado = appointment.status === "no-show";
  if (!esRetraso && !esNoPresentado) return null;
  const motivo = esNoPresentado
    ? "No se presentó"
    : `Llegó tarde (${appointment.lateMinutes} min)`;
  const pendiente =
    (client?.penaltyEur ?? 0) > 0 && client?.penaltyAppointmentId === appointment.id;
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <Badge variant="outline" className="text-[10px] font-normal">
        {motivo}
      </Badge>
      {pendiente && (
        <Badge variant="destructive" className="text-[10px]">
          Recargo pendiente · {eur(client!.penaltyEur ?? 0)}
        </Badge>
      )}
    </div>
  );
}

/** La deuda activa junto al nombre permite cobrarla cuando el cliente llega. */
function DeudaBadge({
  clientId,
  clients,
  className,
}: {
  clientId: string;
  clients: Client[];
  className?: string;
}) {
  const deuda = deudaDe(clients.find((c) => c.id === clientId));
  if (!deuda) return null;
  return (
    <Badge variant="destructive" className={className}>
      Debe {eur(deuda.eur)}
    </Badge>
  );
}

function Appointments() {
  const appointments = useCitasVisibles();
  const puedeExportar = puede(usePermisos(), "exportar.excel");
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const conRecargo = recargoActivo({ noShowFeeEur });
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const carta = selectServiceMap(services);
  const clientById = new Map(clients.map((c) => [c.id, c] as const));
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const [status, setStatus] = useState<string>("all");
  const [emp, setEmp] = useState<string>("all");
  const employees = useEquipoVisible();
  // Un solo profesional: sin filtro ni columna "por profesional".
  const soloUno = esSoloUnProfesional(employees);
  const [busqueda, setBusqueda] = useState("");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [newApptOpen, setNewApptOpen] = useState(false);
  /** Filas a la vista: de 20 en 20; vuelve a 20 al filtrar o buscar. */
  const [cuantas, setCuantas] = useState(20);
  useEffect(() => setCuantas(20), [status, emp, busqueda]);
  const mostrarSolicitudes = useSalonStore((s) => s.salonProfile.mostrarSolicitudes ?? true);

  // El recorte va al final: si se aplicara antes, buscar solo miraría dentro de
  // las 60 citas más recientes.
  const termino = busqueda.trim().toLowerCase();
  const filtered = appointments
    .filter((a) => (status === "all" ? true : a.status === status))
    .filter((a) => (emp === "all" ? true : a.employeeId === emp))
    .filter((a) => (termino === "" ? true : a.clientName.toLowerCase().includes(termino)))
    .sort((a, b) => +new Date(b.start) - +new Date(a.start))
    .slice(0, 60);

  function handleStatusChange(a: Appointment, next: AppointmentStatus) {
    updateAppointment(a.id, { status: next });
    toast.success("Estado actualizado", { description: a.clientName });
  }

  function handleCancelConfirm() {
    if (!cancelTarget) return;
    cancelAppointment(cancelTarget.id);
    toast.success("Cita cancelada", { description: cancelTarget.clientName });
    setCancelTarget(null);
  }

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title="Citas"
        description={soloUno ? "Todas tus reservas." : "Todas las reservas de tu equipo."}
        actions={
          <>
            {puedeExportar && <ExportCsvButtons
              appointments={appointments}
              services={services}
              employees={employees}
            />}
            <Button size="sm" className="hidden gap-1.5 md:inline-flex" onClick={() => setNewApptOpen(true)}>
              <Plus className="h-4 w-4" /> Nueva cita
            </Button>
          </>
        }
      />

      {/* Plegados desde su cabecera: la tabla queda a la vista al entrar. */}
      <CitasPorResolver plegable="citas-por-resolver" />
      {mostrarSolicitudes && <PendingRequestsBanner plegable="citas-solicitudes" onOpenDetail={setSelected} />}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-[42px] w-full items-center gap-2 rounded-full border border-input bg-card px-3.5 text-muted-foreground sm:w-[320px]">
          <Search className="size-[18px] shrink-0" strokeWidth={1.6} />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por clienta"
            aria-label="Buscar por clienta"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-[42px] w-[calc(50%-4px)] sm:w-[190px] rounded-full">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente de confirmar</SelectItem>
            <SelectItem value="confirmed">Confirmada</SelectItem>
            <SelectItem value="completed">Vino</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="late">Vino tarde sin avisar</SelectItem>
            <SelectItem value="no-show">No vino</SelectItem>
          </SelectContent>
        </Select>
        {/* Filtrar "por profesional" con un solo profesional no filtra nada. */}
        {!soloUno && (
          <Select value={emp} onValueChange={setEmp}>
            <SelectTrigger className="h-[42px] w-[calc(50%-4px)] sm:w-[170px] rounded-full">
              <SelectValue placeholder="Profesional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el equipo</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 rounded-[20px] border border-border bg-card">
          <EmptyState
            icon={CalendarX}
            title="Sin citas con estos filtros"
            description={
              soloUno
                ? "Prueba a cambiar el estado o la búsqueda."
                : "Prueba a cambiar el estado o el profesional."
            }
          />
        </div>
      ) : (
        <>
          {/* Desktop: clean table, no vertical borders */}
          <div className="@container hidden min-w-0 flex-1 overflow-x-auto rounded-[20px] border border-border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Clienta</TableHead>
                  <TableHead className="@max-[560px]:hidden">Servicio</TableHead>
                  {!soloUno && <TableHead className="@max-[680px]:hidden">Profesional</TableHead>}
                  <TableHead className="text-right @max-[440px]:hidden">Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.slice(0, cuantas).map((a) => {
                  const e = employeeMap[a.employeeId];
                  return (
                    <TableRow
                      key={a.id}
                      className="cursor-pointer"
                      onClick={() => setSelected(a)}
                    >
                      <TableCell className="whitespace-nowrap tabular-nums @max-[440px]:whitespace-normal">
                        {new Date(a.start).toLocaleString("es", {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </TableCell>
                      <TableCell className="font-bold">
                        <span className="inline-flex flex-wrap items-center gap-2">
                          {a.clientName}
                          {conRecargo && <DeudaBadge clientId={a.clientId} clients={clients} />}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground @max-[560px]:hidden">{serviceLabelOf(a, carta)}</TableCell>
                      {!soloUno && (
                        <TableCell className="@max-[680px]:hidden">
                          <span className="inline-flex items-center gap-1.5">
                            {!soloUno && <StylistDot employeeId={a.employeeId} />}
                            {e.name}
                          </span>
                        </TableCell>
                      )}
                      <TableCell className="text-right font-bold tabular-nums @max-[440px]:hidden">{eur(a.priceEur)}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                        {conRecargo && <RecargoChip appointment={a} client={clientById.get(a.clientId)} />}
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelected(a)}>
                              Ver detalle
                            </DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Cambiar estado</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {STATUS_OPTIONS.map((c) => (
                                  <DropdownMenuItem
                                    key={c.value}
                                    onClick={() => handleStatusChange(a, c.value)}
                                  >
                                    {c.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              disabled={a.status === "cancelled"}
                              className="text-destructive focus:text-destructive"
                              onClick={() => setCancelTarget(a)}
                            >
                              Cancelar
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>

          {/* Mobile: stacked cards, never a horizontal-scroll table */}
          <div className="overflow-hidden rounded-[20px] border border-border bg-card md:hidden">
            {filtered.slice(0, cuantas).map((a) => {
              const e = employeeMap[a.employeeId];
              return (
                <div
                  key={a.id}
                  className="border-t border-border px-4 py-3 first:border-t-0"
                  onClick={() => setSelected(a)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="leading-none font-extrabold tabular-nums">
                        {new Date(a.start).toLocaleTimeString("es", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="mt-1 truncate font-bold">{a.clientName}</p>
                      {conRecargo && <DeudaBadge clientId={a.clientId} clients={clients} className="mt-1" />}
                    </div>
                    <div onClick={(evt) => evt.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 shrink-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            {a.clientName}
                          </DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelected(a)}>
                            Ver detalle
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Cambiar estado</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {STATUS_OPTIONS.map((c) => (
                                <DropdownMenuItem
                                  key={c.value}
                                  onClick={() => handleStatusChange(a, c.value)}
                                >
                                  {c.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            disabled={a.status === "cancelled"}
                            className="text-destructive focus:text-destructive"
                            onClick={() => setCancelTarget(a)}
                          >
                            Cancelar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="inline-flex min-w-0 items-center gap-1.5 truncate text-muted-foreground">
                      <StylistDot employeeId={a.employeeId} />
                      <span className="truncate">
                        {serviceLabelOf(a, carta)}
                        {soloUno ? "" : ` · ${e.name}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">{eur(a.priceEur)}</span>
                  </div>
                  <div className="mt-3">
                    <StatusBadge status={a.status} />
                    {conRecargo && <RecargoChip appointment={a} client={clientById.get(a.clientId)} />}
                  </div>
                </div>
              );
            })}
          </div>
          {filtered.length > cuantas && (
            <button
              type="button"
              onClick={() => setCuantas((n) => n + 20)}
              className="inline-flex items-center gap-1 self-start rounded-full px-3 py-2 text-[13.5px] font-bold text-cafe-medio hover:bg-beige"
            >
              Ver {Math.min(20, filtered.length - cuantas)} más
              <span className="font-semibold text-cafe-suave tabular-nums">· {cuantas} de {filtered.length}</span>
            </button>
          )}
        </>
      )}

      <AppointmentDetailSheet
        appointment={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
      <NewAppointmentDialog open={newApptOpen} onOpenChange={setNewApptOpen} />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget &&
                `Se marcará como cancelada para ${cancelTarget.clientName}. Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
