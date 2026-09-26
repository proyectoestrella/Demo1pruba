import { avisar } from "@/lib/deshacer-maqueta";
import { useEffect, useMemo, useState } from "react";
import { esperandoDesde, filtrarEspera, proximoHuecoPara, type HuecoPropuesto } from "@/lib/lista-espera-panel";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { beforeLoadSiModuloVisible, useRedirigirSiModuloOculto } from "@/lib/route-guards";
import { useBusinessType } from "@/lib/use-display-profile";
import { professionalWord } from "@/lib/business-type";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { enlaceDeHueco } from "@/lib/avisos";
import type { EmployeeId, WaitlistEntry } from "@/lib/mock/types";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CalendarCheck, ListChecks, MessageCircle, Plus, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/waitlist")({
  beforeLoad: beforeLoadSiModuloVisible("lista-espera"),
  component: Waitlist,
});

/** Fecha y hora en el formato que piden `<input type="date">` y `type="time"`, en hora local. */
function toDateInput(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function toTimeInput(d: Date) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Hora que se propone al avisar: el hueco recién liberado, o la próxima en punto. */
function horaSugerida(lastFreedSlot: string | null): Date {
  if (lastFreedSlot) {
    const d = new Date(lastFreedSlot);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function Waitlist() {
  const visible = useRedirigirSiModuloOculto("lista-espera");
  const waitlist = useSalonStore((s) => s.waitlist);
  // Un solo profesional: en la ficha de quien espera no se escribe "con Adam"
  // ni "cualquier barbero" — no hay alternativa.
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);
  const citas = useSalonStore((s) => s.appointments);
  const [ahora] = useState(() => new Date());
  // Lote 16: filtros y, para cada una, el primer hueco donde cabe lo que pide.
  const [fServicio, setFServicio] = useState("todos");
  const [fPro, setFPro] = useState("todas");
  const services = useSalonStore((s) => s.services);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const deleteWaitlist = useSalonStore((s) => s.deleteWaitlist);
  const addWaitlist = useSalonStore((s) => s.addWaitlist);
  const lastFreedSlot = useSalonStore((s) => s.lastFreedSlot);
  const tipo = useBusinessType();
  const serviceMap = selectServiceMap(services);
  const filtradas = filtrarEspera(waitlist, { servicio: fServicio, profesional: fPro });
  const huecos = useMemo(() => {
    const m = new Map<string, HuecoPropuesto>();
    for (const w of waitlist) {
      const h = proximoHuecoPara(w, citas, equipo, serviceMap[w.serviceId]?.durationMin ?? 45, ahora);
      if (h) m.set(w.id, h);
    }
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waitlist, citas, equipo, ahora, services]);

  const [convertTarget, setConvertTarget] = useState<WaitlistEntry | null>(null);
  const [convertOpen, setConvertOpen] = useState(false);
  const [altaOpen, setAltaOpen] = useState(false);
  const [avisoTarget, setAvisoTarget] = useState<WaitlistEntry | null>(null);

  // Lote 12e: sin «¿Seguro?»: se quita al momento y se deshace desde el aviso.
  function handleDelete(quitada: WaitlistEntry) {
    deleteWaitlist(quitada.id);
    // Lote 12: deshacer la vuelve a poner tal cual (mismo id y fecha de alta).
    avisar(`${quitada.clientName.split(" ")[0]} fuera de la lista de espera`, () =>
      useSalonStore.setState((st) => ({ waitlist: st.waitlist.some((w) => w.id === quitada.id) ? st.waitlist : [...st.waitlist, quitada] })),
    );
  }

  function openConvert(w: WaitlistEntry) {
    setConvertTarget(w);
    setConvertOpen(true);
  }

  function handleConverted() {
    if (convertTarget) {
      deleteWaitlist(convertTarget.id);
    }
    setConvertTarget(null);
  }

  // El primero de la lista es el que lleva más tiempo esperando: a ese es a
  // quien toca avisar cuando se libera un hueco.
  const siguiente = waitlist[0];

  if (!visible) return null;

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader
        title="Lista de espera"
        description="Clientas esperando un hueco."
        actions={
          <Button className="gap-1.5" onClick={() => setAltaOpen(true)}>
            <Plus className="h-4 w-4" /> Apuntar a alguien
          </Button>
        }
      />

      <div className="rounded-2xl bg-salvia-clara px-4 py-3 text-[12.5px] text-hoja-tinta">
        <p className="font-bold">Para cuando se libere un hueco</p>
        <p className="mt-0.5">
          Si alguien cancela, aquí tienes a quién llamar primero. <strong>Avisar hueco</strong> abre tu
          WhatsApp con la hora concreta ya escrita y <strong>Convertir en cita</strong> lo mete en la
          agenda. El mensaje lo envías tú desde tu móvil: siShow no manda nada solo.
        </p>
        {lastFreedSlot && siguiente && (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-card px-3 py-2 text-foreground">
            <span className="text-sm">
              Se acaba de liberar el hueco de las{" "}
              <strong>
                {new Date(lastFreedSlot).toLocaleTimeString("es", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}
              </strong>{" "}
              ({new Date(lastFreedSlot).toLocaleDateString("es", { day: "numeric", month: "long" })}
              ).
            </span>
            <Button size="sm" className="gap-1.5" onClick={() => setAvisoTarget(siguiente)}>
              <MessageCircle className="h-3.5 w-3.5" /> Avisar a {siguiente.clientName}
            </Button>
          </div>
        )}
      </div>

      {waitlist.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select aria-label="Filtrar por servicio" value={fServicio} onChange={(e) => setFServicio(e.target.value)} className="h-10 rounded-full border border-lino bg-card px-4 text-[13px] font-bold text-cafe hover:bg-beige">
            <option value="todos">Todos los servicios</option>
            {services.filter((x) => waitlist.some((w) => w.serviceId === x.id)).map((x) => (
              <option key={x.id} value={x.id}>{x.name}</option>
            ))}
          </select>
          {!soloUno && (
            <select aria-label="Filtrar por profesional" value={fPro} onChange={(e) => setFPro(e.target.value)} className="h-10 rounded-full border border-lino bg-card px-4 text-[13px] font-bold text-cafe hover:bg-beige">
              <option value="todas">Cualquier {professionalWord(tipo)}</option>
              {equipo.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          )}
          <span className="text-[13px] text-muted-foreground tabular-nums">
            {filtradas.length === waitlist.length ? `${waitlist.length} esperando` : `${filtradas.length} de ${waitlist.length}`}
          </span>
        </div>
      )}

      {waitlist.length === 0 ? (
        <div className="flex-1 rounded-[20px] border border-border bg-card">
          <EmptyState
            icon={ListChecks}
            title="Nadie esperando, de momento"
            description="Cuando alguien te pida un hueco que no tienes, apúntala aquí. En cuanto se libere uno, le avisas por WhatsApp en un toque."
          />
        </div>
      ) : (
        <div className="flex-1 overflow-hidden rounded-[20px] border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_96px_470px] gap-4 border-b border-lino bg-beige/40 px-5 py-2.5 text-[11px] font-bold tracking-[0.06em] text-cafe-suave uppercase lg:grid">
            <span>Quién</span>
            <span>Qué quiere</span>
            <span>Cuándo puede</span>
            <span>Espera</span>
            <span>Hueco propuesto y acciones</span>
          </div>
          {filtradas.length === 0 && (
            <p className="px-5 py-6 text-[14px] text-muted-foreground">Nadie espera con ese filtro. <button type="button" className="font-bold text-foreground underline" onClick={() => { setFServicio("todos"); setFPro("todas"); }}>Quitar filtros</button></p>
          )}
          {filtradas.map((w) => {
            const s = serviceMap[w.serviceId];
            const e = w.preferredEmployeeId === "any" ? null : equipo.find((x) => x.id === w.preferredEmployeeId) ?? employeeMap[w.preferredEmployeeId];
            const h = huecos.get(w.id);
            return (
              <div
                key={w.id}
                className="entrada-lista grid gap-x-4 gap-y-1.5 border-b border-lino px-5 py-3.5 last:border-b-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_96px_470px] lg:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-bold">{w.clientName}</p>
                  <p className="text-[12.5px] text-muted-foreground tabular-nums">{w.phone || "Sin teléfono"}</p>
                </div>
                <p className="min-w-0 text-[13.5px]">
                  {s?.name ?? "Sin servicio concreto"}
                  {!soloUno && <span className="block text-[12.5px] text-muted-foreground">{e ? `con ${e.name}` : `cualquier ${professionalWord(tipo)}`}</span>}
                </p>
                <p className="min-w-0 text-[13.5px] text-cafe-medio">{w.preferredRange || "Cuando sea"}</p>
                <p className="text-[12.5px] font-bold text-cafe-medio">
                  <span className="lg:hidden">Espera </span>{esperandoDesde(w.createdAt, ahora)}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="mr-auto text-[12.5px] text-muted-foreground tabular-nums">
                    {h ? `${h.fecha.toLocaleDateString("es-ES", { weekday: "short", day: "numeric" })} ${toTimeInput(h.fecha)}${soloUno ? "" : ` · ${equipo.find((x) => x.id === h.employeeId)?.name ?? ""}`}` : "Sin hueco en 14 días"}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setAvisoTarget(w)}
                    disabled={!w.phone}
                    title={w.phone ? undefined : "Sin teléfono no hay a quién escribir"}
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Avisar hueco
                  </Button>
                  <Button size="sm" className="gap-1.5" onClick={() => openConvert(w)}>
                    <CalendarCheck className="h-3.5 w-3.5" /> Convertir en cita
                  </Button>
                  <Button
                    size="icon"
                    variant="outline"
                    className="size-[34px] text-melocoton-tinta hover:bg-melocoton hover:text-melocoton-tinta"
                    onClick={() => handleDelete(w)}
                    aria-label={`Quitar a ${w.clientName} de la lista de espera`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <AltaEnListaDialog
        open={altaOpen}
        onOpenChange={setAltaOpen}
        onSave={(datos) => {
          const nueva = addWaitlist(datos);
          avisar(`${datos.clientName.split(" ")[0]} apuntada en la lista de espera`, () => deleteWaitlist(nueva.id));
        }}
      />

      <AvisoDeHuecoDialog
        entry={avisoTarget}
        salonName={salonName}
        servicio={avisoTarget ? serviceMap[avisoTarget.serviceId]?.name : undefined}
        sugerida={(avisoTarget && !lastFreedSlot && huecos.get(avisoTarget.id)?.fecha) || horaSugerida(lastFreedSlot)}
        onOpenChange={(o) => !o && setAvisoTarget(null)}
      />

      <NewAppointmentDialog
        open={convertOpen}
        onOpenChange={setConvertOpen}
        defaultClientName={convertTarget?.clientName}
        defaultPhone={convertTarget?.phone}
        defaultServiceId={convertTarget?.serviceId}
        defaultEmployeeId={
          (convertTarget && huecos.get(convertTarget.id)?.employeeId) ||
          (convertTarget?.preferredEmployeeId === "any" ? undefined : convertTarget?.preferredEmployeeId)
        }
        defaultDate={convertTarget ? huecos.get(convertTarget.id)?.fecha : undefined}
        onCreated={handleConverted}
      />

    </div>
  );
}

/**
 * Apuntar a alguien en la lista de espera.
 *
 * No existía: la lista solo se podía leer y vaciar, así que sus únicas
 * entradas eran las de ejemplo del seed — y en un salón real, ninguna. Sin
 * esto, "lista de espera vacía" era la única pantalla posible.
 */
function AltaEnListaDialog({
  open,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (datos: Omit<WaitlistEntry, "id" | "createdAt">) => void;
}) {
  const services = useSalonStore((s) => s.services);
  const tipo = useBusinessType();
  const employees = useEquipo();
  // Con un solo profesional no hay preferencia que apuntar: se guarda "any",
  // que es lo que ya hace el resto del flujo cuando da igual quién atienda.
  const soloUno = esSoloUnProfesional(employees);
  const activos = services.filter((s) => s.active !== false);

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState<string>("");
  const [preferredEmployeeId, setPreferredEmployeeId] = useState<EmployeeId | "any">("any");
  const [preferredRange, setPreferredRange] = useState("");

  useEffect(() => {
    if (!open) return;
    setClientName("");
    setPhone("");
    setServiceId(activos[0]?.id ?? "");
    setPreferredEmployeeId("any");
    setPreferredRange("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientName.trim()) {
      toast.error("Escribe el nombre de quien espera");
      return;
    }
    onSave({
      clientName: clientName.trim(),
      phone: phone.trim(),
      serviceId,
      preferredEmployeeId,
      preferredRange: preferredRange.trim(),
    });
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Apuntar en la lista de espera</DialogTitle>
            <DialogDescription>
              Para quien pide un hueco que ahora mismo no tienes. Con su teléfono podrás avisarle
              por WhatsApp en cuanto se libere uno.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="we-name">Nombre</Label>
                <Input
                  id="we-name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Nombre de la clienta"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="we-phone">Teléfono</Label>
                <Input
                  id="we-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+34 600 000 000"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Servicio</Label>
              <Select value={serviceId} onValueChange={setServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Elige un servicio" />
                </SelectTrigger>
                <SelectContent>
                  {activos.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!soloUno && (
              <div className="space-y-1.5">
                <Label className="capitalize">{professionalWord(tipo)}</Label>
                <Select
                  value={preferredEmployeeId}
                  onValueChange={(v) => setPreferredEmployeeId(v as EmployeeId | "any")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Cualquiera</SelectItem>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="we-range">Cuándo le viene bien</Label>
              <Input
                id="we-range"
                value={preferredRange}
                onChange={(e) => setPreferredRange(e.target.value)}
                placeholder="Tardes entre semana · Sábado por la mañana"
              />
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit">Apuntar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Avisar de un hueco concreto por WhatsApp.
 *
 * Se elige el día y la hora —ya prerrellenados con el hueco que se acaba de
 * liberar— y se abre `wa.me` con el mensaje escrito. Aquí no se envía nada:
 * lo manda el dueño desde su propio WhatsApp, que es el único canal que
 * existe hoy de verdad.
 */
function AvisoDeHuecoDialog({
  entry,
  salonName,
  servicio,
  sugerida,
  onOpenChange,
}: {
  entry: WaitlistEntry | null;
  salonName: string;
  servicio?: string;
  sugerida: Date;
  onOpenChange: (o: boolean) => void;
}) {
  const [fecha, setFecha] = useState(toDateInput(sugerida));
  const [hora, setHora] = useState(toTimeInput(sugerida));
  const entryId = entry?.id;

  useEffect(() => {
    if (!entryId) return;
    setFecha(toDateInput(sugerida));
    setHora(toTimeInput(sugerida));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId]);

  if (!entry) return <Dialog open={false} onOpenChange={onOpenChange} />;

  function handleAbrirWhatsApp() {
    if (!entry) return;
    if (!fecha || !hora) {
      toast.error("Elige el día y la hora del hueco");
      return;
    }
    const startISO = new Date(`${fecha}T${hora}:00`).toISOString();
    window.open(
      enlaceDeHueco(entry.phone, {
        clientName: entry.clientName,
        salonName,
        startISO,
        servicio,
      }),
      "_blank",
      "noopener,noreferrer",
    );
    onOpenChange(false);
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Avisar a {entry.clientName}</DialogTitle>
          <DialogDescription>
            Se abre tu WhatsApp con la hora concreta ya escrita. El mensaje lo envías tú.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="av-fecha">Día del hueco</Label>
            <Input
              id="av-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="av-hora">Hora</Label>
            <Input
              id="av-hora"
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" className="gap-1.5" onClick={handleAbrirWhatsApp}>
            <MessageCircle className="h-4 w-4" /> Abrir WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
