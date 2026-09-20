import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSalonStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { employees, employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import type { Appointment, Employee, EmployeeId } from "@/lib/mock/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { StylistDot } from "@/components/StylistAvatar";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Button } from "@/components/ui/button";
import { usePanelV2 } from "@/lib/use-panel-v2";
import { AgendaColumns } from "@/components/AgendaColumns";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarRoute,
});

function CalendarRoute() {
  const panelV2 = usePanelV2();
  if (panelV2) return <AgendaColumns />;
  return <CalendarView />;
}

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9); // 9 — 19

function startOfWeek(anchor: Date) {
  const monday = new Date(anchor);
  const dow = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(monday.getDate() - (dow - 1));
  return monday;
}

/** Las 6x7 celdas de la cuadrícula del mes, empezando en lunes. */
function monthCells(anchor: Date) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const start = startOfWeek(first);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    d.setHours(0, 0, 0, 0);
    return d;
  });
}

const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function CalendarView() {
  const isMobile = useIsMobile();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<"day" | "week" | "month">("week");
  const appointments = useSalonStore((s) => s.appointments);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<{ date: Date; employeeId: EmployeeId } | null>(
    null,
  );
  const [newApptOpen, setNewApptOpen] = useState(false);
  // Un solo profesional: ni leyenda de colores, ni columnas por persona en la
  // vista Día, ni el punto de color en cada cita del mes. Ver
  // lib/solo-profesional.ts.
  const equipo = useEquipo();
  const soloUno = esSoloUnProfesional(equipo);

  // Reloj para la línea de "ahora": solo repinta cada minuto, no cada segundo —
  // es un indicador visual, no un cronómetro.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Mobile always shows a single day, regardless of the desktop day/week toggle.
  const effectiveView = isMobile ? "day" : view;

  const days = useMemo(() => {
    if (effectiveView === "day" || effectiveView === "month") return [anchor];
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [anchor, effectiveView]);

  const weekChips = useMemo(() => {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [anchor]);

  function shift(n: number) {
    const d = new Date(anchor);
    if (effectiveView === "month") {
      // Al día 1 antes de saltar: si no, del 31 de enero se pasa al 3 de marzo.
      d.setDate(1);
      d.setMonth(d.getMonth() + n);
    } else {
      d.setDate(d.getDate() + n * (effectiveView === "day" ? 1 : 7));
    }
    setAnchor(d);
  }

  function openSlot(day: Date, hour: number) {
    const date = new Date(day);
    date.setHours(hour, 0, 0, 0);
    setSlotPrefill({ date, employeeId: employees[0].id });
    setNewApptOpen(true);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Calendario"
        description={
          days.length > 1
            ? `${days[0].toLocaleDateString("es", { month: "long", day: "numeric" })} — ${days[days.length - 1].toLocaleDateString("es", { month: "long", day: "numeric" })}`
            : days[0].toLocaleDateString("es", { weekday: "long", month: "long", day: "numeric" })
        }
        actions={
          <div className="flex items-center gap-2">
            <div className="hidden rounded-full border border-border bg-card p-1 text-xs lg:flex">
              {(["day", "week", "month"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-full px-3 py-1 capitalize transition-colors",
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {v === "day" ? "Día" : v === "week" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setAnchor(() => {
                  const d = new Date();
                  d.setHours(0, 0, 0, 0);
                  return d;
                })
              }
            >
              Hoy
            </Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Siguiente">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      {/* Mobile day-picker chips — avoids ever cramming 7 columns into a phone screen */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        {weekChips.map((d) => {
          const active = isSameDate(d, anchor);
          return (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => setAnchor(d)}
              className={cn(
                "flex shrink-0 flex-col items-center rounded-xl border px-3.5 py-2 text-xs transition-colors",
                active
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/60 bg-card text-muted-foreground",
              )}
            >
              <span className="uppercase tracking-wide">
                {d.toLocaleDateString("es", { weekday: "short" })}
              </span>
              <span className="mt-0.5 font-display text-base text-foreground">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      {/* Leyenda de colores por profesional. Con una sola persona no hay
          nada que distinguir: todo el calendario es suyo. */}
      {!soloUno && (
        <div className="flex flex-wrap items-center gap-4 text-xs">
          {equipo.map((e) => (
            <span key={e.id} className="flex items-center gap-1.5">
              <StylistDot employeeId={e.id} />
              {e.name}
            </span>
          ))}
        </div>
      )}

      {effectiveView === "month" ? (
        <MonthGrid
          soloUno={soloUno}
          anchor={anchor}
          appointments={appointments}
          onPickDay={(d) => {
            setAnchor(d);
            setView("day");
          }}
        />
      ) : effectiveView === "day" ? (
        /* Vista Día: una columna por profesional, igual que hace Semana con
           los días. Antes las citas de los tres barberos se apilaban en la
           misma columna, se solapaban y el texto se cortaba — y cuanta más
           plantilla, peor. Es la misma rejilla de AgendaColumns (el panel v2)
           para que las dos versiones cuenten lo mismo. */
        <DayByEmployee
          soloUno={soloUno}
          employees={equipo}
          day={anchor}
          appointments={appointments}
          now={now}
          onSelect={setSelected}
          onOpenSlot={(employeeId, hour) => {
            const date = new Date(anchor);
            date.setHours(hour, 0, 0, 0);
            setSlotPrefill({ date, employeeId });
            setNewApptOpen(true);
          }}
        />
      ) : (
        <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
          <div className="overflow-x-auto">
            <div className="min-w-[420px]">
              <div
                className="grid border-b border-border/60"
                style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
              >
                <div />
                {days.map((d) => {
                  const today = isSameDate(d, now);
                  const weekend = d.getDay() === 0 || d.getDay() === 6;
                  return (
                    <div
                      key={d.toISOString()}
                      className={cn(
                        "border-l border-border/60 px-3 py-3 text-center text-xs",
                        weekend && !today && "bg-muted/30",
                        today && "bg-primary/10",
                      )}
                    >
                      <p
                        className={cn(
                          "uppercase tracking-widest text-muted-foreground",
                          today && "text-primary",
                        )}
                      >
                        {d.toLocaleDateString("es", { weekday: "short" })}
                      </p>
                      <p
                        className={cn(
                          "mt-1 font-display text-lg",
                          today &&
                            "mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground",
                        )}
                      >
                        {d.getDate()}
                      </p>
                    </div>
                  );
                })}
              </div>

              <div
                className="relative grid"
                style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}
              >
                <div className="border-r border-border/60">
                  {HOURS.map((h) => (
                    <div key={h} className="h-16 px-2 pt-1 text-[10px] text-muted-foreground">
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>
                {days.map((day) => {
                  const dayAppts = appointments.filter((a) => {
                    const ad = new Date(a.start);
                    return isSameDate(ad, day) && a.status !== "cancelled";
                  });
                  const isToday = isSameDate(day, now);
                  const weekend = day.getDay() === 0 || day.getDay() === 6;
                  // Línea de "ahora mismo", solo en la columna de hoy y dentro del rango horario visible.
                  const nowMinutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
                  const showNowLine = isToday && nowMinutes >= 0 && nowMinutes <= HOURS.length * 60;
                  const nowTop = (nowMinutes / 60) * 64;
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "relative border-l border-border/60",
                        weekend && !isToday && "bg-muted/10",
                        isToday && "bg-primary/[0.03]",
                      )}
                    >
                      {HOURS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => openSlot(day, h)}
                          className="block h-16 w-full border-b border-border/50 transition-colors hover:bg-primary/5"
                          aria-label={`Crear cita el ${day.toLocaleDateString("es")} a las ${h}:00`}
                        />
                      ))}
                      {showNowLine && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                          style={{ top: nowTop }}
                          aria-hidden="true"
                        >
                          <span className="-ml-1 size-2 shrink-0 rounded-full bg-destructive" />
                          <span className="h-px flex-1 bg-destructive/70" />
                        </div>
                      )}
                      {dayAppts.map((a) => {
                        const start = new Date(a.start);
                        const minutes = (start.getHours() - HOURS[0]) * 60 + start.getMinutes();
                        if (minutes < 0) return null;
                        const top = (minutes / 60) * 64;
                        const height = (a.duration / 60) * 64;
                        const emp = employeeMap[a.employeeId];
                        // El color de fondo marca el profesional; el estado se lee en el
                        // borde y la opacidad, sin tocar la lógica de qué citas se pintan.
                        const isNoShow = a.status === "no-show";
                        const isCompleted = a.status === "completed";
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => setSelected(a)}
                            className={cn(
                              "absolute left-1 right-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-[10px] shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md",
                              isNoShow && "border-dashed opacity-70",
                              isCompleted && "opacity-80",
                            )}
                            style={{
                              top,
                              height: Math.max(28, height - 2),
                              background: `color-mix(in oklch, var(${emp.colorVar}) 18%, var(--color-card))`,
                              borderLeftColor: `var(${emp.colorVar})`,
                            }}
                          >
                            <p className="truncate font-medium leading-tight text-foreground">
                              {a.clientName}
                            </p>
                            <p className="truncate text-muted-foreground">{serviceLabelOf(a)}</p>
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <AppointmentDetailSheet
        appointment={selected}
        open={!!selected}
        onOpenChange={(o) => !o && setSelected(null)}
      />
      <NewAppointmentDialog
        open={newApptOpen}
        onOpenChange={(o) => {
          setNewApptOpen(o);
          if (!o) setSlotPrefill(null);
        }}
        defaultDate={slotPrefill?.date}
        defaultEmployeeId={slotPrefill?.employeeId}
      />
    </div>
  );
}

/**
 * Cuadrícula del mes. No reutiliza la rejilla horaria a propósito: aquí no
 * interesa a qué hora es cada cita, sino cuántas hay cada día y si queda hueco.
 * Solo se muestra a partir de `lg:` — en un móvil, 42 celdas no se leen.
 */
function MonthGrid({
  anchor,
  appointments,
  onPickDay,
  soloUno,
}: {
  anchor: Date;
  appointments: Appointment[];
  onPickDay: (d: Date) => void;
  /** Con un solo profesional, el punto de color no distingue nada. */
  soloUno: boolean;
}) {
  const cells = useMemo(() => monthCells(anchor), [anchor]);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Un índice por día evita recorrer las ~1.000 citas 42 veces.
  const byDay = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      if (a.status === "cancelled") continue;
      const key = new Date(a.start).toDateString();
      const list = map.get(key);
      if (list) list.push(a);
      else map.set(key, [a]);
    }
    for (const list of map.values()) {
      list.sort((x, y) => +new Date(x.start) - +new Date(y.start));
    }
    return map;
  }, [appointments]);

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="grid grid-cols-7 border-b border-border/60">
        {WEEKDAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={cn(
              "border-l border-border/60 px-2 py-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground first:border-l-0",
              i >= 5 && "bg-muted/30",
            )}
          >
            {label}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((day) => {
          const dayAppts = byDay.get(day.toDateString()) ?? [];
          const outsideMonth = day.getMonth() !== anchor.getMonth();
          const isToday = isSameDate(day, today);
          const weekend = day.getDay() === 0 || day.getDay() === 6;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onPickDay(day)}
              className={cn(
                "flex h-28 flex-col items-stretch gap-1 border-l border-t border-border/60 p-1.5 text-left transition-colors first:border-l-0 hover:bg-muted/50",
                weekend && !outsideMonth && "bg-muted/10",
                outsideMonth && "bg-muted/20 text-muted-foreground",
                isToday && "ring-1 ring-inset ring-primary/40",
              )}
              aria-label={`${day.toLocaleDateString("es", { day: "numeric", month: "long" })}, ${dayAppts.length} citas`}
            >
              <span className="flex items-center justify-between">
                <span
                  className={cn(
                    "font-display text-sm",
                    isToday &&
                      "flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground",
                  )}
                >
                  {day.getDate()}
                </span>
                {dayAppts.length > 0 && (
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {dayAppts.length}
                  </span>
                )}
              </span>

              <span className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                {dayAppts.slice(0, 2).map((a) => (
                  <span
                    key={a.id}
                    title={`${a.clientName} · ${serviceLabelOf(a)}`}
                    className="flex items-center gap-1 truncate rounded bg-muted/60 px-1 py-0.5 text-[10px]"
                  >
                    {!soloUno && <StylistDot employeeId={a.employeeId} />}
                    <span className="truncate">
                      {new Date(a.start).toLocaleTimeString("es", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      {a.clientName}
                      <span className="text-muted-foreground"> · {serviceLabelOf(a)}</span>
                    </span>
                  </span>
                ))}
                {dayAppts.length > 2 && (
                  <span className="px-1 text-[10px] text-muted-foreground">
                    +{dayAppts.length - 2} más
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Vista Día separada por profesional.
 *
 * La rejilla es la misma que la de Semana (misma altura de hora, mismo
 * bloque de cita, misma línea de "ahora"), pero las columnas son personas en
 * vez de días: con tres barberos, apilar todo en una sola columna hacía que
 * las citas se taparan entre ellas y que los nombres salieran cortados.
 *
 * En móvil no cabe una columna por persona, así que se mantiene el scroll
 * horizontal con un ancho mínimo por columna en vez de encogerlas.
 */
function DayByEmployee({
  day,
  appointments,
  now,
  onSelect,
  onOpenSlot,
  soloUno,
  employees,
}: {
  day: Date;
  appointments: Appointment[];
  now: Date;
  onSelect: (a: Appointment) => void;
  onOpenSlot: (employeeId: EmployeeId, hour: number) => void;
  /** Con un solo profesional se pinta una única columna, y sin su cabecera. */
  soloUno: boolean;
  employees: Employee[];
}) {
  const dayAppts = useMemo(
    () =>
      appointments.filter((a) => isSameDate(new Date(a.start), day) && a.status !== "cancelled"),
    [appointments, day],
  );

  const isToday = isSameDate(day, now);
  const nowMinutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
  const showNowLine = isToday && nowMinutes >= 0 && nowMinutes <= HOURS.length * 60;
  const nowTop = (nowMinutes / 60) * 64;
  const columnas = `56px repeat(${employees.length}, minmax(140px, 1fr))`;

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
      <div className="overflow-x-auto">
        <div className="min-w-max">
          {!soloUno && (
            <div
              className="grid border-b border-border/60"
              style={{ gridTemplateColumns: columnas }}
            >
              <div />
              {employees.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center justify-center gap-1.5 border-l border-border/60 px-2 py-3 text-xs"
                >
                  <StylistDot employeeId={e.id} />
                  <span className="truncate font-medium">{e.name}</span>
                </div>
              ))}
            </div>
          )}

          <div className="relative grid" style={{ gridTemplateColumns: columnas }}>
            <div className="border-r border-border/60">
              {HOURS.map((h) => (
                <div key={h} className="h-16 px-2 pt-1 text-[10px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </div>
              ))}
            </div>
            {employees.map((e) => {
              const own = dayAppts.filter((a) => a.employeeId === e.id);
              return (
                <div key={e.id} className="relative border-l border-border/60">
                  {HOURS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => onOpenSlot(e.id, h)}
                      className="block h-16 w-full border-b border-border/50 transition-colors hover:bg-primary/5"
                      aria-label={`Crear cita con ${e.name} el ${day.toLocaleDateString("es")} a las ${h}:00`}
                    />
                  ))}
                  {showNowLine && (
                    <div
                      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                      style={{ top: nowTop }}
                      aria-hidden="true"
                    >
                      <span className="-ml-1 size-2 shrink-0 rounded-full bg-destructive" />
                      <span className="h-px flex-1 bg-destructive/70" />
                    </div>
                  )}
                  {own.map((a) => {
                    const start = new Date(a.start);
                    const minutes = (start.getHours() - HOURS[0]) * 60 + start.getMinutes();
                    if (minutes < 0) return null;
                    const emp = employeeMap[a.employeeId];
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => onSelect(a)}
                        className={cn(
                          "absolute left-1 right-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-[11px] shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md",
                          a.status === "no-show" && "border-dashed opacity-70",
                          a.status === "completed" && "opacity-80",
                        )}
                        style={{
                          top: (minutes / 60) * 64,
                          height: Math.max(30, (a.duration / 60) * 64 - 2),
                          background: `color-mix(in oklch, var(${emp.colorVar}) 18%, var(--color-card))`,
                          borderLeftColor: `var(${emp.colorVar})`,
                        }}
                      >
                        <p className="truncate font-medium leading-tight text-foreground">
                          {a.clientName}
                        </p>
                        <p className="truncate text-muted-foreground">{serviceLabelOf(a)}</p>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
