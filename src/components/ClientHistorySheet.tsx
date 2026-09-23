import { useEffect, useState } from "react";
import { useSalonStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { clientFrequency } from "@/lib/derive";
import { historialDeFallos, penaltyReasonLabel } from "@/lib/plantones";
import { BandaDeuda } from "@/components/DeudaCliente";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { eur, eurRedondo } from "@/lib/copy";
import type { Client } from "@/lib/mock/types";
import { StylistDot } from "@/components/StylistAvatar";
import { ClientAvatar } from "@/components/ClientAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState } from "@/components/EmptyState";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from "@/components/ui/drawer";
import { CalendarX, Mail, Phone, CalendarClock, TriangleAlert } from "lucide-react";

export interface ClientHistorySheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ficha completa del cliente: contacto, KPIs, próximas citas, observaciones
 * editables e historial. Antes era un `Sheet` estrecho lateral; ahora es un
 * `Dialog` centrado y ancho en escritorio y un `Drawer` inferior en móvil —
 * mismo patrón responsive que `NewAppointmentDialog`. Mantiene exactamente
 * el store y los datos existentes: solo cambia la presentación.
 */
export function ClientHistorySheet({
  client: clientProp,
  open,
  onOpenChange,
}: ClientHistorySheetProps) {
  const isMobile = useIsMobile();
  const appointments = useSalonStore((s) => s.appointments);
  const updateClient = useSalonStore((s) => s.updateClient);
  const reviewPenalty = useSalonStore((s) => s.reviewPenalty);
  // Con un solo profesional, "con Adam" bajo cada visita no informa de nada.
  const soloUno = esSoloUnProfesional(useEquipo());
  // Igual que AppointmentDetailSheet: la prop llega congelada en el momento
  // del clic (quien abre el sheet guarda una copia). Cobrado/Perdonar cambian
  // el store desde AQUÍ MISMO, con el sheet todavía abierto — sin releer la
  // versión viva, el badge de la penalización se habría quedado en rojo tras
  // pulsar "Perdonar".
  const stored = useSalonStore((s) =>
    clientProp ? s.clients.find((c) => c.id === clientProp.id) : undefined,
  );
  const client = stored ?? clientProp;
  const stats = client ? clientFrequency(appointments, client.id) : null;
  // Plantones y retrasos sin avisar de los últimos 3 meses — ver lib/plantones.ts.
  const plantones = client ? historialDeFallos(appointments, client.id) : null;

  // Borrador local para no reescribir el store en cada tecla: se guarda al salir del campo.
  const [notes, setNotes] = useState(client?.notes ?? "");
  useEffect(() => {
    setNotes(client?.notes ?? "");
  }, [client?.id, client?.notes]);

  function saveNotes() {
    if (!client) return;
    const trimmed = notes.trim();
    if (trimmed === (client.notes ?? "")) return;
    updateClient(client.id, { notes: trimmed });
  }

  const ownAppointments = client ? appointments.filter((a) => a.clientId === client.id) : [];
  const now = Date.now();
  const upcoming = ownAppointments
    .filter((a) => a.status !== "cancelled" && +new Date(a.start) >= now)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));
  const history = ownAppointments
    .filter((a) => +new Date(a.start) < now || a.status === "cancelled")
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));

  if (!client || !stats) {
    // Se mantiene montado el contenedor vacío para que el cierre no dé un
    // salto visual; sin cliente no hay nada que pintar dentro.
    return isMobile ? (
      <Drawer open={false} onOpenChange={onOpenChange} />
    ) : (
      <Dialog open={false} onOpenChange={onOpenChange} />
    );
  }

  const body = (
    <div className="space-y-6">
      {/* Cabecera: identidad y contacto */}
      <div className="flex flex-wrap items-center gap-4">
        <ClientAvatar name={client.name} size="xl" />
        <div className="min-w-0">
          <h2 className="font-display text-2xl">{client.name}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" aria-hidden="true" />
              {client.phone}
            </span>
            {client.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden="true" />
                {client.email}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contador de plantones — el contexto antes que la deuda: saber que
          alguien ha fallado dos veces en tres meses cambia la decisión aunque
          ya te haya pagado la penalización. */}
      {plantones && (
        <div className="flex items-center gap-2 rounded-xl border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3">
          <TriangleAlert className="size-4 shrink-0 text-[var(--warning)]" aria-hidden="true" />
          <p className="text-sm">{plantones}</p>
        </div>
      )}

      {/* Lo que debe y las tres salidas: cobrada, perdonada, o bloquear.
          Mismo componente que el inicio y el detalle de la cita, para que las
          tres pantallas no puedan decir cosas distintas. */}
      <BandaDeuda client={client} />
      {(client.penaltyEur ?? 0) > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <p>
            {penaltyReasonLabel(client)}
            {client.penaltyReviewedAt &&
              ` · Revisado el ${new Date(client.penaltyReviewedAt).toLocaleDateString("es", { day: "numeric", month: "short" })}`}
          </p>
          {!client.penaltyReviewedAt && (
            <Button size="sm" variant="outline" onClick={() => reviewPenalty(client.id)}>
              Mantener pendiente
            </Button>
          )}
        </div>
      )}

      {/* KPIs del cliente */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="font-display text-xl">{stats.pastVisits}</p>
          <p className="text-xs text-muted-foreground">Visitas</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="font-display text-xl">{eurRedondo(stats.totalSpent)}</p>
          <p className="text-xs text-muted-foreground">Gasto total</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="truncate font-display text-xl">{stats.favoriteService ?? "—"}</p>
          <p className="text-xs text-muted-foreground">Servicio favorito</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="font-display text-xl">
            {stats.lastVisit
              ? new Date(stats.lastVisit).toLocaleDateString("es", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Última visita</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-card p-3 text-center">
          <p className="font-display text-xl">
            {stats.nextVisit
              ? new Date(stats.nextVisit).toLocaleDateString("es", {
                  day: "2-digit",
                  month: "short",
                })
              : "—"}
          </p>
          <p className="text-xs text-muted-foreground">Próxima cita</p>
        </div>
      </div>

      {/* Próximas citas */}
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <CalendarClock className="size-3.5" aria-hidden="true" />
          Próximas citas
        </p>
        {upcoming.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border/60 px-4 py-3 text-sm text-muted-foreground">
            Sin citas futuras programadas.
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => {
              const emp = employeeMap[a.employeeId];
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
                >
                  <div className="w-20 shrink-0 text-xs text-muted-foreground">
                    {new Date(a.start).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    {" · "}
                    {new Date(a.start).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {!soloUno && <StylistDot employeeId={a.employeeId} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{serviceLabelOf(a) || "—"}</p>
                    {!soloUno && <p className="text-xs text-muted-foreground">con {emp?.name}</p>}
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Observaciones */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Observaciones
        </p>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={3}
          placeholder="Usa el número 8 · Le vendimos el champú de árbol de té, preguntar qué tal"
          className="resize-y text-sm"
        />
      </div>

      {/* Historial de citas */}
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Historial de citas
        </p>
        {history.length === 0 ? (
          <EmptyState
            icon={CalendarX}
            title="Sin citas todavía"
            description="Este cliente aún no tiene reservas registradas."
          />
        ) : (
          <div className="divide-y divide-border/60">
            {history.map((a) => {
              const emp = employeeMap[a.employeeId];
              return (
                <div key={a.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="w-16 shrink-0 text-xs text-muted-foreground">
                    {new Date(a.start).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                  {!soloUno && <StylistDot employeeId={a.employeeId} />}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{serviceLabelOf(a) || "—"}</p>
                    {!soloUno && (
                      <p className="text-xs text-muted-foreground">con {emp?.name}</p>
                    )}
                  </div>
                  <span className="text-sm font-medium">{eur(a.priceEur)}</span>
                  <StatusBadge status={a.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent>
          <DrawerHeader className="text-left">
            <DrawerTitle>Ficha de cliente</DrawerTitle>
            <DrawerDescription>Contacto, historial y observaciones.</DrawerDescription>
          </DrawerHeader>
          <div className="max-h-[75vh] overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Ficha de {client.name}</DialogTitle>
          <DialogDescription>Contacto, historial y observaciones del cliente.</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}
