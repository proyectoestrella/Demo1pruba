import { createFileRoute } from "@tanstack/react-router";
import { employees } from "@/lib/mock/salon";
import { PageHeader } from "@/components/PageHeader";
import { StylistAvatar } from "@/components/StylistAvatar";

export const Route = createFileRoute("/app/employees")({ component: Team });

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

function Team() {
  return (
    <div className="space-y-6">
      <PageHeader title="Equipo" description="Horarios, especialidades y disponibilidad." />
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {employees.map((e) => (
          <div key={e.id} className="overflow-hidden rounded-xl border border-border/60 bg-card">
            <div className="flex items-center gap-4 p-5">
              <StylistAvatar name={e.name} employeeId={e.id} size="lg" />
              <div className="min-w-0">
                <h3 className="truncate font-display text-xl">{e.name}</h3>
                <p className="text-xs text-muted-foreground">{e.specialty}</p>
                <p className="mt-1 text-xs text-muted-foreground">{e.yearsExperience} años de experiencia</p>
              </div>
            </div>
            <div className="border-t border-border/60 p-5">
              <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Horario</p>
              <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                {e.schedule.map((s, i) => (
                  <div key={i} className="rounded-md border border-border/60 bg-background p-1.5">
                    <p className="text-muted-foreground">{DAYS[i]}</p>
                    <p className="mt-0.5 font-medium">{s ? `${s.start}–${s.end}` : "—"}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
