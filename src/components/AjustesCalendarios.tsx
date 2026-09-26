import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  filasCalendario,
  NOMBRE_PROVEEDOR,
  pareceContrasenaDeApp,
  type ApiCalendarios,
  type ConexionCalendario,
  type FilaCalendario,
} from "@/lib/calendarios-panel";
import { useMiEmployeeId, usePermisos } from "@/lib/accesos-panel";
import { useEquipo } from "@/lib/use-equipo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const ENLACE_APPLE = "https://account.apple.com/account/manage";
const hace = (iso?: string | null) => {
  if (!iso) return null;
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "ahora mismo";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `hace ${h} h` : new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

/**
 * Ajustes › Calendarios (lote 14c): Google y Apple por salón y por
 * profesional, según docs/contrato-calendarios.md. Recibe las funciones de
 * servidor (`api`); la estilista ve solo la suya («Mi calendario»).
 */
export function AjustesCalendarios({ api, slug }: { api: ApiCalendarios; slug: string }) {
  const permisos = usePermisos();
  const mio = useMiEmployeeId();
  const equipo = useEquipo();
  const [conexiones, setConexiones] = useState<ConexionCalendario[] | null>(null);
  const cargar = useCallback(() => {
    api.listarConexionesCalendario({ slug }).then(setConexiones, () => {
      setConexiones([]);
      toast.error("No se han podido cargar tus calendarios. Inténtalo en un momento.");
    });
  }, [api, slug]);
  useEffect(cargar, [cargar]);

  if (!conexiones) return <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Cargando tus calendarios…</p>;
  const filas = filasCalendario(permisos, mio, equipo, conexiones);
  return (
    <div className="space-y-3">
      <p className="text-[14px] text-cafe-medio">
        Conecta tu Google Calendar o tu calendario de iPhone: lo que tengas apuntado ahí (médico, recoger a los niños) ya no se ofrece como hueco, y tus citas de siShow aparecen en tu calendario.
      </p>
      {filas.map((f) => (
        <FilaConexion key={f.employeeId ?? "salon"} fila={f} api={api} slug={slug} onCambio={cargar} />
      ))}
    </div>
  );
}

function FilaConexion({ fila, api, slug, onCambio }: { fila: FilaCalendario; api: ApiCalendarios; slug: string; onCambio: () => void }) {
  const [apple, setApple] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  async function google() {
    setOcupado(true);
    try {
      const { url } = await api.iniciarConexionGoogle({ slug, employeeId: fila.employeeId });
      window.location.href = url;
    } catch {
      toast.error("No se ha podido abrir Google. Inténtalo en un momento.");
      setOcupado(false);
    }
  }
  const tieneGoogle = fila.conexiones.some((c) => c.proveedor === "google");
  const tieneApple = fila.conexiones.some((c) => c.proveedor === "apple");
  return (
    <section className="rounded-2xl border border-lino bg-card px-4 py-3.5">
      <h4 className="flex items-center gap-2 text-[14.5px] font-extrabold">
        <CalendarCheck className="size-4 text-hoja-tinta" strokeWidth={1.7} aria-hidden="true" /> {fila.titulo}
      </h4>
      <div className="mt-2 space-y-2.5">
        {fila.conexiones.map((c) => (
          <EstadoConexion key={c.id} c={c} api={api} slug={slug} onCambio={onCambio} onReconectar={c.proveedor === "google" ? google : () => setApple(true)} />
        ))}
        {(!tieneGoogle || !tieneApple) && (
          <div className="flex flex-wrap gap-2">
            {!tieneGoogle && (
              <Button variant="outline" className="rounded-full font-bold" disabled={ocupado} onClick={google}>
                {ocupado && <Loader2 className="size-4 animate-spin" />}
                Conectar Google
              </Button>
            )}
            {!tieneApple && !apple && (
              <Button variant="outline" className="rounded-full font-bold" onClick={() => setApple(true)}>
                Conectar Apple (iPhone)
              </Button>
            )}
          </div>
        )}
        {apple && <FormularioApple employeeId={fila.employeeId} api={api} slug={slug} onCerrar={() => setApple(false)} onHecho={onCambio} />}
      </div>
    </section>
  );
}

function EstadoConexion({ c, api, slug, onCambio, onReconectar }: { c: ConexionCalendario; api: ApiCalendarios; slug: string; onCambio: () => void; onReconectar: () => void }) {
  const [bloquear, setBloquear] = useState(c.bloquearHuecos ?? true);
  const [escribir, setEscribir] = useState(c.escribirCitas ?? true);
  const ok = c.estado === "activa";
  async function ajustar(b: boolean, e: boolean) {
    setBloquear(b);
    setEscribir(e);
    try {
      await api.ajustarConexionCalendario({ slug, conexionId: c.id, bloquearHuecos: b, escribirCitas: e });
    } catch {
      setBloquear(c.bloquearHuecos ?? true);
      setEscribir(c.escribirCitas ?? true);
      toast.error("No se ha podido guardar. Inténtalo otra vez.");
    }
  }
  async function desconectar() {
    await api.desconectarCalendario({ slug, conexionId: c.id }).then(
      () => {
        toast.success(`${NOMBRE_PROVEEDOR[c.proveedor]} desconectado. Lo que ya estaba en tu calendario se queda.`);
        onCambio();
      },
      () => toast.error("No se ha podido desconectar. Inténtalo otra vez."),
    );
  }
  const sync = c.ultimaSincronizacion ? `última sincronización ${new Date(c.ultimaSincronizacion).toLocaleString("es-ES", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}` : null;
  return (
    <div className="rounded-xl border border-lino bg-superficie px-3.5 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn("size-2.5 shrink-0 rounded-full", ok ? "bg-hoja" : "bg-melocoton-borde")} aria-hidden="true" />
        <p className="min-w-0 flex-1 text-[14px]">
          {ok ? (
            <>
              <b>Conectado a {NOMBRE_PROVEEDOR[c.proveedor]}</b>
              {c.cuenta ? ` (${c.cuenta})` : ""}
              {c.calendarioNombre ? ` · calendario «${c.calendarioNombre}»` : ""}
            </>
          ) : (
            <>
              <b>{NOMBRE_PROVEEDOR[c.proveedor]}: hubo un problema</b>
              {c.ultimoError ? ` — ${c.ultimoError}` : ""}
            </>
          )}
          {sync && <span className="block text-[12.5px] text-muted-foreground">{sync} · {hace(c.ultimaSincronizacion)}</span>}
        </p>
        {!ok && (
          <Button size="sm" className="rounded-full font-bold" onClick={onReconectar}>
            Reconectar
          </Button>
        )}
        <Button size="sm" variant="ghost" className="rounded-full text-cafe-medio" onClick={desconectar}>
          Desconectar
        </Button>
      </div>
      {ok && (
        <div className="mt-2.5 space-y-2 border-t border-lino pt-2.5">
          <label className="flex items-start gap-3 text-[13.5px]">
            <Switch checked={bloquear} onCheckedChange={(v) => void ajustar(v, escribir)} aria-label="Bloquear huecos cuando tenga algo personal" />
            <span>
              <b className="block">Bloquear huecos cuando tenga algo personal</b>
              <span className="text-cafe-medio">Lo que apuntes en tu calendario no se ofrece en la web ni en «Nueva cita». Aquí se ve como «Ocupado», sin el título.</span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-[13.5px]">
            <Switch checked={escribir} onCheckedChange={(v) => void ajustar(bloquear, v)} aria-label={`Escribir mis citas en ${NOMBRE_PROVEEDOR[c.proveedor]}`} />
            <span>
              <b className="block">Escribir mis citas en {NOMBRE_PROVEEDOR[c.proveedor]}</b>
              <span className="text-cafe-medio">Cada cita de siShow aparece en tu calendario con la clienta y el servicio.</span>
            </span>
          </label>
        </div>
      )}
    </div>
  );
}

function FormularioApple({ employeeId, api, slug, onCerrar, onHecho }: { employeeId: string | null; api: ApiCalendarios; slug: string; onCerrar: () => void; onHecho: () => void }) {
  const [appleId, setAppleId] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valido = /\S+@\S+\.\S+/.test(appleId.trim()) && pareceContrasenaDeApp(clave);
  async function probar() {
    setEnviando(true);
    setError(null);
    try {
      const r = await api.conectarApple({ slug, employeeId, appleId: appleId.trim(), appPassword: clave.trim() });
      if (r.ok) {
        toast.success("Calendario de iPhone conectado.");
        onCerrar();
        onHecho();
      } else setError(r.error);
    } catch {
      setError("iCloud no ha respondido. Inténtalo de nuevo en un momento.");
    } finally {
      setEnviando(false);
    }
  }
  return (
    <form
      className="space-y-3 rounded-xl border border-salvia bg-salvia-suave px-3.5 py-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (valido) void probar();
      }}
    >
      <ol className="list-decimal space-y-1 pl-5 text-[13.5px] text-cafe">
        <li>
          Entra en tu cuenta de Apple{" "}
          <a href={ENLACE_APPLE} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-bold text-hoja-tinta underline underline-offset-2">
            account.apple.com <ExternalLink className="size-3" aria-hidden="true" />
          </a>
          .
        </li>
        <li>En «Inicio de sesión y seguridad», pulsa «Contraseñas de apps» y crea una llamada «siShow».</li>
        <li>Copia aquí la contraseña que te da (16 letras) y tu correo de iCloud.</li>
      </ol>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-[13px] font-bold">
          Correo de iCloud (Apple ID)
          <Input type="email" autoComplete="off" value={appleId} onChange={(e) => setAppleId(e.target.value)} placeholder="noelia@icloud.com" />
        </label>
        <label className="space-y-1 text-[13px] font-bold">
          Contraseña de app
          <Input type="password" autoComplete="off" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="xxxx-xxxx-xxxx-xxxx" />
          <span className="block text-[12px] font-normal text-cafe-medio">No tu contraseña de Apple normal: la que acabas de crear para siShow.</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-melocoton px-3 py-2 text-[13px] text-melocoton-tinta">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="rounded-full font-bold" disabled={!valido || enviando}>
          {enviando && <Loader2 className="size-4 animate-spin" />}
          Probar conexión
        </Button>
        <Button type="button" variant="ghost" className="rounded-full" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
