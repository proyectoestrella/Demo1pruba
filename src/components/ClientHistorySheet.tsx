import { useEffect, useState } from "react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import { EtiquetaFicha, FichaCompleta, type DatosColorTPV } from "@/components/FichaCompleta";
import { recargoActivo } from "@/lib/recargo-activo";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { historialDeFallos, penaltyReasonLabel } from "@/lib/plantones";
import { BandaDeuda } from "@/components/DeudaCliente";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { whatsappUrl } from "@/lib/campanas";
import { toDateKey } from "@/lib/reparto";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { eur, hora } from "@/lib/copy";
import type { Client } from "@/lib/mock/types";
import { ClientAvatar } from "@/components/ClientAvatar";
import { StatusBadge } from "@/components/StatusBadge";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar, MessageCircle, Phone, Plus, TriangleAlert, Ban, Unlock, Mail } from "lucide-react";

export interface ClientHistorySheetProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Ficha de la clienta en el panel lateral derecho, como el prototipo «Arena»:
 * identidad, WhatsApp / Llamar / Nueva cita, si viene hoy, sus cifras, último
 * color con «Añadir color de TPV 123», próximas citas, observaciones e
 * historial. En móvil ocupa toda la pantalla. Mismo store y mismas acciones
 * de siempre: solo cambia la presentación.
 */
export function ClientHistorySheet({
  client: clientProp,
  open,
  onOpenChange,
}: ClientHistorySheetProps) {
  const appointments = useSalonStore((s) => s.appointments);
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const equipo = useEquipo();
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const conRecargo = recargoActivo({ noShowFeeEur });
  const updateClient = useSalonStore((s) => s.updateClient);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const reviewPenalty = useSalonStore((s) => s.reviewPenalty);
  const setManualBlock = useSalonStore((s) => s.setManualBlock);
  // Con un solo profesional, "con Adam" bajo cada visita no informa de nada.
  const soloUno = esSoloUnProfesional(equipo);
  // Igual que AppointmentDetailSheet: la prop llega congelada en el momento
  // del clic (quien abre el sheet guarda una copia). Cobrado/Perdonar cambian
  // el store desde AQUÍ MISMO, con el sheet todavía abierto — sin releer la
  // versión viva, el badge de la penalización se habría quedado en rojo tras
  // pulsar "Perdonar".
  const stored = useSalonStore((s) =>
    clientProp ? s.clients.find((c) => c.id === clientProp.id) : undefined,
  );
  const client = stored ?? clientProp;
  const carta = selectServiceMap(services);
  const [nuevaAbierta, setNuevaAbierta] = useState(false);
  const ficha = client ? fichaDeClienta(client.id, { citas: appointments, clientes: clients, servicios: services, equipo, ahora: new Date() }) : null;
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
    .filter((a) => a.status !== "completed" && (+new Date(a.start) < now || a.status === "cancelled"))
    .sort((a, b) => +new Date(b.start) - +new Date(a.start));

  if (!client || !ficha) {
    // Se mantiene montado el contenedor vacío para que el cierre no dé un
    // salto visual; sin cliente no hay nada que pintar dentro.
    return <Sheet open={false} onOpenChange={onOpenChange} />;
  }

  // ¿Viene hoy? Es lo primero que se quiere saber al abrir la ficha.
  const hoyClave = toDateKey(new Date());
  const deHoy = ownAppointments
    .filter((a) => a.status !== "cancelled" && toDateKey(new Date(a.start)) === hoyClave)
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))[0];
  let textoHoy: string | null = null;
  if (deHoy) {
    const ini = +new Date(deHoy.start);
    const fin = ini + deHoy.duration * 60_000;
    const con = soloUno ? "" : ` con ${equipo.find((e) => e.id === deHoy.employeeId)?.name ?? ""}`;
    const que = `${serviceLabelOf(deHoy, carta)}${con}`;
    textoHoy =
      fin <= now
        ? `Ha venido hoy a las ${hora(deHoy.start)} · ${que}`
        : ini <= now
          ? `Está en el salón desde las ${hora(deHoy.start)} · ${que}`
          : `Viene hoy a las ${hora(deHoy.start)} · ${que}`;
  }
  const accion = "inline-flex h-[34px] items-center gap-1.5 rounded-full border border-input bg-card px-[13px] text-[12.5px] font-bold hover:bg-nata";

  const body = (
    <div>
      {/* Identidad y acciones */}
      <div className="flex items-center gap-3">
        <ClientAvatar name={client.name} size="xl" />
        <div className="min-w-0">
          <p className="font-display text-[26px] leading-tight font-medium">{client.name}</p>
          <p className="text-muted-foreground tabular-nums">{client.phone}</p>
          {client.email && (
            <p className="flex items-center gap-1.5 truncate text-[12.5px] text-muted-foreground">
              <Mail className="size-3.5" aria-hidden="true" />
              {client.email}
            </p>
          )}
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {client.phone && (
          <>
            <a className={accion} href={whatsappUrl(client.phone, "")} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="size-[15px]" strokeWidth={1.6} />
              WhatsApp
            </a>
            <a className={accion} href={`tel:${client.phone.replace(/\s+/g, "")}`}>
              <Phone className="size-[15px]" strokeWidth={1.6} />
              Llamar
            </a>
          </>
        )}
        <button type="button" className={accion} onClick={() => setNuevaAbierta(true)}>
          <Plus className="size-[15px]" strokeWidth={1.6} />
          Nueva cita
        </button>
      </div>
      {textoHoy && (
        <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl bg-salvia-clara px-3.5 py-3 text-[12.5px] text-hoja-tinta">
          <Calendar className="mt-px size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
          <span className="tabular-nums">{textoHoy}</span>
        </div>
      )}

      <div className="mt-3.5 space-y-3">
      {(!conRecargo || client.manualBlock) && (
        // Vaul no debe interpretar el toque del botón como arrastre del cajón.
        <div data-vaul-no-drag className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3">
          <p className="text-[12.5px] font-bold">
            {client.manualBlock ? "Reserva por internet bloqueada a mano" : "Puede reservar por internet"}
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setManualBlock(client.id, !client.manualBlock)}
          >
            {client.manualBlock ? <Unlock className="size-4" /> : <Ban className="size-4" />}
            {client.manualBlock ? "Desbloquear" : "Bloquear reserva por internet"}
          </Button>
        </div>
      )}

      {/* Contador de plantones — el contexto antes que la deuda: saber que
          alguien ha fallado dos veces en tres meses cambia la decisión aunque
          ya te haya pagado la penalización. */}
      {plantones && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-melocoton-borde bg-melocoton px-3.5 py-3 text-melocoton-tinta">
          <TriangleAlert className="size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
          <p className="text-[12.5px]">{plantones}</p>
        </div>
      )}

      {/* Lo que debe y las tres salidas: cobrada, perdonada, o bloquear.
          Mismo componente que el inicio y el detalle de la cita, para que las
          tres pantallas no puedan decir cosas distintas. */}
      {conRecargo && <BandaDeuda client={client} />}
      {conRecargo && (client.penaltyEur ?? 0) > 0 && (
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

      </div>

      <FichaCompleta ficha={ficha} onAddColor={(datos: DatosColorTPV) => {
        const formula = [datos.producto.trim(), datos.cantidad.trim(), datos.raiz.trim() && `${datos.raiz.trim()} raíz`, datos.medios.trim() && `medios ${datos.medios.trim()}`, datos.puntas.trim() && `puntas ${datos.puntas.trim()}`, datos.tiempo.trim()].filter(Boolean).join(", ");
        const fecha = new Date(`${datos.fecha}T12:00:00`).toISOString();
        addAppointment({ clientId: client.id, clientName: client.name, serviceIds: [], employeeId: equipo[0]?.id ?? "mario", start: fecha, duration: 0, priceEur: 0, status: "completed", origen: "tpv123", colorFormula: formula, technicalNotes: datos.notas.trim() || undefined }, { name: client.name, phone: client.phone, email: client.email });
      }} antesDelHistorial={<>

      {/* Próximas citas */}
      <div>
        <EtiquetaFicha>Próximas citas</EtiquetaFicha>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl border-[1.5px] border-dashed border-lino-fuerte px-4 py-3 text-[12.5px] text-muted-foreground">
            Sin citas futuras programadas.
          </p>
        ) : (
          <div className="space-y-2">
            {upcoming.map((a) => {
              const emp = equipo.find((e) => e.id === a.employeeId);
              return (
                <div
                  key={a.id}
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-2.5 text-sm"
                >
                  <div className="w-20 shrink-0 text-[12.5px] font-bold tabular-nums">
                    {new Date(a.start).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    {" · "}
                    {new Date(a.start).toLocaleTimeString("es", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{serviceLabelOf(a, carta) || "—"}</p>
                    <BookingAnswersSummary answers={a.bookingAnswers} />
                    {!soloUno && <p className="text-[12.5px] text-muted-foreground">con {emp?.name}</p>}
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Observaciones */}
      <div>
        <EtiquetaFicha>Observaciones</EtiquetaFicha>
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
      {history.length > 0 && <div>
        <EtiquetaFicha>Anuladas y plantones</EtiquetaFicha>
          <div className="divide-y divide-border/60">
            {history.map((a) => {
              const emp = equipo.find((e) => e.id === a.employeeId);
              return (
                <div key={a.id} className="flex items-center gap-3 py-3 text-sm">
                  <div className="w-16 shrink-0 text-[12.5px] text-muted-foreground tabular-nums">
                    {new Date(a.start).toLocaleDateString("es", {
                      day: "2-digit",
                      month: "short",
                    })}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{serviceLabelOf(a, carta) || "—"}</p>
                    {!soloUno && (
                      <p className="text-xs text-muted-foreground">con {emp?.name}</p>
                    )}
                  </div>
                  <span className="text-sm font-bold tabular-nums">{eur(a.priceEur)}</span>
                  <StatusBadge status={a.status} />
                </div>
              );
            })}
          </div>
      </div>}
</>} />    </div>
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" panel="ficha" className="flex w-full flex-col gap-0 p-0">
          <SheetHeader className="border-b border-border px-5 py-4 text-left">
            <SheetTitle className="text-base font-extrabold">Ficha de clienta</SheetTitle>
            <SheetDescription className="sr-only">Contacto, visitas, color y observaciones de {client.name}.</SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8">{body}</div>
        </SheetContent>
      </Sheet>
      <NewAppointmentDialog
        open={nuevaAbierta}
        onOpenChange={setNuevaAbierta}
        defaultClientName={client.name}
        defaultPhone={client.phone}
      />
    </>
  );
}
