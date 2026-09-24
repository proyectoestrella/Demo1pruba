import { Link } from "@tanstack/react-router";
import { recordatoriosPendientesManana } from "@/lib/hoja-del-dia";
import type { Appointment } from "@/lib/mock/types";

export function RecordatoriosManana({ citas }: { citas: Appointment[] }) {
  const pendientes = recordatoriosPendientesManana(citas, new Date());
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 text-sm">
    <span className="font-medium">{pendientes > 0
      ? `Recordatorios para mañana: ${pendientes} ${pendientes === 1 ? "cita" : "citas"}`
      : "Mañana: todas recordadas ✓"}</span>
    <Link to="/app/hoja" search={{ dia: "manana" }} className="font-medium text-primary underline underline-offset-2">Ver mañana</Link>
  </div>;
}
