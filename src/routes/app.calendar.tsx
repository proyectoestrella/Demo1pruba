import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useSalonStore } from "@/lib/store";
import { useIsMobile } from "@/hooks/use-mobile";
import { employees, employeeMap, serviceMap } from "@/lib/mock/salon";
import type { Appointment, EmployeeId } from "@/lib/mock/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { StylistDot } from "@/components/StylistAvatar";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/app/calendar")({
  component: CalendarView,
});

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9); // 9 — 19

function startOfWeek(anchor: Date) {
  const monday = new Date(anchor);
  const dow = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(monday.getDate() - (dow - 1));
  return monday;
}

function isSameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function CalendarView() {
  const isMobile = useIsMobile();
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [view, setView] = useState<"day" | "week">("week");
  const appointments = useSalonStore((s) => s.appointments);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<{ date: Date; employeeId: EmployeeId } | null>(null);
  const [newApptOpen, setNewApptOpen] = useState(false);

  // Mobile always shows a single day, regardless of the desktop day/week toggle.
  const effectiveView = isMobile ? "day" : view;

  const days = useMemo(() => {
    if (effectiveView === "day") return [anchor];
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
    d.setDate(d.getDate() + n * (effectiveView === "day" ? 1 : 7));
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
              {(["day", "week"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-full px-3 py-1 capitalize transition-colors",
                    view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground",
                  )}
                >
                  {v === "day" ? "Día" : "Semana"}
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Anterior">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAnchor(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })}
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
                active ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-card text-muted-foreground",
              )}
            >
              <span className="uppercase tracking-wide">{d.toLocaleDateString("es", { weekday: "short" })}</span>
              <span className="mt-0.5 font-display text-base text-foreground">{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-4 text-xs">
        {employees.map((e) => (
          <span key={e.id} className="flex items-center gap-1.5">
            <StylistDot employeeId={e.id} />
            {e.name}
          </span>
        ))}
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
        <div className="overflow-x-auto">
          <div className="min-w-[420px]">
            <div className="grid border-b border-border/60" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
              <div />
              {days.map((d) => (
                <div key={d.toISOString()} className="border-l border-border/60 px-3 py-3 text-center text-xs">
                  <p className="uppercase tracking-widest text-muted-foreground">{d.toLocaleDateString("es", { weekday: "short" })}</p>
                  <p className="mt-1 font-display text-lg">{d.getDate()}</p>
                </div>
              ))}
            </div>

            <div className="relative grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(0, 1fr))` }}>
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
                return (
                  <div key={day.toISOString()} className="relative border-l border-border/60">
                    {HOURS.map((h) => (
                      <button
                        key={h}
                        type="button"
                        onClick={() => openSlot(day, h)}
                        className="block h-16 w-full border-b border-border/50 transition-colors hover:bg-primary/5"
                        aria-label={`Crear cita el ${day.toLocaleDateString("es")} a las ${h}:00`}
                      />
                    ))}
                    {dayAppts.map((a) => {
                      const start = new Date(a.start);
                      const minutes = (start.getHours() - HOURS[0]) * 60 + start.getMinutes();
                      if (minutes < 0) return null;
                      const top = (minutes / 60) * 64;
                      const height = (a.duration / 60) * 64;
                      const emp = employeeMap[a.employeeId];
                      const svc = serviceMap[a.serviceId];
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => setSelected(a)}
                          className="absolute left-1 right-1 overflow-hidden rounded-md border-l-[3px] px-2 py-1 text-left text-[10px] shadow-sm transition-transform hover:-translate-y-0.5"
                          style={{
                            top,
                            height: Math.max(28, height - 2),
                            background: `color-mix(in oklch, var(${emp.colorVar}) 18%, var(--color-card))`,
                            borderLeftColor: `var(${emp.colorVar})`,
                          }}
                        >
                          <p className="truncate font-medium leading-tight text-foreground">{a.clientName}</p>
                          <p className="truncate text-muted-foreground">{svc?.name}</p>
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

      <AppointmentDetailSheet appointment={selected} open={!!selected} onOpenChange={(o) => !o && setSelected(null)} />
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
