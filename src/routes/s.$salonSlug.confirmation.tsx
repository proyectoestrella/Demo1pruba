import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { Check, CalendarPlus, MapPin } from "lucide-react";
import { serviceMap, employeeMap, depositFor, requiresDeposit } from "@/lib/mock/salon";
import { useSalonStore } from "@/lib/store";
import { StylistAvatar } from "@/components/StylistAvatar";
import { Button } from "@/components/ui/button";
import { Confetti, type ConfettiRef } from "@/components/magicui/confetti";
import { EMPLOYEE_ES, eur } from "@/lib/copy";

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
  const service = serviceMap[sid];
  const employee = employeeMap[employeeId];
  const profile = useSalonStore((s) => s.salonProfile);
  const confettiRef = useRef<ConfettiRef>(null);

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

  if (!service || !employee) {
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

  const deposit = depositFor(service.priceEur, service.durationMin);
  const dateLabel = date
    ? new Date(`${date}T${time || "00:00"}`).toLocaleDateString("es-ES", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : "—";

  function downloadIcs() {
    if (!service || !date || !time) return;
    const start = new Date(`${date}T${time}:00`);
    const end = new Date(start.getTime() + service.durationMin * 60_000);
    const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "BEGIN:VEVENT",
      `DTSTART:${fmt(start)}`,
      `DTEND:${fmt(end)}`,
      `SUMMARY:${service.name} en ${profile.name}`,
      `LOCATION:${profile.address}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
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
          Reserva confirmada{name ? `, ${name.split(" ")[0]}` : ""}.
        </h1>
        <p className="mt-2 text-muted-foreground">
          Te esperamos. Guarda la cita en tu calendario con el botón de abajo para no olvidarla.
        </p>
      </div>

      <div className="mt-10 rounded-3xl border border-border bg-card p-8">
        <div className="flex items-center justify-between">
          <p className="text-xs uppercase tracking-widest text-muted-foreground">Tu cita</p>
          <span className="rounded-full bg-[var(--success)]/15 px-2.5 py-0.5 text-xs font-medium text-[var(--success)]">
            Confirmada
          </span>
        </div>

        <div className="mt-4 flex items-center gap-3">
          <StylistAvatar name={employee.name} employeeId={employee.id} size="md" />
          <div className="min-w-0">
            <h2 className="font-display text-2xl">{service.name}</h2>
            <p className="text-sm text-muted-foreground">
              con {employee.name} · {EMPLOYEE_ES[employee.id]?.specialty ?? employee.specialty}
            </p>
          </div>
        </div>

        <div className="my-6 border-t border-dashed border-border" />

        <div className="space-y-3 text-sm">
          <Row k="Fecha" v={dateLabel} />
          <Row k="Hora" v={time || "—"} />
          <Row k="Duración" v={`${service.durationMin} min`} />
          <Row k="Precio del servicio" v={eur(service.priceEur)} />
          {requiresDeposit(service.durationMin) && (
            <Row k="Depósito a pagar en el salón" v={eur(deposit)} accent />
          )}
        </div>

        <div className="my-6 border-t border-dashed border-border" />

        <div className="flex items-baseline justify-between">
          <span className="text-sm text-muted-foreground">Total</span>
          <span className="font-display text-2xl">{eur(service.priceEur)}</span>
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

      <div className="mt-6 flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={downloadIcs}
          className="flex-1 rounded-full"
        >
          <CalendarPlus className="h-4 w-4" /> Añadir a mi calendario
        </Button>
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
