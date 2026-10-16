import { useEffect, useState } from "react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { usaTpv123 } from "@/lib/plan-basico";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import { EtiquetaFicha, FichaCompleta, type DatosColorTPV } from "@/components/FichaCompleta";
import { recargoActivo } from "@/lib/recargo-activo";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { historialDeFallos, penaltyReasonLabel } from "@/lib/plantones";
import { BandaDeuda } from "@/components/DeudaCliente";
import { useMiEmployeeId, usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { whatsappUrl } from "@/lib/campanas";
import { toDateKey } from "@/lib/reparto";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { eur, hora } from "@/lib/copy";
import type { Client } from "@/lib/mock/types";
import { EditarAvatar } from "@/components/EditarAvatar";
import { FichaContenedor } from "@/components/FichaContenedor";
import { Desplegable } from "@/components/Desplegable";
import { useFichas } from "@/lib/use-fichas";
import { StatusBadge } from "@/components/StatusBadge";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Calendar, ChevronRight, MessageCircle, Phone, Plus, TriangleAlert, Ban, Unlock, Mail } from "lucide-react";

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
  const origenTpv123 = useSalonStore((s) => usaTpv123(s.salonProfile));
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const equipo = useEquipo();
  const noShowFeeEur = useSalonStore((s) => s.salonProfile.noShowFeeEur);
  const conRecargo = recargoActivo({ noShowFeeEur });
  const updateClient = useSalonStore((s) => s.updateClient);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const reviewPenalty = useSalonStore((s) => s.reviewPenalty);
  const setManualBlock = useSalonStore((s) => s.setManualBlock);
  // Lote 11: sin «ver todas», la ficha completa solo de quien ha tenido cita con ella.
  const permisos = usePermisos();
  const mio = useMiEmployeeId();
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
  const { abrirCita, puedeVolver, volver } = useFichas();
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
    return null;
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
  const accion = "inline-flex h-10 items-center gap-1.5 rounded-full border border-input bg-card px-4 text-[13px] font-bold text-cafe-medio hover:bg-nata focus-visible:outline-2 focus-visible:outline-primary";

  const ajena = !puede(permisos, "clienta.ver-todas") && !appointments.some((a) => a.clientId === client.id && a.employeeId === mio);
  const puedeBloquear = puede(permisos, "clienta.bloquear");
  const veDeudas = puede(permisos, "recargo.gestionar");

  // La próxima cita (la primera de las futuras) va destacada; el resto, en lista.
  const proxima = upcoming[0];
  const masProximas = upcoming.slice(1);
  const empProxima = proxima ? equipo.find((e) => e.id === proxima.employeeId) : undefined;
  const lineaCita = (a: typeof upcoming[number]) => {
    const e = equipo.find((x) => x.id === a.employeeId);
    return `${serviceLabelOf(a, carta) || "—"}${!soloUno && e ? ` · con ${e.name}` : ""}`;
  };
  const filaCita = "flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left text-sm hover:bg-nata focus-visible:outline-2 focus-visible:outline-primary";

  // Cabecera de PERSONA: avatar grande y nombre en serif. Nada de barras de
  // color ni horas: eso es de las citas.
  const cabecera = (
    <div className="flex items-center gap-4">
      <EditarAvatar tipo="clienta" id={client.id} nombre={client.name} size="2xl" />
      <div className="min-w-0">
        <p className="font-display text-[28px] leading-tight font-medium break-words">{client.name}</p>
        {client.phone && <p className="text-[14px] text-muted-foreground tabular-nums">{client.phone}</p>}
        {client.email && (
          <p className="flex items-center gap-1.5 truncate text-[12.5px] text-muted-foreground">
            <Mail className="size-3.5 shrink-0" aria-hidden="true" />
            <span className="truncate">{client.email}</span>
          </p>
        )}
      </div>
    </div>
  );

  const body = ajena ? (
    <div>
      {cabecera}
      <p className="mt-5 rounded-2xl border border-lino bg-superficie px-4 py-3 text-[14px] text-cafe-medio">
        Esta clienta no es tuya todavía. Puedes darle cita y, desde entonces, verás su ficha.
      </p>
      <Button className="mt-4 rounded-full px-5 font-bold" onClick={() => setNuevaAbierta(true)}>
        Darle cita
      </Button>
    </div>
  ) : (
    <div>
      {cabecera}
      {/* Una acción primaria (dar cita) y dos de contacto, neutras. */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Button type="button" className="h-10 gap-1.5 rounded-full px-5 font-bold" onClick={() => setNuevaAbierta(true)}>
          <Plus className="size-[15px]" strokeWidth={1.8} />
          Nueva cita
        </Button>
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
      </div>

      {/* Próxima cita: lo primero que se quiere saber, y un clic lleva a ella. */}
      <div className="mt-5">
        <EtiquetaFicha>Próxima cita</EtiquetaFicha>
        {proxima ? (
          <button
            type="button"
            onClick={() => abrirCita(proxima.id)}
            aria-label={`Abrir la cita del ${new Date(proxima.start).toLocaleDateString("es", { day: "numeric", month: "long" })}`}
            className="group flex w-full items-center gap-3 rounded-2xl border border-border bg-card px-3.5 py-3 text-left hover:bg-nata focus-visible:outline-2 focus-visible:outline-primary"
          >
            <span className="grid w-14 shrink-0 place-items-center rounded-lg bg-arena py-1.5 text-cafe" aria-hidden="true">
              <span className="text-[11px] font-bold uppercase">{new Date(proxima.start).toLocaleDateString("es", { month: "short" }).replace(".", "")}</span>
              <span className="text-[22px] leading-none font-extrabold tabular-nums">{new Date(proxima.start).getDate()}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2">
                <span className="text-[15px] font-extrabold tabular-nums">{hora(proxima.start)}</span>
                {textoHoy && <span className="text-[12px] font-extrabold text-terracota">{textoHoy.startsWith("Está") ? "Ahora" : textoHoy.startsWith("Ha venido") ? "Ya vino hoy" : "Hoy"}</span>}
              </span>
              <span className="block truncate text-[13.5px] text-cafe-medio">{serviceLabelOf(proxima, carta) || "—"}{!soloUno && empProxima ? ` · con ${empProxima.name}` : ""}</span>
              <BookingAnswersSummary answers={proxima.bookingAnswers} />
            </span>
            <StatusBadge status={proxima.status} />
            <ChevronRight className="size-4 shrink-0 text-cafe-suave transition-transform group-hover:translate-x-0.5" strokeWidth={1.7} aria-hidden="true" />
          </button>
        ) : textoHoy ? (
          <button
            type="button"
            onClick={() => deHoy && abrirCita(deHoy.id)}
            className="flex w-full items-start gap-2.5 rounded-2xl bg-salvia-clara px-3.5 py-3 text-left text-[13px] text-hoja-tinta hover:bg-salvia-suave"
          >
            <Calendar className="mt-px size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
            <span className="tabular-nums">{textoHoy}</span>
          </button>
        ) : (
          <p className="text-[13px] text-muted-foreground">Sin cita próxima.</p>
        )}
      </div>

      <div className="mt-3.5 space-y-3">
      {/* Contador de plantones — el contexto antes que la deuda: saber que
          alguien ha fallado dos veces en tres meses cambia la decisión aunque
          ya te haya pagado la penalización. */}
      {veDeudas && plantones && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-melocoton-borde bg-melocoton px-3.5 py-3 text-melocoton-tinta">
          <TriangleAlert className="size-[15px] shrink-0" strokeWidth={1.6} aria-hidden="true" />
          <p className="text-[12.5px]">{plantones}</p>
        </div>
      )}

      {/* Lo que debe y las tres salidas: cobrada, perdonada, o bloquear.
          Mismo componente que el inicio y el detalle de la cita, para que las
          tres pantallas no puedan decir cosas distintas. */}
      {conRecargo && veDeudas && <BandaDeuda client={client} />}
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

      <FichaCompleta ficha={ficha} client={client} origenTpv123={origenTpv123} onAbrirCita={abrirCita} onAddColor={(datos: DatosColorTPV) => {
        const formula = [datos.producto.trim(), datos.cantidad.trim(), datos.raiz.trim() && `${datos.raiz.trim()} raíz`, datos.medios.trim() && `medios ${datos.medios.trim()}`, datos.puntas.trim() && `puntas ${datos.puntas.trim()}`, datos.tiempo.trim()].filter(Boolean).join(", ");
        const fecha = new Date(`${datos.fecha}T12:00:00`).toISOString();
        addAppointment({ clientId: client.id, clientName: client.name, serviceIds: [], employeeId: equipo[0]?.id ?? "mario", start: fecha, duration: 0, priceEur: 0, status: "completed", origen: origenTpv123 ? "tpv123" : "sishow", colorFormula: formula, technicalNotes: datos.notas.trim() || undefined }, { name: client.name, phone: client.phone, email: client.email });
      }} antesDelHistorial={<>

      {/* Observaciones */}
      <div>
        <EtiquetaFicha>Notas y preferencias</EtiquetaFicha>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={saveNotes}
          rows={3}
          placeholder="Usa el número 8 · Le vendimos el champú de árbol de té, preguntar qué tal"
          className="resize-y text-sm"
        />
      </div>

      {/* El resto de próximas citas */}
      {masProximas.length > 0 && (
        <div>
          <EtiquetaFicha>Más citas por venir</EtiquetaFicha>
          <ul className="divide-y divide-border/60">
            {masProximas.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => abrirCita(a.id)} className={filaCita}>
                  <span className="w-24 shrink-0 text-[12.5px] font-bold tabular-nums">
                    {new Date(a.start).toLocaleDateString("es", { day: "2-digit", month: "short" })} · {hora(a.start)}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{lineaCita(a)}</span>
                  <StatusBadge status={a.status} />
                  <ChevronRight className="size-4 shrink-0 text-cafe-suave" strokeWidth={1.7} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Anuladas y plantones: plegado, es historia que casi nunca se mira. */}
      {history.length > 0 && (
        <div className="mt-3">
          <Desplegable titulo="Anuladas y plantones" resumen={`${history.length} ${history.length === 1 ? "cita" : "citas"}`}>
            <ul className="divide-y divide-border/60">
              {history.map((a) => (
                <li key={a.id}>
                  <button type="button" onClick={() => abrirCita(a.id)} className={filaCita}>
                    <span className="w-16 shrink-0 text-[12.5px] text-muted-foreground tabular-nums">
                      {new Date(a.start).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-bold">{lineaCita(a)}</span>
                    <span className="text-sm font-bold tabular-nums">{eur(a.priceEur)}</span>
                    <StatusBadge status={a.status} />
                  </button>
                </li>
              ))}
            </ul>
          </Desplegable>
        </div>
      )}
</>} />

      {/* Reserva por internet: solo si hay algo que decidir; si no, plegado. */}
      {puedeBloquear && (!conRecargo || client.manualBlock) && (
        <div className="mt-5">
          <Desplegable titulo="Reserva por internet" resumen={client.manualBlock ? "Bloqueada a mano" : "Puede reservar"} abiertoAlInicio={!!client.manualBlock}>
            <div data-vaul-no-drag className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12.5px] font-bold">
                {client.manualBlock ? "Reserva por internet bloqueada a mano" : "Puede reservar por internet"}
              </p>
              <Button size="sm" variant="outline" onClick={() => setManualBlock(client.id, !client.manualBlock)}>
                {client.manualBlock ? <Unlock className="size-4" /> : <Ban className="size-4" />}
                {client.manualBlock ? "Desbloquear" : "Bloquear reserva por internet"}
              </Button>
            </div>
          </Desplegable>
        </div>
      )}
    </div>
  );

  return (
    <>
      <FichaContenedor
        tipo="clienta"
        open={open}
        onOpenChange={onOpenChange}
        titulo={`Ficha de ${client.name}`}
        descripcion={`Contacto, visitas, color y observaciones de ${client.name}.`}
        onVolver={puedeVolver ? volver : undefined}
      >
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-5 pb-8">{body}</div>
      </FichaContenedor>
      <NewAppointmentDialog
        open={nuevaAbierta}
        onOpenChange={setNuevaAbierta}
        defaultClientName={client.name}
        defaultPhone={client.phone}
      />
    </>
  );
}
