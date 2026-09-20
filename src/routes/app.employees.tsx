import { createFileRoute } from "@tanstack/react-router";
import { useSalonStore } from "@/lib/store";
import { serviceMap } from "@/lib/mock/salon";
import { useEquipo } from "@/lib/use-equipo";
import { useRealSalonSlug } from "@/lib/use-real-salon";
import { useBusinessType } from "@/lib/use-display-profile";
import { fotoDeProfesional } from "@/lib/business-type";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { PageHeader } from "@/components/PageHeader";
import { StylistAvatar } from "@/components/StylistAvatar";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/app/employees")({ component: Team });

const DAYS = ["D", "L", "M", "X", "J", "V", "S"];

/**
 * Servicios que este profesional ha realizado de verdad, según el
 * historial de citas — no hay un catálogo de "servicios por empleado" en
 * el modelo, así que se deriva de datos reales en vez de inventarlo.
 */
function topServicesFor(
  appointments: ReturnType<typeof useSalonStore.getState>["appointments"],
  employeeId: string,
) {
  const counts = new Map<string, number>();
  for (const a of appointments) {
    if (a.employeeId !== employeeId || a.status === "cancelled") continue;
    for (const id of a.serviceIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => serviceMap[id]?.name)
    .filter((n): n is string => !!n);
}

function Team() {
  const appointments = useSalonStore((s) => s.appointments);
  const today = new Date().getDay();
  const employees = useEquipo();
  const tipo = useBusinessType();
  const salonSlug = useSalonStore((s) => s.salonProfile.slug);
  const esSalonReal = useRealSalonSlug() === salonSlug;
  // Trabajar solo no borra esta pantalla: el día que contrate a alguien tiene
  // que poder darlo de alta aquí. Lo que cambia es que deja de presentarse
  // como "el equipo" y dice lo que hay.
  const soloUno = esSoloUnProfesional(employees);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Equipo"
        description={
          soloUno
            ? "Ahora mismo trabajas tú solo. Este es tu horario y tus servicios; cuando contrates a alguien, aquí aparecerá su ficha."
            : "Horarios, especialidades y disponibilidad."
        }
      />
      <div
        className={cn(
          "mx-auto grid gap-5",
          soloUno ? "max-w-md" : "max-w-5xl sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {employees.map((e) => {
          const todaySlot = e.schedule[today];
          const services = topServicesFor(appointments, e.id);
          return (
            <div
              key={e.id}
              className="flex flex-col items-center overflow-hidden rounded-2xl border border-border/60 bg-card p-6 text-center shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="relative">
                <StylistAvatar
                  name={e.name}
                  employeeId={e.id}
                  photo={fotoDeProfesional(e.name, e.id, e.photo, tipo, esSalonReal)}
                  size="xl"
                />
                <span
                  className={cn(
                    "absolute bottom-1 right-1 size-4 rounded-full border-2 border-card",
                    todaySlot ? "bg-success" : "bg-muted-foreground/40",
                  )}
                  aria-hidden="true"
                />
              </div>

              <h3 className="mt-4 font-display text-xl">{e.name}</h3>
              <p className="text-sm text-muted-foreground">{e.specialty}</p>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                <Badge variant="secondary" className="font-normal">
                  {e.yearsExperience} años de experiencia
                </Badge>
              </div>

              <div
                className={cn(
                  "mt-3 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium",
                  todaySlot ? "bg-success/15 text-success" : "bg-muted text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    todaySlot ? "bg-success" : "bg-muted-foreground",
                  )}
                  aria-hidden="true"
                />
                {todaySlot
                  ? `Disponible hoy · ${String(todaySlot.start).padStart(2, "0")}:00–${String(todaySlot.end).padStart(2, "0")}:00`
                  : "Hoy no trabaja"}
              </div>

              {services.length > 0 && (
                <div className="mt-4 w-full">
                  <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    Servicios que hace
                  </p>
                  <div className="mt-1.5 flex flex-wrap justify-center gap-1.5">
                    {services.slice(0, 4).map((name) => (
                      <span
                        key={name}
                        className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-foreground"
                      >
                        {name}
                      </span>
                    ))}
                    {services.length > 4 && (
                      <span className="rounded-full border border-border/60 bg-background px-2.5 py-1 text-[11px] text-muted-foreground">
                        +{services.length - 4} más
                      </span>
                    )}
                  </div>
                </div>
              )}

              <div className="mt-5 w-full border-t border-border/60 pt-4">
                <p className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  Horario
                </p>
                <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                  {e.schedule.map((s, i) => (
                    <div
                      key={i}
                      className={cn(
                        "rounded-md border p-1.5",
                        i === today
                          ? "border-primary/50 bg-primary/10"
                          : "border-border/60 bg-background",
                        !s && "opacity-50",
                      )}
                    >
                      <p
                        className={cn(
                          "text-muted-foreground",
                          i === today && "font-medium text-primary",
                        )}
                      >
                        {DAYS[i]}
                      </p>
                      <p className="mt-0.5 font-medium leading-tight">
                        {s ? `${s.start}–${s.end}` : "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
