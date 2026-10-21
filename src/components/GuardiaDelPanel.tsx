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
 * Si falla la comprobación, se vuelve al acceso: no se muestra la copia
 * local que pudiera conservar ese dispositivo. El servidor vuelve a exigir
 * sesión y pertenencia en cada operación protegida.
 */
import { IconoSiShow } from "@/components/MarcaSiShow";
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { accesoPanel, permitidoEnRuta, salirPorRevocacion } from "@/lib/acceso-actual-panel";
import { precargarDatosDelSalon, precargarPerfilDelSalon } from "@/lib/precarga-salon";
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
  const pathname = useRouterState({ select: s => s.location.pathname });
  const demoRaw = useRouterState({ select: (s) => (s.location.search as Record<string, unknown>)?.[DEMO_PARAM] });
  const demo = decodeDemoProfile(typeof demoRaw === "string" ? demoRaw : undefined);
  // Empieza SIEMPRE comprobando, también al pintar la página en el servidor.
  // Así no existe ni un instante en el que el panel esté en pantalla sin que
  // se haya comprobado nada.
  const [estado, setEstado] = useState<Estado>(estadoInicialGuardia);

  useEffect(() => {
    // Sin salón no hay nada que proteger: es el panel de ejemplo de siempre.
    if (!slug) {
      setEstado("adelante");
      return;
    }
    let vivo = true;
    // El perfil es público: se pide a la vez que el acceso, no después.
    precargarPerfilDelSalon(slug);
    // Rendimiento (21-oct): misma caché que el `beforeLoad`; al navegar no
    // hay viaje de red, la pantalla se decide con la membresía ya cargada.
    accesoPanel
      .obtener(slug, () => salirPorRevocacion(slug))
      .then((acc) => {
        if (!vivo) return;
        if (acc.real && !acc.permitido) { setEstado("fuera"); return; }
        if (!permitidoEnRuta(acc, pathname) && pathname !== "/app") {
          void navigate({ to: "/app", search: { s: slug }, replace: true });
          return;
        }
        // Salón real con acceso: la agenda se empieza a pedir ya, sin
        // esperar a que React monte el panel (un viaje menos en serie).
        if (acc.real) precargarDatosDelSalon(slug);
        setEstado("adelante");
      })
      .catch((err) => {
        console.error("No se pudo comprobar el acceso al panel:", err);
        if (vivo) setEstado("fuera");
      });
    return () => {
      vivo = false;
    };
  }, [slug, pathname, navigate]);

  useEffect(() => {
    if (estado !== "fuera") return;
    void navigate({ to: "/login", search: { s: slug }, replace: true });
  }, [estado, navigate, slug]);

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
