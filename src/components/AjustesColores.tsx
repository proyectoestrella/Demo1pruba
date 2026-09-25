import { guardarPerfil } from "@/lib/deshacer-maqueta";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { indiceColorServicio } from "@/lib/hoy-arena";
import { colorElegidoProfesional } from "@/lib/colores-elegidos";
import { cn } from "@/lib/utils";

/**
 * Colores del calendario elegidos por la dueña (9h): uno de los seis de la
 * paleta por servicio y uno de los cuatro pasteles por profesional (se ven en
 * la Semana con «Todas»). Se guarda al pulsar.
 */
export function AjustesColores() {
  const services = useSalonStore((s) => s.services);
  const coloresServicio = useSalonStore((s) => s.salonProfile.coloresServicio);
  const coloresProfesional = useSalonStore((s) => s.salonProfile.coloresProfesional);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const equipo = useEquipo();
  const activos = services.filter((s) => s.active !== false);
  const muestra = (sel: boolean) =>
    cn("grid size-8 place-items-center rounded-lg border transition-transform", sel ? "scale-110 border-2 border-cafe" : "border-cafe/40 hover:scale-105");

  return (
    <>
      <div className="space-y-3 border-t border-lino pt-5 first:border-t-0 first:pt-0">
        <h3 className="text-[15px] font-extrabold">Servicios</h3>
        <ul className="space-y-2.5">
          {activos.map((s) => {
            const actual = indiceColorServicio(s.id, services);
            return (
              <li key={s.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[160px] flex-1 text-[14px] font-semibold">{s.name}</span>
                <span role="radiogroup" aria-label={`Color de ${s.name}`} className="flex gap-1.5">
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={actual === n}
                      aria-label={`Color ${n}`}
                      onClick={() => guardarPerfil({ coloresServicio: { ...coloresServicio, [s.id]: n } })}
                      className={muestra(actual === n)}
                      style={{ background: `var(--serv-${n})` }}
                    />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="space-y-3 border-t border-lino pt-5">
        <h3 className="text-[15px] font-extrabold">Profesionales</h3>
        <p className="-mt-2 text-sm text-muted-foreground">Se ven en la Semana del calendario con «Todas».</p>
        <ul className="space-y-2.5">
          {equipo.map((e, i) => {
            const actual = colorElegidoProfesional(e.id) ?? (i % 4) + 1;
            return (
              <li key={e.id} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[160px] flex-1 text-[14px] font-semibold">{e.name}</span>
                <span role="radiogroup" aria-label={`Color de ${e.name}`} className="flex gap-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={actual === n}
                      aria-label={`Color ${n}`}
                      onClick={() => guardarPerfil({ coloresProfesional: { ...coloresProfesional, [e.id]: n } })}
                      className={muestra(actual === n)}
                      style={{ background: `var(--pro-${n})` }}
                    />
                  ))}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}
