/**
 * La puerta del panel.
 *
 * Mientras no se sabe quién está entrando, aquí NO se pinta el panel. Ni el
 * armazón, ni un número, ni el nombre de nadie. Se ve una pantalla de espera
 * de dos líneas y ya está.
 *
 * Eso es adrede y es la mitad del arreglo: si el panel se pintara primero y se
 * redirigiera después, durante ese instante habría datos en pantalla —y en el
 * código fuente de la página— de alguien que no debería verlos. "Luego
 * redirijo" no es proteger nada.
 *
 * Y lo que decide es siempre el servidor:
 *
 *   - Salón que no existe en la base de datos → es una DEMO de venta: se
 *     entra directo, sin pedir nada. Esto es intocable.
 *   - Salón de pago y quien entra pertenece a él → adelante.
 *   - Salón de pago y no → a la pantalla de acceso.
 *
 * Si la comprobación no se puede hacer (internet caído, servidor que no
 * responde) se deja pasar a propósito, porque el panel se abriría vacío de
 * todas formas: las funciones que entregan citas y clientes vuelven a
 * comprobar quién llama, cada una por su cuenta. Esta pantalla es la
 * comodidad; la seguridad está detrás.
 */
import { IconoSiShow } from "@/components/MarcaSiShow";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { accesoPanel } from "@/lib/acceso-actual-panel";
import { DEMO_PARAM, decodeDemoProfile } from "@/lib/demo-profile";
import { DemoLoadingScreen } from "@/components/DemoLoadingScreen";

type Estado = "comprobando" | "adelante" | "fuera";

/**
 * El HTML del servidor no comparte la caché de acceso del navegador. Por eso
 * el primer render debe ser siempre el mismo en ambos lados; la caché se
 * consulta después, dentro del efecto que resuelve el acceso.
 */
export function estadoInicialGuardia(): Estado {
  return "comprobando";
}

export function GuardiaDelPanel({ slug, children }: { slug?: string; children: ReactNode }) {
  const navigate = useNavigate();
  const demoRaw = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM] });
  const demo = decodeDemoProfile(typeof demoRaw === "string" ? demoRaw : undefined);
  // Empieza SIEMPRE comprobando, también al pintar la página en el servidor.
  // Así no existe ni un instante en el que el panel esté en pantalla sin que
  // se haya comprobado nada.
  // La caché de `beforeLoad` se reutiliza en el efecto mediante `obtener`,
  // pero nunca durante el render: en SSR estaría vacía y React recibiría un
  // árbol inicial distinto al del navegador.
  const [estado, setEstado] = useState<Estado>(estadoInicialGuardia);

  useEffect(() => {
    // Sin salón no hay nada que proteger: es el panel de ejemplo de siempre.
    if (!slug) {
      setEstado("adelante");
      return;
    }
    let vivo = true;
    accesoPanel
      .obtener(slug)
      .then(({ real, permitido }) => {
        if (!vivo) return;
        setEstado(!real || permitido ? "adelante" : "fuera");
      })
      .catch((err) => {
        console.error("No se pudo comprobar el acceso al panel:", err);
        if (vivo) setEstado("adelante");
      });
    return () => {
      vivo = false;
    };
  }, [slug]);

  useEffect(() => {
    if (estado !== "fuera") return;
    void navigate({ to: "/login", replace: true });
  }, [estado, navigate]);

  if (estado === "adelante") return <>{children}</>;

  // El panel abierto desde una demo usa exactamente la misma bienvenida que
  // la web pública: no revela el armazón genérico mientras se resuelve.
  if (demo) {
    return <DemoLoadingScreen conEnlaceDemo nombre={demo.name ?? "Tu salón"} logoUrl={null} portadaLista={false} tienePortada />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <IconoSiShow size={64} />
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {estado === "fuera" ? "Llevándote a la pantalla de acceso…" : "Comprobando tu acceso…"}
      </p>
    </div>
  );
}
