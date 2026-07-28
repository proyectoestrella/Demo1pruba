import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore } from "@/lib/store";
import { employeeMap, serviceMap, employees } from "@/lib/mock/salon";
import type { Appointment, AppointmentStatus } from "@/lib/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { StylistDot } from "@/components/StylistAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
import { CalendarX, MoreHorizontal, Plus } from "lucide-react";

export const Route = createFileRoute("/app/appointments")({
  component: Appointments,
});

const STATUS_CHOICES: { value: AppointmentStatus; label: string }[] = [
  { value: "confirmed", label: "Confirmada" },
  { value: "completed", label: "Completada" },
  { value: "no-show", label: "No asistió" },
];

function Appointments() {
  const appointments = useSalonStore((s) => s.appointments);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const [status, setStatus] = useState<string>("all");
  const [emp, setEmp] = useState<string>("all");
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Appointment | null>(null);
  const [newApptOpen, setNewApptOpen] = useState(false);

  const filtered = appointments
    .filter((a) => (status === "all" ? true : a.status === status))
    .filter((a) => (emp === "all" ? true : a.employeeId === emp))
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
    <div className="space-y-6">
      <PageHeader
        title="Citas"
        description="Todas las reservas de tu equipo."
        actions={
          <Button size="sm" className="gap-1.5" onClick={() => setNewApptOpen(true)}>
            <Plus className="h-4 w-4" /> Nueva cita
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="confirmed">Confirmada</SelectItem>
            <SelectItem value="completed">Completada</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
            <SelectItem value="no-show">No asistió</SelectItem>
          </SelectContent>
        </Select>
        <Select value={emp} onValueChange={setEmp}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Estilista" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las estilistas</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-card">
          <EmptyState
            icon={CalendarX}
            title="Sin citas con estos filtros"
            description="Prueba a cambiar el estado o la estilista seleccionada."
          />
        </div>
      ) : (
        <>
          {/* Desktop: clean table, no vertical borders */}
          <div className="hidden min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Cuándo</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Estilista</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/50">
                {filtered.map((a) => {
                  const e = employeeMap[a.employeeId];
                  const s = serviceMap[a.serviceId];
                  return (
                    <TableRow key={a.id} className="cursor-pointer hover:bg-muted/40" onClick={() => setSelected(a)}>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {new Date(a.start).toLocaleString("es", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </TableCell>
                      <TableCell className="font-medium">{a.clientName}</TableCell>
                      <TableCell className="text-muted-foreground">{s?.name}</TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5">
                          <StylistDot employeeId={a.employeeId} />
                          {e.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium">€{a.priceEur}</TableCell>
                      <TableCell>
                        <StatusBadge status={a.status} />
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="size-8">
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setSelected(a)}>Ver detalle</DropdownMenuItem>
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Cambiar estado</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {STATUS_CHOICES.map((c) => (
                                  <DropdownMenuItem key={c.value} onClick={() => handleStatusChange(a, c.value)}>
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
          <div className="space-y-3 md:hidden">
            {filtered.map((a) => {
              const e = employeeMap[a.employeeId];
              const s = serviceMap[a.serviceId];
              return (
                <div key={a.id} className="rounded-xl border border-border/60 bg-card p-4" onClick={() => setSelected(a)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-display text-lg leading-none">
                        {new Date(a.start).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <p className="mt-1 truncate font-medium">{a.clientName}</p>
                    </div>
                    <div onClick={(evt) => evt.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="size-8 shrink-0">
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel className="text-xs text-muted-foreground">{a.clientName}</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => setSelected(a)}>Ver detalle</DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>Cambiar estado</DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {STATUS_CHOICES.map((c) => (
                                <DropdownMenuItem key={c.value} onClick={() => handleStatusChange(a, c.value)}>
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
                      <span className="truncate">{s?.name} · {e.name}</span>
                    </span>
                    <span className="shrink-0 font-medium">€{a.priceEur}</span>
                  </div>
                  <div className="mt-3">
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <AppointmentDetailSheet appointment={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
      <NewAppointmentDialog open={newApptOpen} onOpenChange={setNewApptOpen} />

      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => !o && setCancelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar esta cita?</AlertDialogTitle>
            <AlertDialogDescription>
              {cancelTarget && `Se marcará como cancelada para ${cancelTarget.clientName}. Esta acción no se puede deshacer.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelConfirm} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sí, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
