import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useSalonStore } from "@/lib/store";
import { useEquipo } from "@/lib/use-equipo";
import { detectarColumnas, importarVisitas, leerTabla, vistaPreviaClientas, type CampoCliente, type MapaColumnas, type TablaImportacion } from "@/lib/importar-clientas";
import type { Client } from "@/lib/mock/types";

const campos: { key: CampoCliente; label: string }[] = [
  { key: "nombre", label: "Nombre" }, { key: "apellidos", label: "Apellidos" },
  { key: "telefono", label: "Teléfono móvil" }, { key: "telefono2", label: "Teléfono fijo" },
  { key: "email", label: "Correo" }, { key: "fechaAlta", label: "Fecha de alta" }, { key: "codigo", label: "Código TPV 123" }, { key: "notas", label: "Observaciones" },
  // Opcional: TPV 123 la llama «nacimiento» y se detecta sola; si no, se elige aquí.
  { key: "nacimiento", label: "Cumpleaños (opcional)" },
];

export function ImportarClientasDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const clientes = useSalonStore((s) => s.clients);
  const appointments = useSalonStore((s) => s.appointments);
  const servicios = useSalonStore((s) => s.services);
  const addClient = useSalonStore((s) => s.addClient);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const equipo = useEquipo();
  const [tabla, setTabla] = useState<TablaImportacion | null>(null);
  const [visitas, setVisitas] = useState<TablaImportacion | null>(null);
  const [mapa, setMapa] = useState<MapaColumnas>({});
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [resumen, setResumen] = useState("");
  const previa = useMemo(() => tabla && mapa.nombre !== undefined ? vistaPreviaClientas(tabla, clientes, mapa) : null, [tabla, clientes, mapa]);
  const clientesPrevios = useMemo(() => [...clientes, ...(previa?.filas.filter((f) => f.estado === "nueva").map((f) => ({
    id: `previa-${f.fila}`, name: f.nombre, phone: f.telefono, createdAt: "",
  } as Client)) ?? [])], [clientes, previa]);
  const codigosPrevios = useMemo(() => new Map((previa?.filas ?? []).flatMap((f) => {
    if (!f.codigo) return [];
    const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const existente = clientes.find((c) => norm(c.name) === norm(f.nombre));
    return [[f.codigo, existente?.id ?? `previa-${f.fila}`] as [string, string]];
  })), [previa, clientes]);
  const visitasPrevias = useMemo(() => visitas ? importarVisitas(visitas, clientesPrevios, { servicios, equipo, codigos: codigosPrevios }) : null,
    [visitas, clientesPrevios, servicios, equipo, codigosPrevios]);

  async function cargar(file: File | undefined, tipo: "clientes" | "visitas") {
    if (!file) return;
    setOcupado(true); setError(""); setResumen("");
    try {
      const data = await leerTabla(file);
      if (!data.cabeceras.length) throw new Error("El archivo no tiene cabeceras.");
      if (tipo === "clientes") { setTabla(data); setMapa(detectarColumnas(data.cabeceras)); }
      else setVisitas(data);
    } catch (e) { setError(e instanceof Error ? e.message : "No se ha podido leer el archivo."); }
    finally { setOcupado(false); }
  }

  function importar() {
    if (!previa || !tabla || mapa.nombre === undefined) return;
    const nuevas: Client[] = [];
    const codigos = new Map<string, string>();
    for (const fila of previa.filas.filter((f) => f.estado === "nueva")) {
      const client = addClient({ name: fila.nombre, phone: fila.telefono, email: fila.email, notes: fila.notas, createdAt: fila.fechaAlta, tpvCode: fila.codigo, birthday: fila.nacimiento });
      nuevas.push(client);
      if (fila.codigo) codigos.set(fila.codigo, client.id);
    }
    const normalizar = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    for (const fila of previa.filas.filter((f) => f.codigo && !codigos.has(f.codigo))) {
      // Primero por el código guardado en la ficha (importaciones anteriores); si no, por nombre.
      const existente = clientes.find((c) => c.tpvCode === fila.codigo) ?? clientes.find((c) => normalizar(c.name) === normalizar(fila.nombre));
      if (existente) codigos.set(fila.codigo!, existente.id);
    }
    const historial = visitas ? importarVisitas(visitas, [...clientes, ...nuevas], { servicios, equipo, codigos }) : { visitas: [], errores: 0, noEnlazadas: 0, lineas: 0 };
    let hechas = 0;
    const claves = new Set(appointments.filter((a) => a.origen === "tpv123").map((a) => `${a.clientId}|${a.start}|${a.serviceIds.join(",")}`));
    for (const v of historial.visitas) {
      const clave = `${v.cliente.id}|${v.fecha}|${v.servicios.join(",")}`;
      if (claves.has(clave)) continue;
      claves.add(clave);
      addAppointment({ clientId: v.cliente.id, clientName: v.cliente.name, serviceIds: v.servicios,
        employeeId: (v.profesional || "sin-indicar") as typeof equipo[number]["id"],
        start: v.fecha, duration: 0, priceEur: v.importe, status: "completed", origen: "tpv123",
        technicalNotes: v.notas, colorFormula: v.colorFormula },
      { name: v.cliente.name, phone: v.cliente.phone, email: v.cliente.email });
      hechas++;
    }
    setResumen(`Importadas ${nuevas.length} clientas y ${hechas} visitas. ${previa.duplicadas} clientas duplicadas, ${historial.noEnlazadas} líneas sin enlazar y ${previa.errores + historial.errores} filas con errores.`);
    setTabla(null); setVisitas(null); setMapa({});
  }

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[90dvh] w-[calc(100vw-1rem)] max-w-2xl overflow-y-auto p-4 sm:p-6">
      <DialogHeader>
        <DialogTitle>Importar desde TPV 123</DialogTitle>
        <DialogDescription>Trae tus clientas y su histórico de ventas. Revisa la vista previa antes de importar.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4 text-sm">
        <label className="block space-y-1 font-medium">Fichero de clientas (.csv o .xlsx)
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void cargar(e.target.files?.[0], "clientes")}
            className="block w-full min-w-0 rounded border border-border p-2 text-sm font-normal" />
        </label>
        <label className="block space-y-1 font-medium">Histórico de ventas, opcional (.csv o .xlsx)
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => void cargar(e.target.files?.[0], "visitas")}
            className="block w-full min-w-0 rounded border border-border p-2 text-sm font-normal" />
        </label>
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {tabla && <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {campos.map((campo) => <label key={campo.key} className="space-y-1 text-xs">
              <span>{campo.label}</span>
              <select value={mapa[campo.key] ?? ""} onChange={(e) => setMapa((m) => ({ ...m, [campo.key]: e.target.value === "" ? undefined : Number(e.target.value) }))}
                className="w-full min-w-0 rounded border border-border bg-background p-2 text-sm">
                <option value="">Sin columna</option>
                {tabla.cabeceras.map((h, i) => <option key={i} value={i}>{h || `Columna ${i + 1}`}</option>)}
              </select>
            </label>)}
          </div>
          {mapa.nombre === undefined ? <p role="alert">Elige qué columna contiene el nombre para ver la vista previa.</p> : previa && <>
            <p className="font-medium">{previa.nuevas} nuevas · {previa.duplicadas} duplicadas · {previa.errores} con errores
              {visitasPrevias && ` · ${visitasPrevias.visitas.length} visitas de ${new Set(visitasPrevias.visitas.map((v) => v.cliente.id)).size} clientas · ${visitasPrevias.noEnlazadas} líneas sin enlazar · ${visitasPrevias.errores} filas erróneas`}</p>
            <p className="text-xs text-muted-foreground">No se importan DNI/CIF, dirección, C.P., población ni provincia. El cumpleaños sí, si eliges su columna arriba (con «nacimiento» o «cumpleaños» se detecta sola).</p>
            {previa.duplicadas > 0 && <p className="break-words text-muted-foreground">Duplicadas: {previa.filas.filter((f) => f.estado === "duplicada").map((f) => f.nombre).join(", ")}</p>}
            <div className="max-h-64 space-y-1 overflow-y-auto rounded border border-border p-2">
              {previa.filas.slice(0, 10).map((f) => <p key={f.fila} className="break-words">{f.fila}. {f.nombre || "Sin nombre"} · {f.telefono || "sin teléfono"}{f.nacimiento ? ` · cumple ${new Date(`${f.nacimiento}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long" })}` : ""} · {f.estado === "nueva" ? "Nueva" : f.estado === "duplicada" ? "Duplicada" : `Error: ${f.motivo}`}</p>)}
            </div>
            <Button onClick={importar} disabled={ocupado || (!previa.nuevas && !visitasPrevias?.visitas.length)} className="w-full sm:w-auto">Importar {previa.nuevas} clientas</Button>
          </>}
        </>}
        {resumen && <p role="status" className="rounded bg-primary/10 p-3">{resumen}</p>}
        <details className="rounded border border-border p-3 text-muted-foreground">
          <summary className="cursor-pointer font-medium">Cómo sacar los Excel de TPV 123</summary>
          <div className="mt-2 space-y-2">
            <p><strong>Clientas:</strong> Listados › Listados generales › Clientes › flecha verde.</p>
            <p><strong>Ventas:</strong> Listados de Ventas › Historico X Clientes › informe «LISTADO HISTORICO POR CLIENTE».</p>
            <p>La ficha técnica del color se pasa desde la ficha de cada clienta, con «Añadir color de TPV 123».</p>
          </div>
        </details>
      </div>
    </DialogContent>
  </Dialog>;
}
