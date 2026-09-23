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
import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { accesoAlPanel } from "@/lib/api/salons.functions";

type Estado = "comprobando" | "adelante" | "fuera";

export function GuardiaDelPanel({ slug, children }: { slug?: string; children: ReactNode }) {
  const navigate = useNavigate();
  // Empieza SIEMPRE comprobando, también al pintar la página en el servidor.
  // Así no existe ni un instante en el que el panel esté en pantalla sin que
  // se haya comprobado nada.
  const [estado, setEstado] = useState<Estado>("comprobando");

  useEffect(() => {
    // Sin salón no hay nada que proteger: es el panel de ejemplo de siempre.
    if (!slug) {
      setEstado("adelante");
      return;
    }
    let vivo = true;
    accesoAlPanel({ data: { slug } })
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-6 text-center">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        {estado === "fuera" ? "Llevándote a la pantalla de acceso…" : "Comprobando tu acceso…"}
      </p>
    </div>
  );
}
