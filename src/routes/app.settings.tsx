import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { CamposPreferenciasCalendario } from "@/components/CamposPreferenciasCalendario";
import { AjustesFichas } from "@/components/AjustesFichas";
import { useEffect, useId, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowUpRight, ChevronDown, Search } from "lucide-react";
import {
  SECCIONES_AJUSTES,
  seccionCoincide,
  valorActual,
  type IdSeccionAjustes,
} from "@/lib/ajustes-resumen-panel";
import { menosMovimiento } from "@/lib/movimiento-panel";
import type { SalonProfile } from "@/lib/mock/types";
import { usePlegado } from "@/lib/use-plegado";
import { cn } from "@/lib/utils";
import { AjustesMensajes } from "@/components/AjustesMensajes";
import { AjustesColores } from "@/components/AjustesColores";
import { AjustesSenal } from "@/components/AjustesSenal";
import { AjustesPrivacidad } from "@/components/AjustesPrivacidad";
import { AjustesFestivos } from "@/components/AjustesFestivos";
import { AjustesPreguntas } from "@/components/AjustesPreguntas";
import { AjustesDiasEspeciales } from "@/components/AjustesDiasEspeciales";
import { GuiaUso } from "@/components/GuiaUso";
import { AjustesAccesos } from "@/components/AjustesAccesos";
import { FilaInstalar } from "@/components/InstalarPanel";
import { enlacesSuscripcion } from "@/lib/calendario-ics";
import { AjustesCalendarios } from "@/components/AjustesCalendarios";
import {
  API_CALENDARIOS,
  alcanceCalendario,
  avisoVueltaGoogle,
  useCalendariosActivos,
} from "@/lib/calendarios-panel";
import { HistorialCambios } from "@/components/HistorialCambios";
import { useEsDemo, usePermisos, useTienePlan } from "@/lib/accesos-panel";
import { LlegaConPlan, ResumenPlanSuperior } from "@/components/LlegaConPlan";
import { puede } from "@/lib/permisos";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import {
  getCalendarSubscription,
  regenerateCalendarSubscription,
} from "@/lib/api/calendar.functions";
import { recargoActivo } from "@/lib/recargo-activo";
import { MAX_CLIENTAS_EXPOSICION_POR_DEFECTO } from "@/lib/solape";
import { inferBusinessType } from "@/lib/business-type";
import { bookingQuestionsEnabled } from "@/lib/booking-answers";
import {
  deadlineHours,
  DEPOSIT_DEADLINE_OPTIONS,
  type DepositDeadlineHours,
} from "@/lib/deposit-deadline";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { PrimerosPasos } from "@/components/PrimerosPasos";
import { VerComo } from "@/components/VerComo";

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
  const esDemo = useEsDemo();
  const permisos = usePermisos();
  const calendarios = useCalendariosActivos();
  const puedeGestionarReservas = puede(permisos, "reservas.editar");
  // Una estilista con solo este acceso entra en Ajustes para gestionar las
  // reservas online, pero no ve ni puede tantear el resto de políticas.
  const soloReservas = puedeGestionarReservas && !puede(permisos, "salon.editar");
  // Lote 16: índice lateral, buscador y «ir a» una sección (la abre y baja hasta ella).
  const [buscar, setBuscar] = useState("");
  const [abrir, setAbrir] = useState<{ id: IdSeccionAjustes; n: number } | null>(null);
  const disponibles: IdSeccionAjustes[] = SECCIONES_AJUSTES.map((x) => x.id).filter((id) => {
    if (soloReservas) return id === "reservas";
    if (id === "reservas") return puedeGestionarReservas;
    if (id === "calendarios")
      return !!(calendarios.activo && calendarios.slug && alcanceCalendario(permisos) === "todo");
    if (id === "historial") return puede(permisos, "historial.ver");
    if (id === "accesos") return puede(permisos, "accesos.gestionar");
    return true;
  });
  const visibles = buscar.trim()
    ? disponibles.filter((id) => seccionCoincide(id, buscar))
    : disponibles;
  const irA = (id: IdSeccionAjustes) => {
    setAbrir((a) => ({ id, n: (a?.n ?? 0) + 1 }));
    // Tras desplegarse (220 ms): si no, al final de la página no hay sitio aún para subirla.
    setTimeout(
      () =>
        document
          .getElementById(`ajuste-${id}`)
          ?.scrollIntoView({ behavior: menosMovimiento() ? "auto" : "smooth", block: "start" }),
      240,
    );
  };
  // 14c: la vuelta de Google (/app/settings?calendario=ok|error&motivo=…).
  useEffect(() => {
    const q = Object.fromEntries(new URLSearchParams(window.location.search));
    const aviso = avisoVueltaGoogle(q);
    if (!aviso) return;
    if (aviso.ok) toast.success(aviso.texto);
    else toast.error(aviso.texto);
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const realSlug = useSalonStore((s) => s.realSalonSlug);
  const equipo = useEquipo();
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const [calendarToken, setCalendarToken] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState(false);
  const [calendarBusy, setCalendarBusy] = useState(false);
  const [profesional, setProfesional] = useState("");
  /** 22-oct: regenerar rompe el enlace que ya usan los móviles; se confirma antes. */
  const [confirmarRegenerar, setConfirmarRegenerar] = useState(false);
  function crearEnlace() {
    if (!realSlug) return;
    const habiaEnlace = !!calendarToken;
    setCalendarBusy(true);
    void regenerateCalendarSubscription({ data: { slug: realSlug } })
      .then(({ token }) => {
        setCalendarToken(token);
        setCalendarError(false);
        toast.success(
          habiaEnlace ? "Enlace nuevo creado: el anterior ya no funciona" : "Calendario activado",
        );
      })
      .catch(() => {
        setCalendarError(true);
        toast.error("No se pudo crear el enlace");
      })
      .finally(() => setCalendarBusy(false));
  }
  useEffect(() => {
    if (!realSlug) {
      setCalendarToken(null);
      return;
    }
    let activo = true;
    void getCalendarSubscription({ data: { slug: realSlug } })
      .then(({ token }) => {
        if (activo) {
          setCalendarToken(token);
          setCalendarError(false);
        }
      })
      .catch(() => {
        if (activo) setCalendarError(true);
      });
    return () => {
      activo = false;
    };
  }, [realSlug]);
  const calendarUrl =
    realSlug && calendarToken && typeof window !== "undefined"
      ? `${window.location.origin}/api/calendario?token=${calendarToken}${profesional ? `&profesional=${encodeURIComponent(profesional)}` : ""}`
      : "";
  const businessType = inferBusinessType(salonProfile.tagline, salonProfile.name);
  const [questionsEnabled, setQuestionsEnabled] = useState(
    bookingQuestionsEnabled(salonProfile, businessType),
  );
  const [questionsRequired, setQuestionsRequired] = useState(
    !!salonProfile.bookingQuestionsRequired,
  );
  const [duracionFlexible, setDuracionFlexible] = useState(!!salonProfile.duracionFlexible);
  const [ocultarPrecioReserva, setOcultarPrecioReserva] = useState(
    !!salonProfile.ocultarPrecioReserva,
  );
  const [maxClientasExposicion, setMaxClientasExposicion] = useState(
    String(salonProfile.maxClientasExposicion ?? MAX_CLIENTAS_EXPOSICION_POR_DEFECTO),
  );

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
  const [depositDeadline, setDepositDeadline] = useState<DepositDeadlineHours>(
    deadlineHours(salonProfile.depositDeadlineHours),
  );

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
    setOcultarPrecioReserva(!!salonProfile.ocultarPrecioReserva);
    setMaxClientasExposicion(
      String(salonProfile.maxClientasExposicion ?? MAX_CLIENTAS_EXPOSICION_POR_DEFECTO),
    );
  }, [salonProfile, businessType]);

  function handleSave(): boolean {
    const parsedFee = Number(noShowFeeEur.replace(",", "."));
    if (noShowEnabled && (!Number.isFinite(parsedFee) || parsedFee <= 0 || parsedFee > 50)) {
      toast.error("La penalización tiene que estar entre 0 y 50 €");
      return false;
    }
    const parsedNotice = Number(noShowNoticeHours);
    if (
      noShowEnabled &&
      (!Number.isFinite(parsedNotice) || parsedNotice < 1 || parsedNotice > 48)
    ) {
      toast.error("El aviso mínimo tiene que estar entre 1 y 48 horas");
      return false;
    }

    const parsedBuffer = Number(lastSlotBufferMin);
    if (
      smartSpreadEnabled &&
      (!Number.isFinite(parsedBuffer) || parsedBuffer < 0 || parsedBuffer > 240)
    ) {
      toast.error("Los minutos antes del cierre tienen que estar entre 0 y 240");
      return false;
    }
    const parsedMaxClientas = Number(maxClientasExposicion);
    if (!Number.isInteger(parsedMaxClientas) || parsedMaxClientas < 1 || parsedMaxClientas > 20) {
      toast.error("El máximo de clientas a la vez tiene que estar entre 1 y 20");
      return false;
    }

    // 22-oct: solo viajan las claves que esta persona puede cambiar. El
    // servidor exige `salon.editar` para plantones y duración, y
    // `reservas.editar` para lo de reservas (lib/api/guardas.ts): mandar las
    // dos juntas hacía fallar el guardado a quien solo tiene una.
    const parche: Partial<SalonProfile> = {};
    if (puede(permisos, "salon.editar")) {
      parche.noShowFeeEur = noShowEnabled ? Math.min(50, Math.max(0, parsedFee)) : 0;
      parche.noShowNoticeHours = Math.min(48, Math.max(1, Math.round(parsedNotice) || 2));
      parche.duracionFlexible = duracionFlexible;
    }
    if (puedeGestionarReservas) {
      parche.smartSpread = smartSpreadEnabled;
      parche.lastSlotBufferMin = smartSpreadEnabled
        ? Math.min(240, Math.max(0, Math.round(parsedBuffer)))
        : 0;
      parche.bookingQuestionsEnabled = questionsEnabled;
      parche.bookingQuestionsRequired = questionsRequired;
      parche.ocultarPrecioReserva = ocultarPrecioReserva;
      parche.maxClientasExposicion = parsedMaxClientas;
    }
    // La señal se guarda en su propio bloque (AjustesSenal): aquí no se toca,
    // para no pisarla con valores viejos de este formulario.
    if (Object.keys(parche).length) guardarPerfil(parche);
    return true;
  }

  const guardar = <BotonGuardar onGuardar={handleSave} />;
  const fila = "space-y-4 border-t border-lino pt-5 first:border-t-0 first:pt-0";

  return (
    <div className="pagina">
      <PageHeader
        title="Ajustes"
        description="Cómo funciona tu salón: agenda, reservas, mensajes, plantones, fianza y colores."
      />
      <PrimerosPasos enAjustes />

      {esDemo && (
        <section className="min-w-0 rounded-[20px] border border-lino bg-card relleno-tarjeta">
          <h2 className="text-[15px] font-bold text-foreground">Ver como</h2>
          <p className="mt-1 mb-3 text-[13px] text-muted-foreground">
            Solo en la demo: mira el panel como lo vería cada persona del salón
          </p>
          <VerComo className="flex min-h-11 w-full max-w-full" />
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)] lg:items-start">
        <IndiceAjustes
          buscar={buscar}
          onBuscar={setBuscar}
          visibles={visibles}
          perfil={salonProfile}
          onIr={irA}
        />
        <div className="flex min-w-0 flex-col gap-3">
          {visibles.length === 0 && (
            <p className="rounded-[20px] border border-dashed border-lino-fuerte bg-card relleno-tarjeta text-[14px] text-cafe-medio">
              Ningún ajuste habla de «{buscar}». Prueba con otra palabra: «señal», «horas»,
              «WhatsApp»…
            </p>
          )}
          <SeccionAjustes
            id="guia"
            oculta={!visibles.includes("guia")}
            abrir={abrir}
            titulo="Guía de uso de la app"
            resumen="Cómo se usa siShow, paso a paso y con capturas del panel"
          >
            <GuiaUso />
          </SeccionAjustes>

          <SeccionAjustes
            id="agenda"
            oculta={!visibles.includes("agenda")}
            abrir={abrir}
            valor={valorActual("agenda", salonProfile)}
            titulo="Tu agenda"
            resumen="Duración al aceptar, cómo se abre el calendario y verlo en tu móvil"
            abierta
          >
            <div className={fila}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="duracion-flexible" className="text-[15px] font-extrabold">
                    La duración de cada cita la decido yo al aceptarla
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La web muestra una duración orientativa. Cuando llegue la solicitud, podrás
                    fijar los minutos antes de confirmarla.
                  </p>
                </div>
                <Switch
                  id="duracion-flexible"
                  aria-label="La duración de cada cita la decido yo al aceptarla"
                  checked={duracionFlexible}
                  onCheckedChange={setDuracionFlexible}
                />
              </div>
              {guardar}
            </div>
            <div className={fila}>
              <h3 className="text-[15px] font-extrabold">Cómo se abre tu calendario</h3>
              <p className="-mt-2 text-sm text-muted-foreground">
                Se guarda al cambiarlo. También lo tienes en el engranaje del propio calendario.
              </p>
              <div className="max-w-md">
                <CamposPreferenciasCalendario />
              </div>
            </div>
            <div className={fila}>
              <h3 className="text-[15px] font-extrabold">Cómo se abren las fichas</h3>
              <p className="-mt-2 text-sm text-muted-foreground">
                En ordenador. Se guarda en este navegador.
              </p>
              <AjustesFichas />
            </div>
            <div className={fila}>
              <AjustesDiasEspeciales />
            </div>
            <div className={fila}>
              <div>
                <h3 className="text-[15px] font-extrabold">
                  Ver tus citas en Google Calendar o en el calendario del iPhone
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Tu calendario la actualiza cada pocas horas; la agenda al minuto está en siShow.
                  Solo aparecen citas confirmadas, como «Cita reservada»: con su hora, sin datos de
                  la clienta.
                </p>
              </div>
              {!realSlug ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    La suscripción se activa cuando el salón es real. En esta demo puedes ver cómo
                    quedará el ajuste.
                  </p>
                  <BotonesSuscripcion
                    url="https://ejemplo.invalid/api/calendario?token=EJEMPLO"
                    ejemplo
                  />
                </>
              ) : (
                <>
                  {calendarError && (
                    <p className="text-sm text-melocoton-tinta">
                      No se pudo cargar el enlace. Comprueba que el calendario esté activado en el
                      servidor y vuelve a abrir Ajustes.
                    </p>
                  )}
                  {calendarToken && (
                    <>
                      <label className="block space-y-1 text-sm">
                        <span>Calendario</span>
                        <select
                          aria-label="Calendario"
                          value={profesional}
                          onChange={(e) => setProfesional(e.target.value)}
                          className="flex h-10 w-full rounded-xl border border-input bg-blanco px-3 text-sm"
                        >
                          <option value="">Todo el salón</option>
                          {equipo.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <Input
                          readOnly
                          aria-label="Enlace del calendario"
                          value={calendarUrl}
                          className="min-w-0 flex-1 text-xs"
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            void navigator.clipboard
                              .writeText(calendarUrl)
                              .then(() => toast.success("Enlace copiado"))
                              .catch(() => toast.error("No se pudo copiar el enlace"));
                          }}
                        >
                          Copiar enlace
                        </Button>
                      </div>
                      <BotonesSuscripcion url={calendarUrl} />
                      <p className="text-xs text-muted-foreground">
                        Este enlace es privado: quien lo tenga podrá ver esas citas. Si lo
                        regeneras, el anterior dejará de funcionar.
                      </p>
                    </>
                  )}
                  <Button
                    disabled={calendarBusy}
                    variant={calendarToken ? "outline" : "default"}
                    className="min-h-11"
                    onClick={() => (calendarToken ? setConfirmarRegenerar(true) : crearEnlace())}
                  >
                    {calendarToken ? "Regenerar enlace" : "Crear enlace"}
                  </Button>
                  <AlertDialog open={confirmarRegenerar} onOpenChange={setConfirmarRegenerar}>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Crear un enlace nuevo?</AlertDialogTitle>
                        <AlertDialogDescription>
                          El enlace actual dejará de funcionar al momento: los móviles y calendarios
                          que lo tengan dejarán de ver tus citas hasta que añadas el nuevo. Hazlo
                          solo si crees que alguien que no debe lo tiene.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Dejar el actual</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => {
                            setConfirmarRegenerar(false);
                            crearEnlace();
                          }}
                        >
                          Sí, crear uno nuevo
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </SeccionAjustes>

          <SeccionAjustes
            id="reservas"
            oculta={!visibles.includes("reservas")}
            abrir={abrir}
            valor={valorActual("reservas", salonProfile)}
            titulo="Reservas por internet"
            resumen="Preguntas al reservar, reparto de agenda y lo que dice tu web"
          >
            <div className={fila}>
              <div>
                <h3 className="text-[15px] font-extrabold">Preguntas al reservar</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Lo que preguntas a la clienta al reservar, para preparar la cita. Tú eliges qué,
                  en qué orden y para qué servicios.
                </p>
              </div>
              {/* Los interruptores de siempre solo cuentan mientras no hay lista propia (contrato §2). */}
              {!salonProfile.preguntasReserva && (
                <div className="space-y-3 rounded-2xl bg-nata p-3.5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label>Preguntar al reservar</Label>
                      <p className="mt-0.5 text-[12.5px] text-muted-foreground">
                        Mientras no guardes tu lista, se hacen las tres de siempre.
                      </p>
                    </div>
                    <Switch
                      aria-label="Activar preguntas al reservar"
                      checked={questionsEnabled}
                      onCheckedChange={setQuestionsEnabled}
                    />
                  </div>
                  {questionsEnabled && (
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <Label>Respuestas obligatorias</Label>
                      </div>
                      <Switch
                        aria-label="Hacer obligatorias las preguntas"
                        checked={questionsRequired}
                        onCheckedChange={setQuestionsRequired}
                      />
                    </div>
                  )}
                  {guardar}
                </div>
              )}
              <AjustesPreguntas />
            </div>
            <div className={fila}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label htmlFor="ocultar-precio-reserva" className="text-[15px] font-extrabold">
                    No mostrar precios al reservar
                  </Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    La clienta verá los servicios y podrá reservar igual; el importe seguirá
                    apareciendo en tu panel.
                  </p>
                </div>
                <Switch
                  id="ocultar-precio-reserva"
                  aria-label="No mostrar precios al reservar"
                  checked={ocultarPrecioReserva}
                  onCheckedChange={setOcultarPrecioReserva}
                />
              </div>
              {guardar}
            </div>
            <div className={fila}>
              <div>
                <Label htmlFor="max-clientas-exposicion" className="text-[15px] font-extrabold">
                  Máximo de clientas a la vez por profesional durante exposiciones
                </Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Cuenta a todas las clientas que siguen en el salón, aunque su color esté actuando.
                  Los tiempos se ajustan dentro de cada servicio.
                </p>
              </div>
              <div className="max-w-xs space-y-1.5">
                <Input
                  id="max-clientas-exposicion"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={20}
                  step={1}
                  value={maxClientasExposicion}
                  onChange={(e) => setMaxClientasExposicion(e.target.value)}
                />
                <p className="text-[12.5px] text-muted-foreground">De 1 a 20. Por defecto, 6.</p>
              </div>
              {guardar}
            </div>
            <div className={fila}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-[15px] font-extrabold">Reparto de agenda</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Sugiere una hora más tranquila cuando alguien elige una franja con espera
                    (12:00–14:00 o las últimas horas del día). Nunca le impide elegir la suya.
                  </p>
                </div>
                <Switch
                  aria-label="Activar reparto de agenda"
                  checked={smartSpreadEnabled}
                  onCheckedChange={setSmartSpreadEnabled}
                />
              </div>
              {smartSpreadEnabled && (
                <Field
                  label="No ofrecer los últimos (min)"
                  value={lastSlotBufferMin}
                  onChange={setLastSlotBufferMin}
                  hint="Minutos antes del cierre que dejan de ofertarse. De 0 a 240."
                />
              )}
              {guardar}
            </div>
            {puede(permisos, "web.editar") && (
              <div className={fila}>
                <Link
                  to="/app/web"
                  className="flex items-center justify-between gap-4 rounded-2xl border border-lino bg-nata p-4 transition-colors hover:border-moca hover:text-foreground"
                >
                  <div>
                    <p className="text-[15px] font-extrabold">Lo que se lee en tu web</p>
                    <p className="mt-1 text-sm text-cafe-medio">
                      El nombre, la foto, el horario, los servicios, el equipo y las preguntas
                      frecuentes —también tu política de cancelación— se cambian en{" "}
                      <strong>Mi página de reservas</strong>, viendo el resultado.
                    </p>
                  </div>
                  <ArrowUpRight
                    className="h-5 w-5 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </Link>
              </div>
            )}
            <AjustesPrivacidad />
            <AjustesFestivos />
          </SeccionAjustes>

          <SeccionAjustes
            id="mensajes"
            oculta={!visibles.includes("mensajes")}
            abrir={abrir}
            valor={valorActual("mensajes", salonProfile)}
            titulo="Mensajes de WhatsApp"
            resumen="El texto de la confirmación y del recordatorio, a tu manera"
          >
            <AjustesMensajes />
          </SeccionAjustes>

          <SeccionAjustes
            id="plantones"
            oculta={!visibles.includes("plantones")}
            abrir={abrir}
            valor={valorActual("plantones", salonProfile)}
            titulo="Plantones y fianza por hora de servicio"
            resumen="Penalización por no venir y la regla de la fianza"
          >
            <div className={fila}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-[15px] font-extrabold">Plantones</Label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cobra una penalización a quien cancela tarde o no viene, antes de que pueda
                    volver a reservar. Tú decides en cada caso si la aplicas o la perdonas.
                  </p>
                </div>
                <Switch
                  aria-label="Activar penalización por plantón"
                  checked={noShowEnabled}
                  onCheckedChange={setNoShowEnabled}
                />
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
              {guardar}
            </div>
            <AjustesSenal />
          </SeccionAjustes>

          {calendarios.activo && calendarios.slug && alcanceCalendario(permisos) === "todo" && (
            <SeccionAjustes
              id="calendarios"
              oculta={!visibles.includes("calendarios")}
              abrir={abrir}
              valor={valorActual("calendarios", salonProfile)}
              titulo="Calendarios"
              resumen="Google Calendar y el calendario del iPhone: tus huecos y tus citas, cruzados"
            >
              <AjustesCalendarios api={API_CALENDARIOS} slug={calendarios.slug} />
            </SeccionAjustes>
          )}

          {puede(permisos, "historial.ver") && (
            <SeccionAjustes
              id="historial"
              oculta={!visibles.includes("historial")}
              abrir={abrir}
              valor={valorActual("historial", salonProfile)}
              titulo="Historial de cambios"
              resumen="Quién cambió qué, antes y después, y deshacerlo"
            >
              <HistorialCambios />
            </SeccionAjustes>
          )}

          {puede(permisos, "accesos.gestionar") && (
            <SeccionAjustes
              id="accesos"
              oculta={!visibles.includes("accesos")}
              abrir={abrir}
              valor={valorActual("accesos", salonProfile)}
              titulo="Accesos"
              resumen="Quién entra en el panel, con qué rol y a qué profesional corresponde"
            >
              <FilaInstalar />
              <AjustesAccesos />
            </SeccionAjustes>
          )}

          <SeccionAjustes
            id="colores"
            oculta={!visibles.includes("colores")}
            abrir={abrir}
            valor={valorActual("colores", salonProfile)}
            titulo="Colores"
            resumen="El color de cada servicio y de cada profesional en el calendario"
          >
            <AjustesColores />
          </SeccionAjustes>

          {!buscar.trim() && <ResumenPlanSuperior />}
        </div>
      </div>
    </div>
  );
}

/** Sección de Ajustes plegable desde su título; recuerda si la dueña la dejó abierta. */
function SeccionAjustes({
  id,
  titulo,
  resumen,
  valor,
  oculta = false,
  abrir,
  abierta = false,
  children,
}: {
  id: IdSeccionAjustes;
  titulo: string;
  resumen: string;
  valor?: string;
  oculta?: boolean;
  abrir: { id: IdSeccionAjustes; n: number } | null;
  abierta?: boolean;
  children: React.ReactNode;
}) {
  const [abierto, alternar] = usePlegado(`ajustes:${titulo}`, abierta);
  // «Ir a» desde el índice o el buscador: se abre si estaba plegada.
  useEffect(() => {
    if (abrir?.id === id && !abierto) alternar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abrir]);
  if (oculta) return null;
  return (
    <section
      id={`ajuste-${id}`}
      className="entrada-lista scroll-mt-24 overflow-hidden tarjeta-principal bg-card"
    >
      <h2>
        <button
          type="button"
          aria-expanded={abierto}
          onClick={alternar}
          className="flex w-full items-center gap-3 px-[var(--relleno-tarjeta)] py-4 text-left hover:bg-beige/50"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-extrabold tracking-[-0.01em]">{titulo}</span>
            <span className="block text-[13px] leading-snug text-muted-foreground">{resumen}</span>
          </span>
          {valor && (
            <span className="hidden max-w-[45%] shrink-0 truncate rounded-full bg-beige px-3 py-1 text-[12.5px] font-bold text-cafe-medio tabular-nums sm:inline">
              {valor}
            </span>
          )}
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-cafe-medio transition-transform duration-200",
              abierto && "rotate-180",
            )}
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </button>
      </h2>
      <div className={cn("plegable", abierto && "abierto")}>
        <div className="min-h-0 overflow-hidden">
          {abierto && (
            <div className="space-y-5 border-t border-lino p-[var(--relleno-tarjeta)]">
              {children}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Índice lateral de Ajustes (PC: pegajoso a la izquierda; móvil: buscador y chips). */
function IndiceAjustes({
  buscar,
  onBuscar,
  visibles,
  perfil,
  onIr,
}: {
  buscar: string;
  onBuscar: (t: string) => void;
  visibles: IdSeccionAjustes[];
  perfil: SalonProfile;
  onIr: (id: IdSeccionAjustes) => void;
}) {
  return (
    <nav aria-label="Secciones de Ajustes" className="min-w-0 lg:sticky lg:top-24">
      <label className="relative block">
        <span className="sr-only">Buscar un ajuste</span>
        <Search
          className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-cafe-suave"
          strokeWidth={1.7}
        />
        <input
          type="search"
          value={buscar}
          onChange={(e) => onBuscar(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && visibles[0]) onIr(visibles[0]);
          }}
          placeholder="Buscar un ajuste…"
          className="h-10 w-full rounded-full border border-input bg-blanco pr-3 pl-10 text-[14px]"
        />
      </label>
      <ul className="mt-3 flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible">
        {visibles.map((id) => {
          const s = SECCIONES_AJUSTES.find((x) => x.id === id)!;
          const v = valorActual(id, perfil);
          return (
            <li key={id} className="shrink-0">
              <button
                type="button"
                onClick={() => onIr(id)}
                className="w-full rounded-full border border-lino bg-card px-3 py-1.5 text-left text-[13px] font-bold whitespace-nowrap hover:bg-beige lg:rounded-xl lg:border-transparent lg:bg-transparent lg:px-3 lg:py-2 lg:whitespace-normal"
              >
                {s.titulo}
                {v && (
                  <span className="hidden text-[12px] font-medium text-muted-foreground lg:block">
                    {v}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Guardar de una sección, con «Guardado ✓» unos segundos. */
function BotonGuardar({ onGuardar }: { onGuardar: () => boolean }) {
  const [hecho, setHecho] = useState(false);
  useEffect(() => {
    if (!hecho) return;
    const t = setTimeout(() => setHecho(false), 2200);
    return () => clearTimeout(t);
  }, [hecho]);
  return (
    <div className="flex items-center justify-end gap-3 pt-1">
      {hecho && (
        <span
          className="micro-check inline-flex items-center gap-1.5 text-[13px] font-bold text-hoja-tinta"
          role="status"
        >
          <svg viewBox="0 0 16 16" className="size-4" aria-hidden="true">
            <path
              d="M3 8.5l3 3 7-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Guardado
        </span>
      )}
      <Button onClick={() => setHecho(onGuardar())}>Guardar cambios</Button>
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
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-[12.5px] font-bold text-cafe-medio">
        {label}
      </Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      {hint ? <p className="text-[12.5px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Añadir el feed a Apple/Google Calendar con un toque. Solo salida: la app externa no escribe en siShow. */
function BotonesSuscripcion({ url, ejemplo = false }: { url: string; ejemplo?: boolean }) {
  const { webcal, google } = enlacesSuscripcion(url);
  const clase =
    "inline-flex h-10 flex-1 items-center justify-center rounded-xl border border-input bg-blanco px-3 text-center text-sm font-semibold";
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 min-[420px]:flex-row">
        <a className={clase} href={ejemplo ? undefined : webcal} aria-disabled={ejemplo}>
          Añadir a Apple Calendar
        </a>
        <a
          className={clase}
          href={ejemplo ? undefined : google}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={ejemplo}
        >
          Añadir a Google Calendar
        </a>
      </div>
      <p className="text-xs text-muted-foreground">
        Es de solo lectura: tu calendario muestra las citas de siShow pero no cambia nada aquí. Se
        actualiza solo; cada app decide cada cuánto.
      </p>
    </div>
  );
}
