import { useSyncExternalStore } from "react";
import { AlertTriangle, RotateCw, X } from "lucide-react";

import {
  descartarAviso,
  leerAvisos,
  leerAvisosEnServidor,
  suscribirAvisos,
  type AvisoSync,
} from "@/lib/avisos-sync";
import { Button } from "@/components/ui/button";

/**
 * La franja que le dice al dueño que algo NO se ha guardado.
 *
 * Antes, un fallo de red al subir una cita o el perfil acababa solo en la
 * consola del navegador: el cambio se veía en pantalla, parecía hecho, y no lo
 * estaba. Esta franja es lo único que rompe ese silencio, así que se monta en
 * la raíz de la aplicación y sale por encima de todo.
 *
 * Reglas del texto: en español, en llano, sin nombres de tecnologías ni
 * códigos de error. El dueño no tiene que saber qué es Supabase.
 */
export function AvisosDeSincronizacion() {
  const avisos = useSyncExternalStore(suscribirAvisos, leerAvisos, leerAvisosEnServidor);
  if (avisos.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col gap-2 p-3 sm:p-4"
      role="status"
      aria-live="polite"
    >
      {avisos.map((aviso) => (
        <Fila key={aviso.id} aviso={aviso} />
      ))}
    </div>
  );
}

function Fila({ aviso }: { aviso: AvisoSync }) {
  return (
    <div className="pointer-events-auto mx-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950 shadow-lg dark:border-amber-700 dark:bg-amber-950 dark:text-amber-50">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
      <p className="flex-1 text-sm leading-snug">{aviso.mensaje}</p>
      {aviso.reintentar ? (
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 border-amber-400 bg-white/70 text-amber-950 hover:bg-white dark:bg-transparent dark:text-amber-50"
          onClick={() => {
            // Se descarta al reintentar: si vuelve a fallar, el propio fallo
            // registra el aviso otra vez. Así el dueño ve que ha pasado algo.
            descartarAviso(aviso.id);
            aviso.reintentar?.();
          }}
        >
          <RotateCw className="mr-1 h-4 w-4" aria-hidden />
          Reintentar
        </Button>
      ) : null}
      <button
        type="button"
        aria-label="Cerrar aviso"
        className="shrink-0 rounded p-1 opacity-70 hover:opacity-100"
        onClick={() => descartarAviso(aviso.id)}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
