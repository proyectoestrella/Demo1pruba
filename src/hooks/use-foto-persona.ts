import { useEffect } from "react";
import { claveFoto, type TipoFoto } from "@/lib/fotos-personas";
import { useFotosStore } from "@/lib/fotos-personas-cliente";

/** URL de la foto activa de una persona (o null), cargando las del salón la primera vez. */
export function useFotoActiva(tipo: TipoFoto, id: string | undefined): string | null {
  const asegurar = useFotosStore((s) => s.asegurar);
  const url = useFotosStore((s) => (id ? s.activas[claveFoto(tipo, id)] : undefined)) ?? null;
  useEffect(() => { asegurar(); }, [asegurar]);
  return url;
}

/** ¿Está disponible el almacén de fotos? (SQL aplicado o demo). */
export function useFotosDisponibles(): boolean {
  const asegurar = useFotosStore((s) => s.asegurar);
  const ok = useFotosStore((s) => s.estado === "listo");
  useEffect(() => { asegurar(); }, [asegurar]);
  return ok;
}
