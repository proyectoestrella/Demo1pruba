/**
 * Caché de «¿puede esta persona entrar a este panel?» (lote 16).
 *
 * El `beforeLoad` de `/app` se ejecuta en CADA navegación entre pantallas del
 * panel, no solo al entrar. Antes esperaba una ida y vuelta al servidor cada
 * vez: ese era el retraso que se notaba al pulsar cada opción del menú.
 *
 * Ahora la respuesta se guarda por salón y se reutiliza al instante
 * (stale-while-revalidate): la primera entrada sí espera al servidor; las
 * siguientes pintan ya y, si la respuesta tiene más de `FRESCURA_MS`, se
 * vuelve a preguntar en segundo plano. Si esa comprobación de fondo revoca el
 * acceso, `alRevocar` saca a la persona a la pantalla de acceso.
 *
 * La seguridad no depende de esto: cada función de servidor vuelve a
 * comprobar quién llama.
 */
export type AccesoPanel = {
  real: boolean;
  permitido: boolean;
  miembro: unknown;
};

export const FRESCURA_MS = 60_000;

type Entrada<T> = { valor?: T; en: number; enCurso?: Promise<T> };

export function crearCacheAcceso<T extends { real: boolean; permitido: boolean }>(
  preguntar: (slug: string) => Promise<T>,
  ahora: () => number = () => Date.now(),
) {
  const porSalon = new Map<string, Entrada<T>>();

  function pedir(slug: string): Promise<T> {
    const e = porSalon.get(slug) ?? { en: 0 };
    if (e.enCurso) return e.enCurso;
    const p = preguntar(slug).then(
      (valor) => {
        porSalon.set(slug, { valor, en: ahora() });
        return valor;
      },
      (err) => {
        porSalon.set(slug, { ...e, enCurso: undefined });
        throw err;
      },
    );
    porSalon.set(slug, { ...e, enCurso: p });
    return p;
  }

  return {
    /**
     * Devuelve el acceso de `slug`. Con algo guardado, lo devuelve ya
     * (sin esperar) y refresca por detrás si está viejo.
     */
    async obtener(slug: string, alRevocar?: (nuevo: T) => void): Promise<T> {
      const e = porSalon.get(slug);
      if (e?.valor) {
        if (ahora() - e.en > FRESCURA_MS && !e.enCurso) {
          const antes = e.valor;
          pedir(slug)
            .then((nuevo) => {
              const dentroAntes = !antes.real || antes.permitido;
              const dentroAhora = !nuevo.real || nuevo.permitido;
              if (dentroAntes && !dentroAhora) alRevocar?.(nuevo);
            })
            .catch(() => {});
        }
        return e.valor;
      }
      return pedir(slug);
    },
    /** Lo guardado para `slug`, sin preguntar a nadie. */
    guardado(slug: string): T | undefined {
      return porSalon.get(slug)?.valor;
    },
    olvidar() {
      porSalon.clear();
    },
  };
}
