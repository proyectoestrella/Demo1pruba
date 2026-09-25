import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import type { Appointment, EmployeeId } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { sumServices } from "@/lib/appointment-services";
import { eur } from "@/lib/copy";
import { duracionRecordada } from "@/lib/derive";
import { Check, ChevronsUpDown, Clock3 } from "lucide-react";
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
import { isoDelSalon, zonaDelSalon } from "@/lib/zona-horaria";

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
  /**
   * Los sábados de Cardedal son 55-60 clientes que llaman esa misma mañana,
   * uno detrás de otro. Con esto el formulario ofrece "Guardar y crear otra":
   * se queda abierto y limpio para la siguiente llamada en vez de obligar a
   * volver a la agenda y abrirlo otra vez.
   */
  allowChaining?: boolean;
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
  allowChaining = false,
}: NewAppointmentDialogProps) {
  const isMobile = useIsMobile();
  const services = useSalonStore((s) => s.services);
  const clients = useSalonStore((s) => s.clients);
  const appointments = useSalonStore((s) => s.appointments);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const zonaHoraria = useSalonStore((s) => zonaDelSalon(s.salonProfile));
  const addClient = useSalonStore((s) => s.addClient);
  const activeServices = services.filter((s) => s.active !== false);
  const serviceMap = selectServiceMap(services);

  const [clientChoice, setClientChoice] = useState<string>("__new");
  const [clientPickerOpen, setClientPickerOpen] = useState(false);
  const [newName, setNewName] = useState(defaultClientName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(() =>
    [defaultServiceId ?? activeServices[0]?.id].filter((id): id is string => !!id),
  );
  const employees = useEquipo();
  // Con un solo profesional no hay a quién asignar: se asigna solo y el
  // selector desaparece del formulario.
  const soloUno = esSoloUnProfesional(employees);
  const [employeeId, setEmployeeId] = useState<EmployeeId>(defaultEmployeeId ?? employees[0].id);
  const [date, setDate] = useState(toDateInput(defaultDate ?? new Date()));
  const [time, setTime] = useState(toTimeInput(defaultDate ?? new Date()));
  const [note, setNote] = useState("");
  /**
   * Duración elegida a mano, en minutos. `null` = la que sale del catálogo
   * (o la recordada, si la hay). María (PeluChic) lo dijo tal cual: "el
   * tiempo de cada cita lo decido yo".
   */
  const [duracionManual, setDuracionManual] = useState<number | null>(null);
  /** Cuántas citas seguidas se llevan creadas sin cerrar el formulario. */
  const [encadenadas, setEncadenadas] = useState(0);

  // Re-sync prefill whenever the dialog is (re)opened with new defaults.
  useEffect(() => {
    if (!open) return;
    setClientChoice("__new");
    setNewName(defaultClientName ?? "");
    setPhone(defaultPhone ?? "");
    setServiceIds([defaultServiceId ?? activeServices[0]?.id].filter((id): id is string => !!id));
    setEmployeeId(defaultEmployeeId ?? employees[0].id);
    setDate(toDateInput(defaultDate ?? new Date()));
    setTime(toTimeInput(defaultDate ?? new Date()));
    setNote("");
    setDuracionManual(null);
    setEncadenadas(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function reset() {
    onOpenChange(false);
  }

  function toggleService(id: string) {
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  const chosen = serviceIds.map((id) => serviceMap[id]).filter(Boolean);
  // La cita bloquea y cobra la suma de todos los servicios elegidos.
  const { durationMin: catalogoMin, priceEur: total } = sumServices(chosen);

  // Si a esta persona estos mismos servicios le llevaron otra cosa la última
  // vez, se propone ESO y se dice por qué. El catálogo sabe cuánto dura un
  // corte; no sabe cuánto dura el corte de esta clienta.
  const recordada = duracionRecordada(
    appointments,
    clientChoice !== "__new" ? clientChoice : undefined,
    serviceIds,
    catalogoMin,
  );
  const totalMin = duracionManual ?? recordada?.minutos ?? catalogoMin;
  // Duraciones a elegir: las de siempre más la del catálogo y la recordada,
  // para que el desplegable nunca se quede en blanco.
  const opcionesDuracion = [
    ...new Set([15, 30, 45, 60, 75, 90, 120, 150, 180, catalogoMin, totalMin].filter((n) => n > 0)),
  ].sort((a, b) => a - b);

  function handleSubmit(e: React.FormEvent, encadenar = false) {
    e.preventDefault();
    if (!chosen.length) {
      toast.error("Elige al menos un servicio");
      return;
    }
    if (!date || !time) {
      toast.error("Elige fecha y hora");
      return;
    }

    let clientId: string;
    let clientName: string;
    let clientPhone = "";
    let clientEmail: string | undefined;
    if (clientChoice !== "__new") {
      const existing = clients.find((c) => c.id === clientChoice);
      if (!existing) {
        toast.error("Selecciona un cliente");
        return;
      }
      clientId = existing.id;
      clientName = existing.name;
      clientPhone = existing.phone;
      clientEmail = existing.email;
    } else {
      if (!newName.trim()) {
        toast.error("Escribe el nombre del cliente");
        return;
      }
      clientName = newName.trim();
      if (phone.trim()) {
        const created = addClient({ name: clientName, phone: phone.trim() });
        clientId = created.id;
        clientPhone = phone.trim();
      } else {
        clientId = `walkin-${Date.now()}`;
      }
    }

    const startISO = isoDelSalon(date, time, zonaHoraria);
    const appt = addAppointment(
      {
        clientId,
        clientName,
        serviceIds: chosen.map((s) => s.id),
        employeeId,
        start: startISO,
        duration: totalMin,
        priceEur: total,
        status: "confirmed",
        note,
      },
      // Con teléfono se crea/reconoce la ficha del cliente; sin él es un "Sin
      // cita" y la cita sube igual, solo que sin ficha. Antes esto llamaba a
      // `registerBookingClient` con `salon.slug` — el slug ESTÁTICO del salón
      // de ejemplo, no el del salón abierto —, así que la fila acababa siempre
      // en "los-mosqueteros". Ahora lo lleva la store, que sí sabe qué salón
      // está gestionando este panel (y no llama a nada si es una demo).
      clientPhone ? { name: clientName, phone: clientPhone, email: clientEmail } : undefined,
    );

    toast.success("Cita creada", {
      description: `${clientName} · ${chosen.map((s) => s.name).join(" + ")}`,
    });
    onCreated?.(appt);

    if (encadenar) {
      // Se queda abierto y en blanco, con la fecha puesta donde estaba: es la
      // diferencia entre 60 llamadas de un sábado y 60 idas y venidas a la
      // agenda. Solo se limpia lo que cambia de un cliente al siguiente.
      setEncadenadas((n) => n + 1);
      setClientChoice("__new");
      setNewName("");
      setPhone("");
      setNote("");
      setDuracionManual(null);
      setServiceIds([activeServices[0]?.id].filter((id): id is string => !!id));
      return;
    }
    reset();
  }

  const formBody = (
    <div className="space-y-4 px-4 sm:px-0">
      <div className="space-y-1.5">
        <Label>Cliente</Label>
        {/* Buscador y no desplegable: con 300 clientes reales, una lista plana
            obliga a bajar a rueda hasta encontrarlo. Se filtra por nombre y por
            teléfono, que es como se busca a alguien en un salón. */}
        <Popover open={clientPickerOpen} onOpenChange={setClientPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={clientPickerOpen}
              className="w-full justify-between font-normal"
            >
              <span className={cn(clientChoice === "__new" && "text-muted-foreground")}>
                {clientChoice === "__new"
                  ? "+ Cliente nuevo"
                  : (clients.find((c) => c.id === clientChoice)?.name ?? "Elegir cliente")}
              </span>
              <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
            <Command
              filter={(value, search) =>
                value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0
              }
            >
              <CommandInput placeholder="Nombre o teléfono…" />
              <CommandList>
                <CommandEmpty>Ningún cliente con ese nombre o teléfono.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    value="+ Cliente nuevo"
                    onSelect={() => {
                      setClientChoice("__new");
                      setClientPickerOpen(false);
                    }}
                  >
                    + Cliente nuevo
                  </CommandItem>
                  {clients.map((c) => (
                    <CommandItem
                      key={c.id}
                      value={`${c.name} ${c.phone}`}
                      onSelect={() => {
                        setClientChoice(c.id);
                        setClientPickerOpen(false);
                      }}
                    >
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="ml-2 shrink-0 text-xs text-muted-foreground">{c.phone}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
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

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Label>Servicios</Label>
          <span className="text-xs text-muted-foreground" aria-live="polite">
            {chosen.length === 0
              ? "Elige uno o varios"
              : `${chosen.length} ${chosen.length === 1 ? "elegido" : "elegidos"} · ${totalMin} min · ${eur(total)}`}
          </span>
        </div>
        {/* Misma mecánica que el paso 1 de la reserva pública: cada pulsación
            añade o quita, y la cita se lleva la suma. */}
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {activeServices.map((s) => {
            const isSelected = serviceIds.includes(s.id);
            return (
              <button
                key={s.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleService(s.id)}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors",
                  isSelected
                    ? "border-primary bg-primary/10"
                    : "border-border/60 hover:border-primary/40 hover:bg-muted/30",
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{s.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {s.durationMin} min · {eur(s.priceEur)}
                  </span>
                </span>
                {isSelected && <Check className="size-4 shrink-0 text-primary" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Duración de la cita — editable siempre, y con aviso cuando la última
          vez tardó otra cosa. */}
      <div className="space-y-1.5">
        <Label>Duración</Label>
        <Select value={String(totalMin)} onValueChange={(v) => setDuracionManual(Number(v))}>
          <SelectTrigger aria-label="Duración de la cita">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {opcionesDuracion.map((min) => (
              <SelectItem key={min} value={String(min)}>
                {min} min
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {recordada && duracionManual === null && (
          <p className="flex items-start gap-1.5 text-xs text-primary">
            <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            <span>
              La última vez tardó {recordada.minutos} min (
              {new Date(recordada.cuando).toLocaleDateString("es", {
                day: "numeric",
                month: "long",
              })}
              ), no los {catalogoMin} de la carta. Te proponemos {recordada.minutos}.
            </span>
          </p>
        )}
        {duracionManual !== null && duracionManual !== catalogoMin && (
          <p className="text-xs text-muted-foreground">
            La carta dice {catalogoMin} min: esta cita va con {duracionManual}.
          </p>
        )}
      </div>

      {!soloUno && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
      )}

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
        <Input
          id="na-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Alergias, preferencias..."
        />
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
              {encadenadas > 0 && (
                <p className="text-center text-xs text-muted-foreground">
                  {encadenadas} {encadenadas === 1 ? "cita creada" : "citas creadas"} sin salir de
                  aquí.
                </p>
              )}
              <Button type="submit">Crear cita</Button>
              {allowChaining && (
                <Button type="button" variant="secondary" onClick={(e) => handleSubmit(e, true)}>
                  Guardar y crear otra
                </Button>
              )}
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
          <DialogFooter className="mt-6 gap-2 sm:gap-2">
            {encadenadas > 0 && (
              <p className="mr-auto self-center text-xs text-muted-foreground">
                {encadenadas} {encadenadas === 1 ? "cita creada" : "citas creadas"} sin salir de
                aquí.
              </p>
            )}
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            {allowChaining && (
              <Button type="button" variant="secondary" onClick={(e) => handleSubmit(e, true)}>
                Guardar y crear otra
              </Button>
            )}
            <Button type="submit">Crear cita</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
