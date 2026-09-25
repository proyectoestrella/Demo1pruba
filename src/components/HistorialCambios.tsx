import { useMemo, useState } from "react";
import { MessageCircle, Search } from "lucide-react";
import { textoMotivo, type Cambio, type TipoCambio } from "@/lib/cambios";
import { deshacerConAviso, estadoDeshacer, useCambios } from "@/lib/deshacer-maqueta";
import { STATUS_OPTIONS } from "@/lib/appointment-status";
import { usePermisos } from "@/lib/accesos-panel";
import { puede } from "@/lib/permisos";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Ajustes › Historial de cambios (lote 12): lo cambiado en los últimos 90
 * días, por día, con quién, qué, antes → después y «Deshacer» cuando se
 * puede (o el motivo cuando no). Nunca borra filas: deshacer añade otra.
 * CONECTAR: en un salón real, `listarCambios` (paginado y filtrado por
 * permiso en el servidor); aquí, los cambios de este navegador.
 */

type Grupo = "citas" | "clientas" | "dinero" | "carta" | "equipo" | "web" | "ajustes";
const GRUPOS: Array<[Grupo | "todo", string]> = [
  ["todo", "Todo"],
  ["citas", "Citas"],
  ["dinero", "Cobros y señales"],
  ["clientas", "Clientas"],
  ["carta", "Servicios"],
  ["equipo", "Equipo y horarios"],
  ["web", "Mi página"],
  ["ajustes", "Ajustes"],
];

function grupoDe(t: TipoCambio): Grupo {
  if (t === "cita.cobrar" || t.startsWith("senal.") || t.startsWith("recargo.")) return "dinero";
  if (t.startsWith("cita.")) return "citas";
  if (t.startsWith("clienta.")) return "clientas";
  if (t.startsWith("servicio.")) return "carta";
  if (t === "profesional.editar" || t === "horario.editar") return "equipo";
  if (t.startsWith("perfil.")) return "web";
  return "ajustes";
}

const ESTADO = Object.fromEntries(STATUS_OPTIONS.map((o) => [o.value, o.label]));
const hora = (iso: string) => new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
const diaLargo = (iso: string) => {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date();
  ayer.setDate(hoy.getDate() - 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === ayer.toDateString()) return "Ayer";
  const t = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const fechaHora = (v: unknown) => (typeof v === "string" && v ? new Date(v).toLocaleString("es-ES", { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).replace(",", "") : "—");
const euros = (v: unknown) => (typeof v === "number" ? `${v} €` : "—");

/** «vie 10:00 → sáb 11:30», «Pendiente → Cancelada»… cuando hay un dato simple que comparar. */
export function antesDespues(c: Cambio): string | null {
  const a = c.antes;
  const d = c.despues;
  if ("status" in d) return `${ESTADO[String(a.status)] ?? "—"} → ${ESTADO[String(d.status)] ?? "—"}`;
  if ("start" in d) return `${fechaHora(a.start)} → ${fechaHora(d.start)}`;
  if ("duration" in d) return `${a.duration ?? "—"} min → ${d.duration ?? "—"} min`;
  if ("paidAt" in d || "paymentMethod" in d) return d.paidAt ? `Sin cobrar → Cobrada${d.paymentMethod ? ` (${d.paymentMethod})` : ""}` : "Cobrada → Sin cobrar";
  if ("penaltyEur" in d) return `${euros(a.penaltyEur)} → ${euros(d.penaltyEur)}`;
  if ("manualBlock" in d) return d.manualBlock ? "Puede reservar → Bloqueada" : "Bloqueada → Puede reservar";
  if ("servicio" in d) {
    const sa = a.servicio as { name?: string; priceEur?: number; durationMin?: number; active?: boolean } | null;
    const sd = d.servicio as typeof sa;
    if (!sd) return null;
    if (sa && sa.priceEur !== sd.priceEur) return `${euros(sa.priceEur)} → ${euros(sd.priceEur)}`;
    if (sa && sa.durationMin !== sd.durationMin) return `${sa.durationMin} min → ${sd.durationMin} min`;
    if (sa && sa.active !== sd.active) return sd.active === false ? "Se puede reservar → Oculto" : "Oculto → Se puede reservar";
  }
  return null;
}

export function HistorialCambios() {
  const cambios = useCambios((s) => s.cambios);
  const permisos = usePermisos();
  const [grupo, setGrupo] = useState<Grupo | "todo">("todo");
  const [persona, setPersona] = useState<string>("todas");
  const [busca, setBusca] = useState("");
  // Se vuelve a pintar tras deshacer (la lista cambia), así que el estado de cada fila está al día.
  const personas = useMemo(() => [...new Set(cambios.map((c) => c.autorNombre ?? "Demo"))], [cambios]);
  const veDinero = puede(permisos, "dinero.ver-global") || !!permisos.acciones.get("dinero.ver-propio");
  const filtrados = cambios.filter(
    (c) =>
      (grupo === "todo" || grupoDe(c.tipo) === grupo) &&
      (persona === "todas" || (c.autorNombre ?? "Demo") === persona) &&
      (veDinero || grupoDe(c.tipo) !== "dinero") &&
      (!busca.trim() || c.resumen.toLowerCase().includes(busca.trim().toLowerCase())),
  );
  const porDia = new Map<string, Cambio[]>();
  for (const c of filtrados) {
    const k = diaLargo(c.fecha);
    porDia.set(k, [...(porDia.get(k) ?? []), c]);
  }

  return (
    <div className="space-y-4">
      <p className="text-[14px] text-cafe-medio">Lo que se ha cambiado en el panel en los últimos 90 días. Deshacer no borra nada: añade una fila más.</p>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full border border-input bg-blanco px-3 text-muted-foreground">
          <Search className="size-4 shrink-0" strokeWidth={1.6} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Busca por clienta o servicio" aria-label="Buscar en el historial" className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none" />
        </label>
        <select value={grupo} onChange={(e) => setGrupo(e.target.value as Grupo | "todo")} aria-label="Qué cambios" className="h-9 rounded-full border border-input bg-blanco px-3 text-[13.5px]">
          {GRUPOS.filter(([g]) => veDinero || g !== "dinero").map(([g, t]) => (
            <option key={g} value={g}>
              {t}
            </option>
          ))}
        </select>
        {personas.length > 1 && (
          <select value={persona} onChange={(e) => setPersona(e.target.value)} aria-label="Quién" className="h-9 rounded-full border border-input bg-blanco px-3 text-[13.5px]">
            <option value="todas">Todas</option>
            {personas.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        )}
      </div>

      {filtrados.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-lino px-4 py-6 text-center text-[14px] text-muted-foreground">
          {cambios.length === 0 ? "Todavía no hay cambios. Lo que confirmes, muevas, cobres o guardes aparecerá aquí." : "Nada con ese filtro."}
        </p>
      ) : (
        [...porDia.entries()].map(([dia, lista]) => (
          <section key={dia}>
            <h4 className="px-1 pb-1.5 text-[13px] font-bold text-cafe-medio">{dia}</h4>
            <ul className="divide-y divide-lino overflow-hidden rounded-2xl border border-lino bg-card">
              {lista.map((c) => (
                <FilaCambio key={c.id} c={c} />
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}

function FilaCambio({ c }: { c: Cambio }) {
  const e = estadoDeshacer(c.id);
  const detalle = antesDespues(c);
  return (
    <li className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5 sm:flex-nowrap">
      <span className="w-12 shrink-0 pt-0.5 text-[13px] font-bold tabular-nums text-cafe-medio">{hora(c.fecha)}</span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[14px]", (c.deshechoEn || c.deshaceA) && "text-cafe-medio")}>
          <b className="font-bold">{c.autorNombre ?? "Demo"}</b> · {c.resumen}
          {c.avisoEnviado && <MessageCircle className="ml-1.5 inline size-3.5 text-hoja-tinta" strokeWidth={1.8} aria-label="Se le escribió por WhatsApp" />}
        </p>
        {detalle && <p className="text-[12.5px] text-muted-foreground tabular-nums">{detalle}</p>}
        {!e.puede && e.motivo !== "PERMISO" && e.motivo !== "DESHECHO" && !c.deshaceA && <p className="text-[12.5px] text-muted-foreground">{textoMotivo(e.motivo)}</p>}
      </div>
      <div className="shrink-0">
        {c.deshechoEn ? (
          <span className="rounded-full bg-arena px-2.5 py-0.5 text-[12px] font-bold text-cafe-medio">Deshecho</span>
        ) : e.puede && !c.deshaceA ? (
          <Button size="sm" variant="outline" className="h-8 rounded-full px-3 font-bold" onClick={() => deshacerConAviso(c.id)}>
            Deshacer
          </Button>
        ) : null}
      </div>
    </li>
  );
}
