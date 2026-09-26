import { createFileRoute, Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Check, CalendarPlus, Info, Download, MapPin } from "lucide-react";
import { employeesForType, servicesForType } from "@/lib/mock/salon";
import { reglaSenal, textoSenalPublico } from "@/lib/senal";
import { useSalonStore } from "@/lib/store";
import { duracionFlexibleActiva } from "@/lib/duracion-flexible";
import { recargoActivo } from "@/lib/recargo-activo";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import { DEMO_PARAM, decodeDemoProfile } from "@/lib/demo-profile";
import { StylistAvatar } from "@/components/StylistAvatar";
import { Button } from "@/components/ui/button";
import { eur } from "@/lib/copy";
import { sumServices } from "@/lib/appointment-services";
import {
  construirEnlaceGoogleCalendar,
  construirIcs,
  construirIcsDataUri,
  esDispositivoApple,
  type DatosCita,
} from "@/lib/calendario";

/** "45 min" / "1 h" / "1 h 30" — igual que en el asistente de reserva. */
function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  if (m === 0) return `${h} h`;
  return `${h} h ${m}`;
}

function flexDurationRange(catalogMin: number): { lo: number; hi: number } {
  const hi = Math.round((catalogMin * 1.5) / 15) * 15;
  return { lo: catalogMin, hi: Math.max(hi, catalogMin) };
}

function formatRetrasoMinutos(min: number): string {
  if (min === 60) return "1 hora";
  if (min % 60 === 0) return `${min / 60} horas`;
  return `${min} minutos`;
}

function recargoRetrasoTexto(recargo: { pct: number; minutos: number }): string {
  return `Si llegas con más de ${formatRetrasoMinutos(recargo.minutos)} de retraso se aplica un recargo del ${recargo.pct} % del precio del servicio.`;
}

export const Route = createFileRoute("/s/$salonSlug/confirmation")({
  validateSearch: (search: Record<string, unknown>) => ({
    service: String(search.service ?? ""),
    employeeId: String(search.employeeId ?? "mario"),
    date: String(search.date ?? ""),
    time: String(search.time ?? ""),
    name: String(search.name ?? ""),
  }),
  component: Confirmation,
});

function Confirmation() {
  const { salonSlug } = Route.useParams();
  const { service: sid, employeeId, date, time, name } = Route.useSearch();
  // El tipo se deduce del mismo enlace de demo que ya venía leyendo la
  // cabecera (useDisplayProfile lee el `?d=` de la URL actual si lo hay, y
  // si no, el perfil guardado del navegador) — así el catálogo y el equipo
  // salen bien en el primer render, sin depender de un efecto de cliente.
  const profile = useDisplayProfile();
  const tipo = useBusinessType();
  const serviceMap = useMemo(
    () => Object.fromEntries(servicesForType(tipo, profile.menu).map((s) => [s.id, s])),
    [tipo, profile.menu],
  );
  const equipo = useMemo(() => employeesForType(tipo, profile.team, profile.teamHours, profile.openingHours, profile.teamIds), [tipo, profile.team, profile.teamHours, profile.openingHours, profile.teamIds]);
  // Con un solo profesional, "con Adam" sobra: no puede ser con otro.
  const soloUno = esSoloUnProfesional(equipo);
  const employeeMap = useMemo(() => Object.fromEntries(equipo.map((e) => [e.id, e])), [equipo]);
  // `service` trae uno o varios ids separados por comas, tal y como los deja el wizard.
  const chosen = sid
    .split(",")
    .map((id) => serviceMap[id.trim()])
    .filter(Boolean);
  const serviceNames = chosen.map((s) => s.name);
  const { durationMin: totalMin, priceEur: total } = sumServices(chosen);
  const employee = employeeMap[employeeId];
  // Solo para ordenar los dos botones de calendario: en iPhone/iPad, Apple
  // primero; en el resto (Android incluido), Google primero. Los dos se ven
  // siempre. Se calcula en el cliente porque depende de navigator.userAgent.
  const [esApple, setEsApple] = useState(false);
  useEffect(() => {
    setEsApple(esDispositivoApple(navigator.userAgent));
  }, []);

  // Personalización de demo pura (no vive en SalonProfile): se lee del mismo
  // enlace `?d=`, igual que en el asistente de reserva.
  const demoParamRaw = useRouterState({
    select: (s) => {
      const sp = s.location.search as Record<string, unknown> | undefined;
      return typeof sp?.[DEMO_PARAM] === "string" ? (sp[DEMO_PARAM] as string) : undefined;
    },
  });
  const demoPersonalizacion = useMemo(() => decodeDemoProfile(demoParamRaw), [demoParamRaw]);
  // Si esta URL no trae `?d=` (se llegó navegando desde el asistente, no con
  // el enlace directo), cae a lo que el layout ya guardó en el store al
  // abrir la portada — igual que en el asistente de reserva.
  const storedRecargoRetraso = useSalonStore((s) => s.salonProfile.recargoRetraso);
  const storedDuracionFlexible = useSalonStore((s) => s.salonProfile.duracionFlexible);
  const realSalonSlug = useSalonStore((s) => s.realSalonSlug);
  const flexible = duracionFlexibleActiva(
    { duracionFlexible: storedDuracionFlexible }, demoPersonalizacion, realSalonSlug === salonSlug,
  );
  const recargoRetraso = demoPersonalizacion?.recargoRetraso ?? storedRecargoRetraso;
  const flexRange = flexible ? flexDurationRange(totalMin) : null;
  const durationLabel =
    flexRange && totalMin > 0
      ? `aprox. ${formatMinutes(flexRange.lo)} – ${formatMinutes(flexRange.hi)}`
      : `${totalMin} min`;
  const flexNota = flexible
    ? `La duración final la confirma ${profile.name || "el salón"} al aceptar tu solicitud.`
    : undefined;
  const recargoTexto = recargoActivo(profile) && recargoRetraso ? recargoRetrasoTexto(recargoRetraso) : undefined;


  if (!chosen.length || !employee) {
    return (
      <section className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="text-muted-foreground">Faltan datos de la reserva.</p>
        <Link
          to="/s/$salonSlug/book"
          params={{ salonSlug }}
          search={(prev) => prev}
          className="mt-4 inline-block text-sm text-primary underline underline-offset-2"
        >
          Volver a reservar
        </Link>
      </section>
    );
  }

  // El único mensaje sobre la señal (9j): el de la regla del salón, o nada.
  const textoSenal = textoSenalPublico(
    reglaSenal(profile),
    { durationMin: totalMin, serviceIds: chosen.map((s) => s.id), priceEur: total },
    profile.name,
    (n) => eur(n).replace(",00", ""),
  );
  const dateLabel = date
    ? new Date(`${date}T${time || "00:00"}`).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "—";

  const datosCita: DatosCita | null =
    date && time
      ? {
          fecha: date,
          hora: time,
          duracionMin: totalMin,
          servicio: serviceNames.join(" + "),
          salon: profile.name,
          direccion: profile.address,
        }
      : null;

  const enlaceGoogle = datosCita ? construirEnlaceGoogleCalendar(datosCita) : null;
  const enlaceAppleDataUri = datosCita ? construirIcsDataUri(datosCita) : null;

  function downloadIcs() {
    if (!datosCita) return;
    const ics = construirIcs(datosCita);
    const blob = new Blob([ics], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cita.ics";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    // Lote 17: sin confeti (latón y dorado, fuera de la paleta) ni aviso
    // emergente encima; el check se dibuja una vez (.micro-check).
    <section className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 md:py-20">

      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-hoja text-white">
          <Check className="micro-check h-7 w-7" aria-hidden="true" />
        </div>
        <h1 className="mt-6 text-[26px] font-extrabold leading-tight tracking-tight md:text-[32px]">
          Solicitud recibida{name ? `, ${name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
          {profile.name} te confirmará la cita en breve. Guarda la fecha en tu calendario con el
          botón de abajo para no olvidarla.
        </p>
      </div>

      <div className="mt-8 rounded-[20px] border border-lino bg-card p-5 sm:p-8">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">Tu cita</p>
          <span className="rounded-full border border-dashed border-moca px-2.5 py-0.5 text-xs font-semibold text-cafe-medio">
            Pendiente de confirmar
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <StylistAvatar name={employee.name} employeeId={employee.id} size="md" />
          <div className="min-w-0">
            <h2 className="text-xl font-extrabold leading-snug">{serviceNames.join(" + ")}</h2>
            <p className="text-sm text-muted-foreground">
              {/* Con un único profesional no se enseña como si se hubiera
                  elegido: se informa de quién atiende. */}
              {soloUno ? `Te atiende ${employee.name}` : `con ${employee.name} · ${employee.specialty}`}
            </p>
          </div>
        </div>

        <div className="my-6 border-t border-dashed border-border" />

        <div className="space-y-3 text-sm">
          <Row k="Fecha" v={dateLabel} />
          <Row k="Hora" v={time || "—"} />
          <Row k={chosen.length > 1 ? "Duración total" : "Duración"} v={durationLabel} />
          {chosen.length > 1 ? (
            chosen.map((s, i) => <Row key={s.id} k={serviceNames[i]} v={eur(s.priceEur)} />)
          ) : (
            <Row k="Precio del servicio" v={eur(total)} />
          )}
        </div>
        {textoSenal && (
          <p className="mt-5 flex items-start gap-3 rounded-2xl border border-lino-fuerte bg-perla px-4 py-3.5 text-sm leading-relaxed text-foreground">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{textoSenal}</span>
          </p>
        )}

        {flexNota && (
          <p className="mt-4 text-sm font-medium text-foreground">{flexNota}</p>
        )}
        {recargoTexto && (
          <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{recargoTexto}</p>
        )}

        <div className="my-6 border-t border-dashed border-border" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="text-2xl font-extrabold tabular-nums">{eur(total)}</span>
        </div>

        <div className="my-6 border-t border-dashed border-border" />

        <div className="flex items-start gap-3 text-sm text-muted-foreground">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <p className="text-foreground">{profile.name}</p>
            <p>{profile.address}</p>
          </div>
        </div>
      </div>

      {datosCita && (
        <div className="mt-6 flex flex-col gap-3">
          <p className="text-center text-[11px] font-bold uppercase tracking-[0.08em] text-cafe-suave">
            Añadir a mi calendario
          </p>
          <div className="flex gap-3">
            {(esApple
              ? (["apple", "google"] as const)
              : (["google", "apple"] as const)
            ).map((proveedor) =>
              proveedor === "google" ? (
                <Button
                  key="google"
                  asChild
                  variant="outline"
                  className="h-12 flex-1 rounded-full px-2 text-sm font-semibold"
                >
                  <a href={enlaceGoogle!} target="_blank" rel="noopener noreferrer">
                    <CalendarPlus className="h-4 w-4 shrink-0" /> Google
                  </a>
                </Button>
              ) : (
                <Button
                  key="apple"
                  asChild
                  variant="outline"
                  className="h-12 flex-1 rounded-full px-2 text-sm font-semibold"
                >
                  <a href={enlaceAppleDataUri!}>
                    <CalendarPlus className="h-4 w-4 shrink-0" /> Apple / iPhone
                  </a>
                </Button>
              ),
            )}
          </div>
          <button
            type="button"
            onClick={downloadIcs}
            className="mx-auto inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-medium text-cafe-medio underline underline-offset-2 hover:bg-beige"
          >
            <Download className="h-4 w-4" aria-hidden="true" /> Otro calendario (.ics)
          </button>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button asChild className="h-12 flex-1 rounded-full text-[15px] font-semibold">
          <Link to="/s/$salonSlug" params={{ salonSlug }} search={(prev) => prev}>
            Hecho
          </Link>
        </Button>
      </div>
    </section>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{k}</span>
      <span className={accent ? "font-medium text-primary" : "font-medium"}>{v}</span>
    </div>
  );
}
