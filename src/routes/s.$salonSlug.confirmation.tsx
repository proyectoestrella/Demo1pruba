import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CalendarPlus, Download, MapPin } from "lucide-react";
import { employeesForType, servicesForType, depositFor, requiresDeposit } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useBusinessType, useDisplayProfile } from "@/lib/use-display-profile";
import { StylistAvatar } from "@/components/StylistAvatar";
import { Button } from "@/components/ui/button";
import { Confetti, type ConfettiRef } from "@/components/magicui/confetti";
import { eur } from "@/lib/copy";
import { sumServices } from "@/lib/appointment-services";
import {
  construirEnlaceGoogleCalendar,
  construirIcs,
  construirIcsDataUri,
  esDispositivoApple,
  type DatosCita,
} from "@/lib/calendario";

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
  const equipo = useMemo(() => employeesForType(tipo, profile.team), [tipo, profile.team]);
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
  const confettiRef = useRef<ConfettiRef>(null);
  // Solo para ordenar los dos botones de calendario: en iPhone/iPad, Apple
  // primero; en el resto (Android incluido), Google primero. Los dos se ven
  // siempre. Se calcula en el cliente porque depende de navigator.userAgent.
  const [esApple, setEsApple] = useState(false);
  useEffect(() => {
    setEsApple(esDispositivoApple(navigator.userAgent));
  }, []);

  // Un disparo al aterrizar en la confirmación. Se respeta
  // `prefers-reduced-motion`: para quien lo pida, no cae nada.
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const t = setTimeout(() => {
      confettiRef.current?.fire({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.35 },
        // Latón y crema, para no meter colores ajenos a la marca.
        colors: ["#d6ab68", "#f0e6d2", "#8a6a3b"],
      });
    }, 250);
    return () => clearTimeout(t);
  }, []);

  if (!chosen.length || !employee) {
    return (
      <section className="mx-auto max-w-md px-5 py-24 text-center">
        <p className="text-muted-foreground">Faltan datos de la reserva.</p>
        <Link
          to="/s/$salonSlug/book"
          params={{ salonSlug }}
          className="mt-4 inline-block text-sm text-primary underline underline-offset-2"
        >
          Volver a reservar
        </Link>
      </section>
    );
  }

  const deposit = depositFor(total, totalMin);
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
    <section className="relative mx-auto max-w-2xl px-5 py-16 md:py-24">
      {/* El confeti solo cae aquí: es el único momento del flujo que lo merece.
          `pointer-events-none` para que no se coma los clics del contenido. */}
      <Confetti
        ref={confettiRef}
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        manualstart
      />

      <div className="flex flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="h-7 w-7" />
        </div>
        <h1 className="mt-6 font-display text-4xl">
          Solicitud recibida{name ? `, ${name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 text-muted-foreground">
          {profile.name} te confirmará la cita en breve. Guarda la fecha en tu calendario con el
          botón de abajo para no olvidarla.
        </p>
      </div>

      <div className="mt-10 rounded-3xl border border-border bg-card p-8">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tu cita</p>
          <span className="rounded-full bg-[var(--warning)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--warning)]">
            Pendiente de confirmar
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <StylistAvatar name={employee.name} employeeId={employee.id} size="md" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl">{serviceNames.join(" + ")}</h2>
            <p className="text-sm text-muted-foreground">
              {soloUno ? employee.specialty : `con ${employee.name} · ${employee.specialty}`}
            </p>
          </div>
        </div>

        <div className="my-6 border-t border-dashed border-border" />

        <div className="space-y-3 text-sm">
          <Row k="Fecha" v={dateLabel} />
          <Row k="Hora" v={time || "—"} />
          <Row k={chosen.length > 1 ? "Duración total" : "Duración"} v={`${totalMin} min`} />
          {chosen.length > 1 ? (
            chosen.map((s, i) => <Row key={s.id} k={serviceNames[i]} v={eur(s.priceEur)} />)
          ) : (
            <Row k="Precio del servicio" v={eur(total)} />
          )}
          {requiresDeposit(totalMin) && (
            <Row k="Depósito a pagar en el salón" v={eur(deposit)} accent />
          )}
        </div>

        <div className="my-6 border-t border-dashed border-border" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-2xl">{eur(total)}</span>
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
          <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">
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
                  className="flex-1 rounded-full px-2 text-xs sm:text-sm"
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
                  className="flex-1 rounded-full px-2 text-xs sm:text-sm"
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
            className="text-center text-xs text-muted-foreground underline underline-offset-2"
          >
            <Download className="mr-1 inline h-3 w-3" /> Otro calendario (.ics)
          </button>
        </div>
      )}

      <div className="mt-6 flex gap-3">
        <Button asChild className="flex-1 rounded-full">
          <Link to="/s/$salonSlug" params={{ salonSlug }}>
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
