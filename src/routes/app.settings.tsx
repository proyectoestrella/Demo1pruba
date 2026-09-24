import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight } from "lucide-react";
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
    const parsedDeposit = Number(depositAmountEur.replace(",", "."));
    if (depositEnabled && (!Number.isFinite(parsedDeposit) || parsedDeposit <= 0 || parsedDeposit > 200)) {
      toast.error("La señal tiene que estar entre 0 y 200 €");
      return;
    }
    if (depositEnabled && depositBizumPhone.replace(/\D/g, "").length < 9) {
      toast.error("Escribe el número de Bizum al que te tienen que pagar la señal");
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
      depositEnabled,
      depositBizumPhone: depositBizumPhone.trim(),
      depositAmountEur: depositEnabled ? Math.min(200, Math.max(1, parsedDeposit)) : 0,
      depositDeadlineHours: depositDeadline,
      bookingQuestionsEnabled: questionsEnabled,
      bookingQuestionsRequired: questionsRequired,
      duracionFlexible,
    });
    toast.success("Cambios guardados");
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Ajustes" description="Las políticas de tu salón: plantones, señal y reparto de agenda." />

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
        <div>
          <Label htmlFor="duracion-flexible" className="text-sm font-medium">La duración de cada cita la decido yo al aceptarla</Label>
          <p className="mt-1 text-sm text-muted-foreground">La web muestra una duración orientativa. Cuando llegue la solicitud, podrás fijar los minutos antes de confirmarla.</p>
        </div>
        <Switch id="duracion-flexible" checked={duracionFlexible} onCheckedChange={setDuracionFlexible} />
        </div>
        <div className="mt-4 flex justify-end"><Button onClick={handleSave}>Guardar cambios</Button></div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div>
          <h2 className="font-display text-lg">Ver tus citas en Google Calendar o en el calendario del iPhone</h2>
          <p className="mt-1 text-sm text-muted-foreground">Tu calendario la actualiza cada pocas horas; la agenda al minuto está en siShow. Solo aparecen citas confirmadas, con hora, servicio y nombre de pila.</p>
        </div>
        {!realSlug ? <p className="text-sm text-muted-foreground">La suscripción se activa cuando el salón es real. En esta demo puedes ver cómo quedará el ajuste.</p> : <>
          {calendarError && <p className="text-sm text-destructive">No se pudo cargar el enlace. Comprueba que el calendario esté activado en el servidor y vuelve a abrir Ajustes.</p>}
          {calendarToken && <>
            <label className="block space-y-1 text-sm"><span>Calendario</span>
              <select value={profesional} onChange={(e) => setProfesional(e.target.value)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
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

      <Link
        to="/app/web"
        className="flex items-center justify-between gap-4 rounded-xl border border-border/60 bg-card p-6 transition-colors hover:border-primary/50"
      >
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Mi web</p>
          <p className="mt-2 text-sm">
            El nombre, la foto, la presentación, el teléfono, la dirección, el horario, los
            servicios y precios, el equipo y las preguntas frecuentes se cambian en{" "}
            <strong>Mi web</strong>, viendo el resultado mientras escribes.
          </p>
        </div>
        <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label>Preguntas al reservar</Label>
            <p className="mt-1 text-sm text-muted-foreground">Pregunta por el largo de pelo, el color actual y los tratamientos químicos recientes para preparar cada cita.</p>
          </div>
          <Switch aria-label="Activar preguntas al reservar" checked={questionsEnabled} onCheckedChange={setQuestionsEnabled} />
        </div>
        {questionsEnabled && <div className="flex items-center justify-between gap-4 border-t border-border/60 pt-4">
          <div><Label>Respuestas obligatorias</Label><p className="mt-1 text-sm text-muted-foreground">Si está desactivado, la clienta puede dejar las preguntas sin responder.</p></div>
          <Switch aria-label="Hacer obligatorias las preguntas" checked={questionsRequired} onCheckedChange={setQuestionsRequired} />
        </div>}
        <div className="flex justify-end"><Button onClick={handleSave}>Guardar cambios</Button></div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Plantones
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Cobra una penalización a quien cancela tarde o no viene, antes de que pueda volver a
              reservar. Tú decides en cada caso si la aplicas o la perdonas.
            </p>
          </div>
          <Switch checked={noShowEnabled} onCheckedChange={setNoShowEnabled} />
        </div>
        {noShowEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Penalización (€)"
              value={noShowFeeEur}
              onChange={setNoShowFeeEur}
              hint="De 0 a 50 €."
            />
            <Field
              label="Aviso mínimo (h)"
              value={noShowNoticeHours}
              onChange={setNoShowNoticeHours}
              hint="Cancelar con menos margen cuenta como plantón. De 1 a 48 horas."
            />
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      {/* Fianza por Bizum — lo pidió María (PeluChic) para clientas nuevas.
          Se configura aquí y solo aquí: nada depende de tocar la URL. */}
      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Señal por Bizum
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Añade un botón en cada solicitud pendiente que abre tu WhatsApp con el mensaje ya
              escrito para pedir la señal. El Bizum llega a tu banco y lo marcas tú a mano:{" "}
              <strong>siShow no cobra ni comprueba ningún pago.</strong>
            </p>
          </div>
          <Switch checked={depositEnabled} onCheckedChange={setDepositEnabled} />
        </div>
        {depositEnabled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Número de Bizum"
              value={depositBizumPhone}
              onChange={setDepositBizumPhone}
              hint="El que aparecerá escrito en el mensaje."
            />
            <Field
              label="Importe de la señal (€)"
              value={depositAmountEur}
              onChange={setDepositAmountEur}
              hint="De 1 a 200 €."
            />
            <div className="space-y-1.5">
              <Label htmlFor="deposit-deadline">Plazo para hacer el Bizum</Label>
              <select id="deposit-deadline" className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={depositDeadline} onChange={(e) => setDepositDeadline(Number(e.target.value) as DepositDeadlineHours)}>
                {DEPOSIT_DEADLINE_OPTIONS.map((hours) => <option key={hours} value={hours}>{hours} {hours === 1 ? "hora" : "horas"}</option>)}
              </select>
              <p className="text-xs text-muted-foreground">Al vencer, tú decides si dar más tiempo o liberar el hueco. Nunca se cancela sola.</p>
            </div>
          </div>
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      <div className="space-y-4 rounded-xl border border-border/60 bg-card p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Reparto de agenda
            </Label>
            <p className="mt-1 text-sm text-muted-foreground">
              Sugiere una hora más tranquila cuando alguien elige una franja con espera (12:00–14:00
              o las últimas horas del día). Nunca le impide elegir la suya.
            </p>
          </div>
          <Switch checked={smartSpreadEnabled} onCheckedChange={setSmartSpreadEnabled} />
        </div>
        {smartSpreadEnabled && (
          <Field
            label="No ofrecer los últimos (min)"
            value={lastSlotBufferMin}
            onChange={setLastSlotBufferMin}
            hint="Minutos antes del cierre que dejan de ofertarse. De 0 a 240."
          />
        )}
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave}>Guardar cambios</Button>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">
          Política de cancelación
        </p>
        <p className="mt-2 text-sm">
          Cancelación gratuita hasta 24 h antes. Si no vienes o cancelas más tarde, pierdes la señal.
        </p>
      </div>
      <div className="rounded-xl border border-border/60 bg-card p-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Regla de depósito</p>
        <p className="mt-2 text-sm">
          Los servicios de más de <strong>90 minutos</strong> requieren un{" "}
          <strong>20% de depósito</strong>.
        </p>
      </div>
    </div>
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
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
