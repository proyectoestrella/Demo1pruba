import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { employees } from "@/lib/mock/salon";
import type { Appointment, EmployeeId } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";

// NOTE: these must use local time components (not toISOString, which is UTC)
// so a slot clicked at "9:00" in the calendar prefills the form as 9:00, not
// shifted by the browser's UTC offset.
function toDateInput(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function toTimeInput(d: Date) {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional prefill — used when creating from a calendar slot or waitlist entry. */
  defaultDate?: Date;
  defaultEmployeeId?: EmployeeId;
  defaultServiceId?: string;
  defaultClientName?: string;
  defaultPhone?: string;
  onCreated?: (appt: Appointment) => void;
}

/**
 * Global "Nueva cita" form. Renders as a centered Dialog on desktop and a
 * bottom Drawer on mobile (DESIGN-DIRECTION §2.6 rule 4). Reused from the
 * topbar, the calendar (empty-slot click) and the waitlist ("Convertir a cita").
 */
export function NewAppointmentDialog({
  open,
  onOpenChange,
  defaultDate,
  defaultEmployeeId,
  defaultServiceId,
  defaultClientName,
  defaultPhone,
  onCreated,
}: NewAppointmentDialogProps) {
  const isMobile = useIsMobile();
  const services = useSalonStore((s) => s.services);
  const clients = useSalonStore((s) => s.clients);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const addClient = useSalonStore((s) => s.addClient);
  const activeServices = services.filter((s) => s.active !== false);
  const serviceMap = selectServiceMap(services);

  const [clientChoice, setClientChoice] = useState<string>("__new");
  const [newName, setNewName] = useState(defaultClientName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [serviceId, setServiceId] = useState(defaultServiceId ?? activeServices[0]?.id ?? "");
  const [employeeId, setEmployeeId] = useState<EmployeeId>(defaultEmployeeId ?? employees[0].id);
  const [date, setDate] = useState(toDateInput(defaultDate ?? new Date()));
  const [time, setTime] = useState(toTimeInput(defaultDate ?? new Date()));
  const [note, setNote] = useState("");

  // Re-sync prefill whenever the dialog is (re)opened with new defaults.
  useEffect(() => {
    if (!open) return;
    setClientChoice("__new");
    setNewName(defaultClientName ?? "");
    setPhone(defaultPhone ?? "");
    setServiceId(defaultServiceId ?? activeServices[0]?.id ?? "");
    setEmployeeId(defaultEmployeeId ?? employees[0].id);
    setDate(toDateInput(defaultDate ?? new Date()));
    setTime(toTimeInput(defaultDate ?? new Date()));
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    onOpenChange(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const service = serviceMap[serviceId];
    if (!service) {
      toast.error("Elige un servicio válido");
      return;
    }
    if (!date || !time) {
      toast.error("Elige fecha y hora");
      return;
    }

    let clientId: string;
    let clientName: string;
    if (clientChoice !== "__new") {
      const existing = clients.find((c) => c.id === clientChoice);
      if (!existing) {
        toast.error("Selecciona un cliente");
        return;
      }
      clientId = existing.id;
      clientName = existing.name;
    } else {
      if (!newName.trim()) {
        toast.error("Escribe el nombre del cliente");
        return;
      }
      clientName = newName.trim();
      if (phone.trim()) {
        const created = addClient({ name: clientName, phone: phone.trim() });
        clientId = created.id;
      } else {
        clientId = `walkin-${Date.now()}`;
      }
    }

    const start = new Date(`${date}T${time}:00`);
    const appt = addAppointment({
      clientId,
      clientName,
      serviceId,
      employeeId,
      start: start.toISOString(),
      duration: service.durationMin,
      priceEur: service.priceEur,
      status: "confirmed",
    });

    toast.success("Cita creada", { description: `${clientName} · ${service.name}` });
    onCreated?.(appt);
    reset();
  }

  const formBody = (
    <div className="space-y-4 px-4 sm:px-0">
      <div className="space-y-1.5">
        <Label>Cliente</Label>
        <Select value={clientChoice} onValueChange={setClientChoice}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__new">+ Cliente nuevo</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {clientChoice === "__new" && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="na-name">Nombre</Label>
            <Input
              id="na-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="na-phone">Teléfono (opcional)</Label>
            <Input
              id="na-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+34 600 000 000"
            />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Servicio</Label>
          <Select value={serviceId} onValueChange={setServiceId}>
            <SelectTrigger>
              <SelectValue placeholder="Elige un servicio" />
            </SelectTrigger>
            <SelectContent>
              {activeServices.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name} · €{s.priceEur}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Estilista</Label>
          <Select value={employeeId} onValueChange={(v) => setEmployeeId(v as EmployeeId)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="na-date">Fecha</Label>
          <Input id="na-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="na-time">Hora</Label>
          <Input id="na-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="na-note">Nota (opcional)</Label>
        <Input id="na-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alergias, preferencias..." />
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <form onSubmit={handleSubmit} className="flex flex-col">
            <DrawerHeader>
              <DrawerTitle>Nueva cita</DrawerTitle>
              <DrawerDescription>Rellena los datos para reservar un hueco.</DrawerDescription>
            </DrawerHeader>
            <div className="max-h-[55vh] overflow-y-auto pb-2">{formBody}</div>
            <DrawerFooter>
              <Button type="submit">Crear cita</Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
            </DrawerFooter>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva cita</DialogTitle>
            <DialogDescription>Rellena los datos para reservar un hueco.</DialogDescription>
          </DialogHeader>
          <div className="mt-4">{formBody}</div>
          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Crear cita</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
