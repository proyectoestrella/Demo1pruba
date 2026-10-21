import { useEffect, useState } from "react";
import { getSalonProfile } from "./api/salons.functions";
import { perfilInicialDeAcceso, type PerfilIdentidadAcceso } from "./identidad-acceso";
import { useSalonStore } from "./store";

/** Identidad pública del salón, sin cargar agenda, clientes ni permisos. */
export function useIdentidadAcceso(slug: string | undefined): PerfilIdentidadAcceso {
  const guardado = useSalonStore((s) => s.salonProfile);
  const [remoto, setRemoto] = useState<{ slug: string; perfil: PerfilIdentidadAcceso } | null>(
    null,
  );

  useEffect(() => {
    if (!slug) return;
    let vivo = true;
    getSalonProfile({ data: { slug } })
      .then(({ profile }) => {
        if (vivo && profile) setRemoto({ slug, perfil: profile });
      })
      // La demo registrada o la identidad neutra siguen siendo preferibles a
      // enseñar el salón que hubiera guardado de una visita anterior.
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [slug]);

  return remoto?.slug === slug ? remoto.perfil : perfilInicialDeAcceso(slug, guardado);
}
