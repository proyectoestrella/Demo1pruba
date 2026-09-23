import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useSalonStore } from "@/lib/store";
import { employeeMap } from "@/lib/mock/salon";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import { serviceLabelOf } from "@/lib/appointment-services";
import { capitalizar, fechaLarga } from "@/lib/copy";
import type { Appointment, EmployeeId } from "@/lib/mock/types";
import { cn } from "@/lib/utils";
import { TiraScroll } from "@/components/TiraScroll";
import { StylistAvatar } from "@/components/StylistAvatar";
import { AppointmentDetailSheet } from "@/components/AppointmentDetailSheet";
import { NewAppointmentDialog } from "@/components/NewAppointmentDialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HOURS = Array.from({ length: 11 }, (_, i) => i + 9); // 9 — 19
const ROW_HEIGHT = 64;

function isSameDate(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function startOfWeek(anchor: Date) {
  const monday = new Date(anchor);
  const dow = monday.getDay() === 0 ? 7 : monday.getDay();
  monday.setDate(monday.getDate() - (dow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/**
 * Agenda v2: columnas por profesional con la hora actual marcada, en vez de
 * columnas por día. Patrón de Treatwell Pro y Boulevard (ver el informe de
 * referencias) — es lo que deja ver de un vistazo quién tiene hueco ahora
 * mismo, que es la pregunta que se hace diez veces al día en el mostrador.
 *
 * En móvil, un profesional a la vez con un selector: seis columnas de 64px no
 * caben en una pantalla de 390px sin convertirse en ilegibles.
 */
export function AgendaColumns() {
  const appointments = useSalonStore((s) => s.appointments);
  const employees = useEquipo();
  // Con un solo profesional no hay columnas que comparar: ni selector de
  // móvil, ni cabecera con su foto encima de su propia agenda.
  const soloUno = esSoloUnProfesional(employees);
  const [anchor, setAnchor] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [mobileEmployee, setMobileEmployee] = useState<EmployeeId | undefined>(employees[0]?.id);
  // El equipo puede llegar después del primer render (salón real).
  useEffect(() => {
    setMobileEmployee((actual) =>
      actual && employees.some((e) => e.id === actual) ? actual : employees[0]?.id,
    );
  }, [employees]);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [slotPrefill, setSlotPrefill] = useState<{ date: Date; employeeId: EmployeeId } | null>(
    null,
  );
  const [newApptOpen, setNewApptOpen] = useState(false);

  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const weekChips = useMemo(() => {
    const monday = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      return d;
    });
  }, [anchor]);

  function shift(days: number) {
    const d = new Date(anchor);
    d.setDate(d.getDate() + days);
    setAnchor(d);
  }

  const dayAppts = useMemo(
    () =>
      appointments.filter((a) => isSameDate(new Date(a.start), anchor) && a.status !== "cancelled"),
    [appointments, anchor],
  );

  function openSlot(employeeId: EmployeeId, hour: number) {
    const date = new Date(anchor);
    date.setHours(hour, 0, 0, 0);
    setSlotPrefill({ date, employeeId });
    setNewApptOpen(true);
  }

  const isToday = isSameDate(anchor, now);
  const nowMinutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
  const showNowLine = isToday && nowMinutes >= 0 && nowMinutes <= HOURS.length * 60;
  const nowTop = (nowMinutes / 60) * ROW_HEIGHT;

  function Column({ employeeId }: { employeeId: EmployeeId }) {
    const emp = employeeMap[employeeId];
    const own = dayAppts.filter((a) => a.employeeId === employeeId);
    return (
      <div className="relative border-l border-border/60 first:border-l-0">
        {HOURS.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => openSlot(employeeId, h)}
            className="block h-16 w-full border-b border-border/50 transition-colors hover:bg-primary/5"
            aria-label={`Crear cita con ${emp.name} el ${anchor.toLocaleDateString("es")} a las ${h}:00`}
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
          const top = (minutes / 60) * ROW_HEIGHT;
          const height = (a.duration / 60) * ROW_HEIGHT;
          const started = start <= now;
          const isNoShow = a.status === "no-show";
          const isCompleted = a.status === "completed";
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelected(a)}
              className={cn(
                "absolute left-1 right-1 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left text-[11px] shadow-sm transition-transform hover:-translate-y-0.5 hover:shadow-md",
                isNoShow && "border-dashed opacity-70",
                isCompleted && "opacity-80",
                started && a.status === "confirmed" && "ring-1 ring-primary/40",
              )}
              style={{
                top,
                height: Math.max(30, height - 2),
                background: `color-mix(in oklch, var(${emp.colorVar}) 18%, var(--color-card))`,
                borderLeftColor: `var(${emp.colorVar})`,
              }}
            >
              <p className="truncate font-medium leading-tight text-foreground">{a.clientName}</p>
              <p className="truncate text-muted-foreground">{serviceLabelOf(a)}</p>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display text-lg">{capitalizar(fechaLarga(anchor))}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => shift(-1)} aria-label="Día anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const d = new Date();
              d.setHours(0, 0, 0, 0);
              setAnchor(d);
            }}
          >
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)} aria-label="Día siguiente">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tira de la semana — salta de día sin perder el contexto de en qué
          semana estás, igual en móvil que en escritorio. */}
      <TiraScroll>
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
      </TiraScroll>

      {/* Selector de profesional — solo móvil, y solo si hay entre quién elegir. */}
      <div className={cn("md:hidden", soloUno && "hidden")}>
        <Select value={mobileEmployee} onValueChange={(v) => setMobileEmployee(v as EmployeeId)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card">
        {/* Cabecera con foto/iniciales por profesional — oculta en móvil, ya
            se elige arriba con el selector. */}
        <div
          className={cn("hidden border-b border-border/60", !soloUno && "md:grid")}
          style={{ gridTemplateColumns: `56px repeat(${employees.length}, minmax(0, 1fr))` }}
        >
          <div />
          {employees.map((e) => (
            <div
              key={e.id}
              className="flex flex-col items-center gap-1.5 border-l border-border/60 px-2 py-3"
            >
              <StylistAvatar name={e.name} employeeId={e.id} size="sm" />
              <span className="truncate text-xs font-medium">{e.name}</span>
            </div>
          ))}
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[320px]">
            {/* Escritorio/iPad: todas las columnas. Móvil: solo la elegida. */}
            <div
              className="relative hidden md:grid"
              style={{ gridTemplateColumns: `56px repeat(${employees.length}, minmax(0, 1fr))` }}
            >
              <div className="border-r border-border/60">
                {HOURS.map((h) => (
                  <div key={h} className="h-16 px-2 pt-1 text-[10px] text-muted-foreground">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {employees.map((e) => (
                <Column key={e.id} employeeId={e.id} />
              ))}
            </div>

            <div className="relative grid md:hidden" style={{ gridTemplateColumns: "56px 1fr" }}>
              <div className="border-r border-border/60">
                {HOURS.map((h) => (
                  <div key={h} className="h-16 px-2 pt-1 text-[10px] text-muted-foreground">
                    {String(h).padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {mobileEmployee && <Column employeeId={mobileEmployee} />}
            </div>
          </div>
        </div>
      </div>

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
