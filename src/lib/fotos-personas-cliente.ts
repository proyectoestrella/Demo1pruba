/**
 * Fotos reales de personas en el navegador: un almacén con las fotos activas
 * (cacheadas ~50 min, la URL firmada dura 60) y dos proveedores:
 *  - servidor: salón real, Supabase Storage vía funciones de servidor;
 *  - local: demo, fotos en memoria de la pestaña (objectURL), para probarlo.
 * Sin SQL aplicado el servidor responde `disponible: false` y los botones no salen.
 */
import { create } from "zustand";
import { useSalonStore } from "./store";
import { CACHE_URL_MS, base64DeBytes, claveFoto, type TipoFoto } from "./fotos-personas";

export interface FotoItem { id: string; creado: string; activa: boolean; url: string }
export type RespuestaFotos<T> = ({ disponible: true } & T) | { disponible: false };

export interface ProveedorFotos {
  cargarActivas: () => Promise<RespuestaFotos<{ fotos: Record<string, string> }>>;
  listar: (tipo: TipoFoto, id: string) => Promise<RespuestaFotos<{ fotos: FotoItem[] }>>;
  subir: (tipo: TipoFoto, id: string, blob: Blob) => Promise<RespuestaFotos<{ foto: FotoItem }>>;
  activar: (tipo: TipoFoto, id: string, fotoId: string) => Promise<RespuestaFotos<{ foto: FotoItem }>>;
  quitar: (tipo: TipoFoto, id: string) => Promise<RespuestaFotos<object>>;
}

/* ---------------------------- proveedor local (demo) ---------------------------- */
const local = new Map<string, FotoItem[]>();
let contador = 0;
export const proveedorLocal: ProveedorFotos = {
  cargarActivas: async () => {
    const fotos: Record<string, string> = {};
    for (const [k, v] of local) { const a = v.find((f) => f.activa); if (a) fotos[k] = a.url; }
    return { disponible: true, fotos };
  },
  listar: async (tipo, id) => ({ disponible: true, fotos: [...(local.get(claveFoto(tipo, id)) ?? [])] }),
  subir: async (tipo, id, blob) => {
    const k = claveFoto(tipo, id);
    const lista = (local.get(k) ?? []).map((f) => ({ ...f, activa: false }));
    const foto: FotoItem = { id: `local-${++contador}`, creado: new Date().toISOString(), activa: true, url: URL.createObjectURL(blob) };
    local.set(k, [foto, ...lista]);
    return { disponible: true, foto };
  },
  activar: async (tipo, id, fotoId) => {
    const k = claveFoto(tipo, id);
    const lista = (local.get(k) ?? []).map((f) => ({ ...f, activa: f.id === fotoId }));
    local.set(k, lista);
    const foto = lista.find((f) => f.id === fotoId);
    if (!foto) throw new Error("Esa foto ya no está.");
    return { disponible: true, foto };
  },
  quitar: async (tipo, id) => {
    const k = claveFoto(tipo, id);
    local.set(k, (local.get(k) ?? []).map((f) => ({ ...f, activa: false })));
    return { disponible: true };
  },
};
export function vaciarFotosLocales() { local.clear(); }

/* -------------------------- proveedor de servidor (real) ------------------------- */
export function proveedorServidor(slug: string): ProveedorFotos {
  const api = () => import("./api/fotos-personas.functions");
  return {
    cargarActivas: async () => (await api()).fotosActivasDelSalon({ data: { slug } }) as Promise<RespuestaFotos<{ fotos: Record<string, string> }>>,
    listar: async (tipo, personaId) => (await api()).listarFotosDePersona({ data: { slug, tipo, personaId } }) as Promise<RespuestaFotos<{ fotos: FotoItem[] }>>,
    subir: async (tipo, personaId, blob) => {
      const datos = base64DeBytes(new Uint8Array(await blob.arrayBuffer()));
      return (await api()).subirFotoDePersona({ data: { slug, tipo, personaId, datos } }) as Promise<RespuestaFotos<{ foto: FotoItem }>>;
    },
    activar: async (tipo, personaId, fotoId) => (await api()).activarFotoDePersona({ data: { slug, tipo, personaId, fotoId } }) as Promise<RespuestaFotos<{ foto: FotoItem }>>,
    quitar: async (tipo, personaId) => (await api()).quitarFotoDePersona({ data: { slug, tipo, personaId } }) as Promise<RespuestaFotos<object>>,
  };
}

export function proveedorActual(): ProveedorFotos {
  const slug = useSalonStore.getState().realSalonSlug;
  return slug ? proveedorServidor(slug) : proveedorLocal;
}

/* ---------------------------------- almacén ---------------------------------- */
interface Estado {
  estado: "sin-cargar" | "cargando" | "listo" | "no-disponible";
  /** Salón/demo para el que se cargó (si cambia, se vuelve a cargar). */
  origen: string | null;
  cargadoEn: number;
  activas: Record<string, string>;
  asegurar: () => void;
  poner: (tipo: TipoFoto, id: string, url: string | null) => void;
  reiniciar: () => void;
}

export const useFotosStore = create<Estado>((set, get) => ({
  estado: "sin-cargar",
  origen: null,
  cargadoEn: 0,
  activas: {},
  asegurar: () => {
    const origen = useSalonStore.getState().realSalonSlug ?? "demo";
    const s = get();
    const mismo = s.origen === origen;
    // En la demo las URLs son locales y no caducan.
    const fresca = s.estado === "listo" && (origen === "demo" || Date.now() - s.cargadoEn < CACHE_URL_MS);
    if (mismo && (s.estado === "cargando" || s.estado === "no-disponible" || fresca)) return;
    set({ estado: "cargando", origen });
    proveedorActual().cargarActivas().then(
      (r) => {
        if (get().origen !== origen) return;
        if (!r.disponible) set({ estado: "no-disponible", activas: {} });
        else set({ estado: "listo", activas: r.fotos, cargadoEn: Date.now() });
      },
      // Un fallo de red no apaga la función: se reintentará al siguiente montaje.
      () => { if (get().origen === origen) set({ estado: "sin-cargar" }); },
    );
  },
  poner: (tipo, id, url) => set((s) => {
    const activas = { ...s.activas };
    if (url) activas[claveFoto(tipo, id)] = url; else delete activas[claveFoto(tipo, id)];
    return { activas, estado: s.estado === "no-disponible" ? s.estado : "listo", cargadoEn: s.cargadoEn || Date.now() };
  }),
  reiniciar: () => set({ estado: "sin-cargar", origen: null, cargadoEn: 0, activas: {} }),
}));
