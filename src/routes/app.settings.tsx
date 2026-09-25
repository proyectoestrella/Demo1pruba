import { CamposPreferenciasCalendario } from "@/components/CamposPreferenciasCalendario";
import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { usePlegado } from "@/lib/use-plegado";
import { cn } from "@/lib/utils";
import { AjustesMensajes } from "@/components/AjustesMensajes";
import { AjustesColores } from "@/components/AjustesColores";
import { AjustesSenal } from "@/components/AjustesSenal";
import { AjustesPreguntas } from "@/components/AjustesPreguntas";
import { GuiaAsistente } from "@/components/GuiaAsistente";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { getCalendarSubscription, regenerateCalendarSubscription } from "@/lib/api/calendar.functions";
import { recargoActivo } from "@/lib/recargo-activo";
import { inferBusinessType } from "@/lib/business-type";
import { bookingQuestionsEnabled } from "@/lib/booking-answers";
import { deadlineHours, DEPOSIT_DEADLINE_OPTIONS, type DepositDeadlineHours } from "@/lib/deposit-deadline";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PrimerosPasos } from "@/components/PrimerosPasos";

export const Route = createFileRoute("/app/settings")({ component: Settings });

/**
 * Ajustes = POLÍTICAS. Lo que se LEE en la web pública (nombre, presentación,
 * foto, teléfono, dirección, horario, carta, equipo, preguntas frecuentes,
 * franjas prioritarias) se edita en «Mi web» (`/app/web`), viendo el efecto.
 *
 * Antes estaba en los dos sitios: aquí se cambiaba el nombre a ciegas y allí
 * también, con dos formularios que podían decir cosas distintas sobre lo
 * mismo. Manda «Mi web» y aquí solo queda el enlace — una decisión de la que
 * no hay que volver: dos formularios sobre un solo perfil siempre acaban
 * discrepando, y el que gana es el último que guardó.
 */
function Settings() {
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  const equipo = useEquipo();
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [profesional, setProfesional] = useState("");
  useEffect(() => {
    if (!realSlug) { setCalendarToken(null); return; }
    let activo = true;
    void getCalendarSubscription({ data: { slug: realSlug } }).then(({ token }) => {
      if (activo) { setCalendarToken(token); setCalendarError(false); }
    }).catch(() => { if (activo) setCalendarError(true); });
    return () => { activo = false; };
  }, [realSlug]);
  const calendarUrl = realSlug && calendarToken && typeof window !== "undefined"
    ? `${window.location.origin}/api/calendario?token=${calendarToken}${profesional ? `&profesional=${encodeURIComponent(profesional)}` : ""}`
    : "";
  const businessType = inferBusinessType(salonProfile.tagline, salonProfile.name);
  const [questionsEnabled, setQuestionsEnabled] = useState(bookingQuestionsEnabled(salonProfile, businessType));
  const [questionsRequired, setQuestionsRequired] = useState(!!salonProfile.bookingQuestionsRequired);
  const [duracionFlexible, setDuracionFlexible] = useState(!!salonProfile.duracionFlexible);

  // Plantones — política de penalización por cancelar tarde o no presentarse.
  const [noShowEnabled, setNoShowEnabled] = useState(recargoActivo(salonProfile));
  const [noShowFeeEur, setNoShowFeeEur] = useState(String(salonProfile.noShowFeeEur || 7));
  const [noShowNoticeHours, setNoShowNoticeHours] = useState(
    String(salonProfile.noShowNoticeHours ?? 2),
  );

  // Fianza por Bizum — número al que se pide y cuánto. Ver lib/avisos.ts.
  const [depositEnabled, setDepositEnabled] = useState(!!salonProfile.depositEnabled);
  const [depositBizumPhone, setDepositBizumPhone] = useState(salonProfile.depositBizumPhone ?? "");
  const [depositAmountEur, setDepositAmountEur] = useState(
    String(salonProfile.depositAmountEur || 10),
  );
  const [depositDeadline, setDepositDeadline] = useState<DepositDeadlineHours>(deadlineHours(salonProfile.depositDeadlineHours));

  // Reparto de agenda — hora sugerida y colchón antes del cierre.
  const [smartSpreadEnabled, setSmartSpreadEnabled] = useState(!!salonProfile.smartSpread);
  const [lastSlotBufferMin, setLastSlotBufferMin] = useState(
    String(salonProfile.lastSlotBufferMin || 90),
  );

  // Keep the form in sync if the profile changes from elsewhere (e.g. reset).
  useEffect(() => {
    setNoShowEnabled(recargoActivo(salonProfile));
    setNoShowFeeEur(String(salonProfile.noShowFeeEur || 7));
    setNoShowNoticeHours(String(salonProfile.noShowNoticeHours ?? 2));
    setSmartSpreadEnabled(!!salonProfile.smartSpread);
    setLastSlotBufferMin(String(salonProfile.lastSlotBufferMin || 90));
    setDepositEnabled(!!salonProfile.depositEnabled);
    setDepositBizumPhone(salonProfile.depositBizumPhone ?? "");
    setDepositAmountEur(String(salonProfile.depositAmountEur || 10));
    setDepositDeadline(deadlineHours(salonProfile.depositDeadlineHours));
    setQuestionsEnabled(bookingQuestionsEnabled(salonProfile, businessType));
    setQuestionsRequired(!!salonProfile.bookingQuestionsRequired);
    setDuracionFlexible(!!salonProfile.duracionFlexible);
  }, [salonProfile, businessType]);

  function handleSave() {
    const parsedFee = Number(noShowFeeEur.replace(",", "."));
    if (noShowEnabled && (!Number.isFinite(parsedFee) || parsedFee <= 0 || parsedFee > 50)) {
      toast.error("La penalización tiene que estar entre 0 y 50 €");
      return;
    }
    const parsedNotice = Number(noShowNoticeHours);
    if (noShowEnabled && (!Number.isFinite(parsedNotice) || parsedNotice < 1 || parsedNotice > 48)) {
      toast.error("El aviso mínimo tiene que estar entre 1 y 48 horas");
      return;
    }

    const parsedBuffer = Number(lastSlotBufferMin);
    if (
      smartSpreadEnabled &&
      (!Number.isFinite(parsedBuffer) || parsedBuffer < 0 || parsedBuffer > 240)
    ) {
      toast.error("Los minutos antes del cierre tienen que estar entre 0 y 240");
      return;
    }

    updateSalonProfile({
      noShowFeeEur: noShowEnabled ? Math.min(50, Math.max(0, parsedFee)) : 0,
      noShowNoticeHours: Math.min(48, Math.max(1, Math.round(parsedNotice) || 2)),
      smartSpread: smartSpreadEnabled,
      lastSlotBufferMin: smartSpreadEnabled ? Math.min(240, Math.max(0, Math.round(parsedBuffer))) : 0,
      // La señal se guarda en su propio bloque (AjustesSenal): aquí no se toca,
      // para no pisarla con valores viejos de este formulario.
      bookingQuestionsEnabled: questionsEnabled,
      bookingQuestionsRequired: questionsRequired,
      duracionFlexible,
    });
    toast.success("Cambios guardados");
  }

  const guardar = (
    <div className="flex justify-end pt-1">
      <Button onClick={handleSave}>Guardar cambios</Button>
    </div>
  );
  const fila = "space-y-4 border-t border-lino pt-5 first:border-t-0 first:pt-0";

  return (
    <div className="flex flex-1 flex-col gap-5">
      <PageHeader title="Ajustes" description="Cómo funciona tu salón: agenda, reservas, mensajes, plantones, señal y colores." />
      <PrimerosPasos enAjustes />

      <div className="flex max-w-4xl flex-col gap-3">
        <SeccionAjustes titulo="Tu agenda" resumen="Duración al aceptar, cómo se abre el calendario y verlo en tu móvil" abierta>
          <div className={fila}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label htmlFor="duracion-flexible" className="text-[15px] font-extrabold">La duración de cada cita la decido yo al aceptarla</Label>
                <p className="mt-1 text-sm text-muted-foreground">La web muestra una duración orientativa. Cuando llegue la solicitud, podrás fijar los minutos antes de confirmarla.</p>
              </div>
              <Switch id="duracion-flexible" checked={duracionFlexible} onCheckedChange={setDuracionFlexible} />
            </div>
            {guardar}
          </div>
          <div className={fila}>
            <h3 className="text-[15px] font-extrabold">Cómo se abre tu calendario</h3>
            <p className="-mt-2 text-sm text-muted-foreground">Se guarda al cambiarlo. También lo tienes en el engranaje del propio calendario.</p>
            <div className="max-w-md"><CamposPreferenciasCalendario /></div>
          </div>
          <div className={fila}>
            <div>
              <h3 className="text-[15px] font-extrabold">Ver tus citas en Google Calendar o en el calendario del iPhone</h3>
              <p className="mt-1 text-sm text-muted-foreground">Tu calendario la actualiza cada pocas horas; la agenda al minuto está en siShow. Solo aparecen citas confirmadas, con hora, servicio y nombre de pila.</p>
            </div>
            {!realSlug ? <p className="text-sm text-muted-foreground">La suscripción se activa cuando el salón es real. En esta demo puedes ver cómo quedará el ajuste.</p> : <>
              {calendarError && <p className="text-sm text-melocoton-tinta">No se pudo cargar el enlace. Comprueba que el calendario esté activado en el servidor y vuelve a abrir Ajustes.</p>}
              {calendarToken && <>
                <label className="block space-y-1 text-sm"><span>Calendario</span>
                  <select value={profesional} onChange={(e) => setProfesional(e.target.value)} className="flex h-10 w-full rounded-xl border border-input bg-blanco px-3 text-sm">
                    <option value="">Todo el salón</option>
                    {equipo.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </label>
                <div className="flex flex-wrap gap-2"><Input readOnly aria-label="Enlace del calendario" value={calendarUrl} className="min-w-0 flex-1 text-xs" /><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(calendarUrl).then(() => toast.success("Enlace copiado")).catch(() => toast.error("No se pudo copiar el enlace")); }}>Copiar enlace</Button></div>
                <p className="text-xs text-muted-foreground">Este enlace es privado: quien lo tenga podrá ver esas citas. Si lo regeneras, el anterior dejará de funcionar.</p>
              </>}
              <Button disabled={calendarBusy} variant={calendarToken ? "outline" : "default"} onClick={() => {
                setCalendarBusy(true);
                void regenerateCalendarSubscription({ data: { slug: realSlug } }).then(({ token }) => {
                  setCalendarToken(token); setCalendarError(false); toast.success(calendarToken ? "Enlace nuevo creado" : "Calendario activado");
                }).catch(() => { setCalendarError(true); toast.error("No se pudo crear el enlace"); }).finally(() => setCalendarBusy(false));
              }}>{calendarToken ? "Regenerar enlace" : "Crear enlace"}</Button>
            </>}
          </div>
        </SeccionAjustes>

        <SeccionAjustes titulo="Reservas por internet" resumen="Preguntas al reservar, reparto de agenda y lo que dice tu web">
          <div className={fila}>
            <div>
              <h3 className="text-[15px] font-extrabold">Preguntas al reservar</h3>
              <p className="mt-1 text-sm text-muted-foreground">Lo que preguntas a la clienta al reservar, para preparar la cita. Tú eliges qué, en qué orden y para qué servicios.</p>
            </div>
            {/* Los interruptores de siempre solo cuentan mientras no hay lista propia (contrato §2). */}
            {!salonProfile.preguntasReserva && (
              <div className="space-y-3 rounded-2xl bg-nata p-3.5">
                <div className="flex items-center justify-between gap-4">
                  <div><Label>Preguntar al reservar</Label><p className="mt-0.5 text-[12.5px] text-muted-foreground">Mientras no guardes tu lista, se hacen las tres de siempre.</p></div>
                  <Switch aria-label="Activar preguntas al reservar" checked={questionsEnabled} onCheckedChange={setQuestionsEnabled} />
                </div>
                {questionsEnabled && <div className="flex items-center justify-between gap-4">
                  <div><Label>Respuestas obligatorias</Label></div>
                  <Switch aria-label="Hacer obligatorias las preguntas" checked={questionsRequired} onCheckedChange={setQuestionsRequired} />
                </div>}
                {guardar}
              </div>
            )}
            <AjustesPreguntas />
          </div>
          <div className={fila}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-[15px] font-extrabold">Reparto de agenda</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sugiere una hora más tranquila cuando alguien elige una franja con espera (12:00–14:00
                  o las últimas horas del día). Nunca le impide elegir la suya.
                </p>
              </div>
              <Switch checked={smartSpreadEnabled} onCheckedChange={setSmartSpreadEnabled} />
            </div>
            {smartSpreadEnabled && (
              <Field label="No ofrecer los últimos (min)" value={lastSlotBufferMin} onChange={setLastSlotBufferMin} hint="Minutos antes del cierre que dejan de ofertarse. De 0 a 240." />
            )}
            {guardar}
          </div>
          <div className={fila}>
            <Link
              to="/app/web"
              className="flex items-center justify-between gap-4 rounded-2xl border border-lino bg-nata p-4 transition-colors hover:border-moca hover:text-foreground"
            >
              <div>
                <p className="text-[15px] font-extrabold">Lo que se lee en tu web</p>
                <p className="mt-1 text-sm text-cafe-medio">
                  El nombre, la foto, el horario, los servicios, el equipo y las preguntas frecuentes
                  —también tu política de cancelación— se cambian en <strong>Mi página de reservas</strong>, viendo el resultado.
                </p>
              </div>
              <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </Link>
          </div>
        </SeccionAjustes>

        <SeccionAjustes titulo="Mensajes de WhatsApp" resumen="El texto de la confirmación y del recordatorio, a tu manera">
          <AjustesMensajes />
        </SeccionAjustes>

        <SeccionAjustes titulo="Plantones y señal" resumen="Penalización por no venir y la regla de la señal">
          <div className={fila}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-[15px] font-extrabold">Plantones</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cobra una penalización a quien cancela tarde o no viene, antes de que pueda volver a
                  reservar. Tú decides en cada caso si la aplicas o la perdonas.
                </p>
              </div>
              <Switch checked={noShowEnabled} onCheckedChange={setNoShowEnabled} />
            </div>
            {noShowEnabled && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Penalización (€)" value={noShowFeeEur} onChange={setNoShowFeeEur} hint="De 0 a 50 €." />
                <Field label="Aviso mínimo (h)" value={noShowNoticeHours} onChange={setNoShowNoticeHours} hint="Cancelar con menos margen cuenta como plantón. De 1 a 48 horas." />
              </div>
            )}
            {guardar}
          </div>
          <AjustesSenal />
        </SeccionAjustes>

        <SeccionAjustes titulo="Cómo usar el asistente" resumen="Todo lo que le puedes preguntar, con ejemplos, y lo que no hace">
          <GuiaAsistente />
        </SeccionAjustes>

        <SeccionAjustes titulo="Colores" resumen="El color de cada servicio y de cada profesional en el calendario">
          <AjustesColores />
        </SeccionAjustes>
      </div>
    </div>
  );
}

/** Sección de Ajustes plegable desde su título; recuerda si la dueña la dejó abierta. */
function SeccionAjustes({ titulo, resumen, abierta = false, children }: { titulo: string; resumen: string; abierta?: boolean; children: React.ReactNode }) {
  const [abierto, alternar] = usePlegado(`ajustes:${titulo}`, abierta);
  return (
    <section className="overflow-hidden rounded-[20px] border border-border bg-card">
      <h2>
        <button type="button" aria-expanded={abierto} onClick={alternar} className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-beige/50">
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold tracking-[-0.01em]">{titulo}</span>
            <span className="block text-[13px] leading-snug text-muted-foreground">{resumen}</span>
          </span>
          <ChevronDown className={cn("size-5 shrink-0 text-cafe-medio transition-transform", abierto && "rotate-180")} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </h2>
      {abierto && <div className="space-y-5 border-t border-lino px-5 py-5">{children}</div>}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[12.5px] font-bold text-cafe-medio">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
