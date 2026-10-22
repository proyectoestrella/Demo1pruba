import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Image as ImagenIcono, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { comprimirFoto, ErrorFoto } from "@/lib/fotos-compresion";
import { proveedorActual, useFotosStore, type FotoItem } from "@/lib/fotos-personas-cliente";
import { useFotoActiva } from "@/hooks/use-foto-persona";
import type { TipoFoto } from "@/lib/fotos-personas";

/**
 * Foto real de una clienta o de una profesional: subir (cámara o galería) con
 * vista previa, volver a poner una anterior o volver al avatar dibujado.
 * Va aparte del selector de avatar dibujado, que tiene su propio diseño.
 */
export function GestorFotoPersona({ abierto, onOpenChange, tipo, id, nombre, elegido }: {
  abierto: boolean;
  onOpenChange: (abierto: boolean) => void;
  tipo: TipoFoto;
  id: string;
  nombre: string;
  elegido?: unknown;
}) {
  const activa = useFotoActiva(tipo, id);
  const poner = useFotosStore((s) => s.poner);
  const [historial, setHistorial] = useState<FotoItem[]>([]);
  const [nueva, setNueva] = useState<{ blob: Blob; url: string } | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const camara = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);

  const cargar = useCallback(async () => {
    try {
      const r = await proveedorActual().listar(tipo, id);
      if (r.disponible) setHistorial(r.fotos);
    } catch { /* el historial es un extra: sin él se puede subir igualmente */ }
  }, [tipo, id]);

  useEffect(() => {
    if (!abierto) return;
    setError(null);
    void cargar();
  }, [abierto, cargar]);
  useEffect(() => () => { if (nueva) URL.revokeObjectURL(nueva.url); }, [nueva]);

  async function alElegir(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setTrabajando(true);
    try {
      const c = await comprimirFoto(archivo);
      setNueva({ blob: c.blob, url: URL.createObjectURL(c.blob) });
    } catch (e) {
      setError(e instanceof ErrorFoto ? e.message : "No se pudo preparar la foto. Prueba con otra.");
    } finally { setTrabajando(false); }
  }

  async function ejecutar(accion: () => Promise<void>) {
    setError(null);
    setTrabajando(true);
    try { await accion(); }
    catch (e) { setError(e instanceof Error && e.message ? e.message : "No se pudo guardar. Inténtalo de nuevo."); }
    finally { setTrabajando(false); }
  }

  const guardar = () => ejecutar(async () => {
    if (!nueva) return;
    const r = await proveedorActual().subir(tipo, id, nueva.blob);
    if (!r.disponible) throw new Error("Disponible pronto.");
    poner(tipo, id, r.foto.url);
    setNueva(null);
    await cargar();
  });
  const volverA = (f: FotoItem) => ejecutar(async () => {
    const r = await proveedorActual().activar(tipo, id, f.id);
    if (!r.disponible) throw new Error("Disponible pronto.");
    poner(tipo, id, r.foto.url);
    await cargar();
  });
  const alDibujado = () => ejecutar(async () => {
    await proveedorActual().quitar(tipo, id);
    poner(tipo, id, null);
    await cargar();
  });

  const anteriores = historial.filter((f) => !f.activa);
  const idArchivo = `foto-${tipo}-${id}`;

  return (
    <Dialog open={abierto} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] max-w-[480px] flex-col gap-0 overflow-hidden bg-card p-0" data-testid="gestor-foto">
        <DialogHeader className="shrink-0 px-5 pt-6 pb-4 text-left">
          <DialogTitle className="pr-7 text-xl font-bold">Foto de {nombre}</DialogTitle>
          <DialogDescription>Sustituye el avatar por una foto real. Se queda hasta que la cambies, y las anteriores se pueden recuperar.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
          <div className="mb-4 flex items-center gap-4 rounded-2xl bg-nata/60 p-4">
            {nueva
              ? <img src={nueva.url} alt={`Vista previa de la foto de ${nombre}`} data-testid="foto-vista-previa" className="size-20 shrink-0 rounded-full object-cover" />
              : <Avatar nombre={nombre} id={id} foto={activa} elegido={elegido} size={80} decorativo={false} inicialesPorDefecto={tipo === "clienta"} />}
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {nueva ? "Así se verá. Si te gusta, guárdala." : activa ? "Esta es la foto actual." : "Ahora se ve el avatar dibujado."}
            </p>
          </div>

          <input ref={camara} id={`${idArchivo}-camara`} type="file" accept="image/*" capture="user" className="sr-only" tabIndex={-1} aria-hidden="true"
            data-testid="foto-input-camara" onChange={(e) => { void alElegir(e.target.files?.[0]); e.target.value = ""; }} />
          <input ref={galeria} id={`${idArchivo}-galeria`} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true"
            data-testid="foto-input-galeria" onChange={(e) => { void alElegir(e.target.files?.[0]); e.target.value = ""; }} />

          {nueva ? (
            <div className="flex flex-wrap gap-2">
              <Button type="button" className="min-h-11 flex-1" disabled={trabajando} onClick={guardar}>{trabajando ? "Guardando…" : "Guardar foto"}</Button>
              <Button type="button" variant="ghost" className="min-h-11" disabled={trabajando} onClick={() => setNueva(null)}>Descartar</Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button type="button" variant="outline" className="min-h-11" disabled={trabajando} onClick={() => camara.current?.click()}><Camera className="size-4" aria-hidden="true" />Hacer foto</Button>
              <Button type="button" variant="outline" className="min-h-11" disabled={trabajando} onClick={() => galeria.current?.click()}><ImagenIcono className="size-4" aria-hidden="true" />Elegir de la galería</Button>
            </div>
          )}

          {error && <p role="alert" data-testid="foto-error" className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}

          {anteriores.length > 0 && !nueva && (
            <section className="mt-5" aria-labelledby={`${idArchivo}-ant`}>
              <h3 id={`${idArchivo}-ant`} className="mb-2 text-sm font-bold">Fotos anteriores</h3>
              <ul className="grid grid-cols-4 gap-2">
                {anteriores.map((f, i) => (
                  <li key={f.id}>
                    <button type="button" disabled={trabajando} data-testid="foto-anterior" aria-label={`Volver a poner la foto ${i + 1} de ${anteriores.length}`}
                      onClick={() => volverA(f)}
                      className={cn("block aspect-square min-h-11 w-full overflow-hidden rounded-full bg-nata ring-offset-2 transition hover:ring-2 hover:ring-cafe/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-50")}>
                      <img src={f.url} alt="" draggable={false} className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {activa && !nueva && (
            <Button type="button" variant="ghost" className="mt-4 min-h-11 w-full justify-start" disabled={trabajando} onClick={alDibujado}>
              <Undo2 className="size-4" aria-hidden="true" />Volver al avatar dibujado
            </Button>
          )}
        </div>
        <div className="flex shrink-0 justify-end bg-nata/50 px-5 py-4">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
