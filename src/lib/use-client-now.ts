import { useEffect, useState } from "react";

/**
 * La hora del navegador, y solo del navegador.
 *
 * Todo lo que depende de "qué hora es" (la píldora "Abierto · cierra a las
 * 20:00") no puede calcularse en el servidor: Vercel va en UTC, así que a las
 * 9 de la mañana en Madrid el servidor cree que aún es la noche anterior y
 * pinta "Cerrado hoy". Y la hidratación no lo corrige: el texto del servidor se
 * queda. Se devuelve `null` hasta que el componente monta en el cliente, y a
 * partir de ahí se refresca cada minuto, para que la píldora cambie sola a
 * "Abierto" a la hora de apertura mientras se enseña la demo.
 */
export function useClientNow(refreshMs = 60_000): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), refreshMs);
    return () => clearInterval(id);
  }, [refreshMs]);
  return now;
}
