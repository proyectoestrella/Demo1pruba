import { useCitasVisibles, useEquipoVisible } from "@/lib/accesos-panel";
import { EnlaceClienta } from "@/components/EnlaceClienta";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { usePlegado } from "@/lib/use-plegado";
import { VentanaConfirmar } from "@/components/VentanaConfirmar";
import { DuracionOtra } from "@/components/DuracionOtra";
import { toast } from "sonner";
import { AlertTriangle, CalendarDays, Check, Clock, Clock3, UserRound } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { duracionPropuesta } from "@/lib/derive";
import { enlaceDeFianza } from "@/lib/avisos";
import { eur } from "@/lib/copy";
import type { Appointment } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { BookingAnswersSummary } from "@/components/BookingAnswersSummary";
import { SenalCita } from "@/components/SenalCita";
import { deadlineHours, depositDueAt } from "@/lib/deposit-deadline";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { importeSenal, mensajeErrorSenal, prepararPeticionSenal, reglaSenal } from "@/lib/senal";

export interface PendingRequestsBannerProps {
  /** Abre el detalle de la cita (AppointmentDetailSheet) para cambiar duración u hora. */
  onOpenDetail: (appointment: Appointment) => void;
  /** Clave para plegar el bloque desde su cabecera (recordado); sin ella, siempre abierto. */
  plegable?: string;
}

/** Mismos valores que el desplegable de duración de `NewAppointmentDialog`. */
const DURATION_OPTIONS_MIN = [15, 30, 40, 45, 60, 75, 90, 120, 150, 180];

/**
 * Franja de "solicitudes pendientes de confirmar": las reservas que llegaron
 * de la web pública (`s.$salonSlug.book.tsx`) y todavía no ha revisado el
 * salón. Se usa tanto en el inicio del panel (`app.index.tsx`) como en la
 * pantalla de citas (`app.appointments.tsx`) — mismo componente para que no
 * se desvíen entre sí, igual que `AppointmentDetailSheet` o `StatusBadge`.
 *
 * Cuando el salón tiene `duracionFlexible` activo (caso PeluChic: "la duración
 * la decido yo, no la clienta"), cada tarjeta trae su propio desplegable de
 * duración editable — la solicitud se confirma con la duración que decida el
 * salón, no con la de catálogo. Con `duracionFlexible` apagado el bloque se
 * comporta exactamente igual que antes.
 */
export function PendingRequestsBanner({ onOpenDetail, plegable }: PendingRequestsBannerProps) {
  const [abierto, alternar] = usePlegado(plegable, !plegable);
  const appointments = useCitasVisibles();
  const clients = useSalonStore((s) => s.clients);
  const services = useSalonStore((s) => s.services);
  const duracionClientas = useSalonStore((s) => s.salonProfile.duracionClientas);
  const updateAppointment = useSalonStore((s) => s.updateAppointment);
  const cancelAppointment = useSalonStore((s) => s.cancelAppointment);
  const pedirSenal = useSalonStore((s) => s.pedirSenal);
  const reglaSen = reglaSenal(useSalonStore((s) => s.salonProfile));
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const depositEnabled = useSalonStore((s) => !!s.salonProfile.depositEnabled);
  const depositBizumPhone = useSalonStore((s) => s.salonProfile.depositBizumPhone ?? "");
  // Con un solo profesional, "con Adam" en cada solicitud es ruido.
  const soloUno = esSoloUnProfesional(useEquipoVisible());
  const depositAmountEur = useSalonStore((s) => s.salonProfile.depositAmountEur ?? 10);
  const depositDeadlineHours = reglaSen.ventanaHoras;
  const duracionFlexible = useSalonStore((s) => !!s.salonProfile.duracionFlexible);
  const pideFianza = depositEnabled && !!depositBizumPhone.trim();
  const serviceMap = selectServiceMap(services);

  // Duración elegida por el salón para cada tarjeta, mientras no se confirma.
  const [duracionPorTarjeta, setDuracionPorTarjeta] = useState<Record<string, number>>({});
  /** Tarjeta con el campo «Otra…» abierto. */
  const [otraEn, setOtraEn] = useState<string | null>(null);
  const [aConfirmar, setAConfirmar] = useState<{ cita: Appointment; duracion: number } | null>(null);

  const pending = appointments
    .filter((a) => a.status === "pending")
    .sort((a, b) => +new Date(a.start) - +new Date(b.start));

  if (pending.length === 0) return null;

  // Confirmar abre la ventana con la ficha y la propuesta (9f), no confirma a ciegas.
  function handleConfirm(a: Appointment) {
    setAConfirmar({ cita: a, duracion: a.duration });
  }

  function handleConfirmConDuracion(a: Appointment, duracion: number) {
    setAConfirmar({ cita: a, duracion });
  }

  /**
   * Rechazar era un toque, irreversible y sin red: si te equivocabas de fila
   * habías rechazado a un cliente de verdad y no había forma de volver atrás
   * desde la interfaz. Ahora el toast trae "Deshacer" durante unos segundos y
   * devuelve la solicitud exactamente al estado que tenía.
   */
  function handleReject(a: Appointment) {
    // Lote 12: el aviso con «Deshacer» lo pone el registro de cambios.
    // Rechazar es cancelar por parte del salón: si ya había señal, se devuelve.
    cancelAppointment(a.id, { porSalon: true });
  }


  /**
   * Próxima cita del mismo profesional tras el fin de `a` (con la duración que
   * se esté proponiendo), para avisar del solape sin bloquear: es su agenda,
   * ella decide si lo acepta.
   */
  function proximaConSolape(a: Appointment, duracion: number): Appointment | null {
    const finPropuesto = +new Date(a.start) + duracion * 60_000;
    const inicio = +new Date(a.start);
    const candidatas = appointments
      .filter(
        (b) =>
          b.id !== a.id &&
          b.employeeId === a.employeeId &&
          (b.status === "confirmed" || b.status === "pending") &&
          +new Date(b.start) >= inicio,
      )
      .sort((x, y) => +new Date(x.start) - +new Date(y.start));
    const siguiente = candidatas[0];
    if (!siguiente) return null;
    return +new Date(siguiente.start) < finPropuesto ? siguiente : null;
  }

  return (
    <div
      data-tour="pending-requests"
      className="tarjeta-principal overflow-hidden border-0 bg-miel/85"
    >
      <div
        className={cn("flex items-center gap-2.5 px-5 py-4", plegable && "cursor-pointer hover:bg-white/20")}
        {...(plegable ? { role: "button", tabIndex: 0, "aria-expanded": abierto, onClick: alternar, onKeyDown: (e: React.KeyboardEvent) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), alternar()) } : {})}
      >
        <Clock className="size-[18px] shrink-0 text-primary" strokeWidth={1.6} />
        <div className="min-w-0">
          <h2 className="text-base font-extrabold tracking-[-0.01em] text-foreground">
            {pending.length} {pending.length === 1 ? "solicitud" : "solicitudes"} por confirmar
          </h2>
          {abierto && <p className="mt-1 text-[13px] leading-relaxed text-cafe-medio">
            Revisa cada solicitud y confirma su hueco en la agenda.
          </p>}
        </div>
        {plegable && (
          <ChevronDown className={cn("ml-auto size-5 shrink-0 text-cafe-medio transition-transform", abierto && "rotate-180")} strokeWidth={1.6} aria-hidden="true" />
        )}
      </div>
      {abierto && (
      <div className="grid gap-3 px-3 pb-4 sm:px-5 sm:pb-5">
        {pending.map((a) => {
          const emp = employeeMap[a.employeeId];

          // --- Caso duración flexible: el salón decide cuánto dura cada cita ---
          const catalogoMin = a.serviceIds.reduce(
            (sum, id) => sum + (serviceMap[id]?.durationMin ?? 0),
            0,
          );
          const recordada = duracionPropuesta(appointments, duracionClientas, a.clientId, a.serviceIds, catalogoMin, services);
          const propuesta = recordada?.minutos ?? (catalogoMin || a.duration);
          const duracionElegida = duracionPorTarjeta[a.id] ?? propuesta;
          const opciones = [...new Set([...DURATION_OPTIONS_MIN, catalogoMin, duracionElegida])]
            .filter((n) => n > 0)
            .sort((x, y) => x - y);
          const solape = proximaConSolape(a, duracionElegida);

          return (
            <article key={a.id} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-white/65 p-4 shadow-[0_3px_10px_rgba(59,47,42,0.04)]" aria-label={`Solicitud de ${a.clientName}`}>
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="min-w-[68px] shrink-0 rounded-xl bg-nata/70 px-2.5 py-2 text-center tabular-nums">
                  <p className="text-[11px] font-semibold text-cafe-medio">
                    {new Date(a.start).toLocaleDateString("es", { day: "numeric", month: "short" })}
                  </p>
                  <p className="mt-1 text-lg font-bold leading-tight text-cafe">
                    {new Date(a.start).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-display text-[20px] font-medium leading-tight text-cafe">
                    <EnlaceClienta clientId={a.clientId}>{a.clientName}</EnlaceClienta>
                  </h3>
                  <p className="mt-1 text-sm leading-snug text-cafe-medio">{serviceLabelOf(a, serviceMap)}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {!soloUno && emp && <span className="inline-flex items-center gap-1.5"><UserRound className="size-3.5" aria-hidden="true" />{emp.name}</span>}
                    <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5" aria-hidden="true" />{duracionFlexible ? duracionElegida : a.duration} min</span>
                    <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" aria-hidden="true" />
                      {new Date(a.start).toLocaleDateString("es", { weekday: "long" })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="space-y-2 empty:hidden">
                <BookingAnswersSummary answers={a.bookingAnswers} />
                <SenalCita cita={a} compacta className="space-y-3 border-0 bg-nata/50 px-4 py-4" />
              </div>

              {duracionFlexible && <>
              <div className="flex flex-col gap-1.5 rounded-xl bg-nata/60 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 space-y-1">
                  <p className="text-xs font-medium text-foreground">¿Cuánto tiempo necesitas?</p>
                  {recordada && (
                    <p className="flex items-start gap-1.5 text-xs text-primary">
                      <Clock3 className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                      <span>
                        {recordada.fuente === "ficha" ? "Su ficha" : "Última visita"}: {recordada.minutos} min. Duración de la carta: {catalogoMin} min.
                      </span>
                    </p>
                  )}
                </div>
                <Select
                  value={String(duracionElegida)}
                  onValueChange={(v) => {
                    if (v === "otra") return setOtraEn(a.id);
                    setOtraEn(null);
                    setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: Number(v) }));
                  }}
                >
                  <SelectTrigger
                    className="w-full sm:w-32"
                    aria-label={`Duración de la cita de ${a.clientName}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {opciones.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {min} min
                      </SelectItem>
                    ))}
                    <SelectItem value="otra">Otra…</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {otraEn === a.id && (
                <div className="flex justify-end">
                  <DuracionOtra
                    valor={duracionElegida}
                    abiertoAlInicio
                    onCancelar={() => setOtraEn(null)}
                    claseChip="h-9 rounded-full px-3.5 text-[13px] font-bold text-cafe-medio"
                    onElegir={(min) => {
                      setDuracionPorTarjeta((prev) => ({ ...prev, [a.id]: min }));
                      setOtraEn(null);
                    }}
                  />
                </div>
              )}

              {solape && (
                <p className="flex items-start gap-1.5 text-[12.5px] text-melocoton-tinta">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  Se solapa con la cita de las{" "}
                  {new Date(solape.start).toLocaleTimeString("es", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}

              </>}
              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                <Button size="sm" className="order-last min-h-11 gap-1.5 sm:order-first"
                  onClick={() => duracionFlexible ? handleConfirmConDuracion(a, duracionElegida) : handleConfirm(a)}>
                  <Check className="size-4" aria-hidden="true" />Confirmar cita
                </Button>
                <Button size="sm" variant="outline" className="min-h-11" onClick={() => onOpenDetail(a)}>
                  Revisar o cambiar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="min-h-11 text-cafe-medio hover:bg-nata hover:text-cafe"
                  onClick={() => handleReject(a)}
                >
                  Rechazar
                </Button>
              </div>
            </article>
          );
        })}
      </div>
      )}
      <VentanaConfirmar
        cita={aConfirmar?.cita ?? null}
        duracionInicial={aConfirmar?.duracion}
        onCerrar={() => setAConfirmar(null)}
        onCambiar={(c) => {
          setAConfirmar(null);
          onOpenDetail(c);
        }}
      />
    </div>
  );
}
