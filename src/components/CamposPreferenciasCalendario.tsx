import { useSalonStore } from "@/lib/store";
import { PRIMEROS_DIAS, VISTAS_CALENDARIO, preferenciasDe, type PrimerDia, type VistaCalendario } from "@/lib/preferencias-calendario";

/**
 * Vista predeterminada, primer día de la semana y horas visibles del
 * calendario. Se guardan en el perfil del salón al cambiarlas; el mismo
 * formulario sale en el engranaje del calendario y en Ajustes.
 */
export function CamposPreferenciasCalendario() {
  const guardadas = useSalonStore((s) => s.salonProfile.calendario);
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const pref = preferenciasDe(guardadas);
  const guardar = (cambio: Partial<typeof pref>) => updateSalonProfile({ calendario: preferenciasDe({ ...pref, ...cambio }) });
  const campo = "h-10 w-full rounded-xl border border-input bg-blanco px-3 text-[14px] text-cafe";
  const etiqueta = "mb-1.5 block text-[13px] font-bold text-cafe";
  const horas = Array.from({ length: 25 }, (_, h) => h);
  return (
    <div className="grid gap-4">
      <label>
        <span className={etiqueta}>Vista predeterminada</span>
        <select className={campo} value={pref.vista} onChange={(e) => guardar({ vista: e.target.value as VistaCalendario })}>
          {VISTAS_CALENDARIO.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={etiqueta}>Primer día de la semana</span>
        <select className={campo} value={pref.primerDia} onChange={(e) => guardar({ primerDia: Number(e.target.value) as PrimerDia })}>
          {PRIMEROS_DIAS.map((d) => (
            <option key={d.id} value={d.id}>
              {d.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend className={etiqueta}>Horas visibles</legend>
        <div className="flex items-center gap-2">
          <select aria-label="Desde" className={campo} value={pref.desde} onChange={(e) => guardar({ desde: Number(e.target.value) })}>
            {horas.slice(0, 23).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
          <span className="text-[13px] text-cafe-suave">a</span>
          <select aria-label="Hasta" className={campo} value={pref.hasta} onChange={(e) => guardar({ hasta: Number(e.target.value) })}>
            {horas.slice(2).map((h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1.5 text-[12.5px] text-cafe-suave">Si alguna cita cae fuera, el calendario te avisa y puedes ver el día entero.</p>
      </fieldset>
    </div>
  );
}
