import { isoDelSalon, zonaDelSalon } from "@/lib/zona-horaria";
import { avisar } from "@/lib/deshacer-maqueta";
import { useEquipoParaDarCita } from "@/lib/accesos-panel";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useFocoDeVuelta } from "@/lib/foco-de-vuelta";
import { Check, Clock3, MessageCircle, Search, TriangleAlert, UserPlus, X } from "lucide-react";
import { useSalonStore, selectServiceMap } from "@/lib/store";
import { esSoloUnProfesional } from "@/lib/solo-profesional";
import { useEquipo } from "@/lib/use-equipo";
import type { Appointment, EmployeeId } from "@/lib/mock/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DuracionOtra } from "@/components/DuracionOtra";
import { cn } from "@/lib/utils";
import { idServicioLibre, serviceLabelOf, sumServices } from "@/lib/appointment-services";
import { eur, hora } from "@/lib/copy";
import { duracionRecordada } from "@/lib/derive";
import { fichaDeClienta } from "@/lib/ficha-clienta";
import { buscarClientas } from "@/lib/buscar-clientas";
import { indiceColorServicio } from "@/lib/hoy-arena";
import { trabajaEn } from "@/lib/horario-equipo";
import {
  citasQueOcupan,
  clientasFrecuentes,
  diasParaElegir,
  duracionLegible,
  horaOcupada,
  horasDeProfesional,
  primeraLibre,
} from "@/lib/nueva-cita";
import { solapaConAgenda } from "@/lib/solape";
import type { OpcionesGuardado } from "@/lib/salon-sync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

// NOTE: these must use local time components (not toISOString, which is UTC)
// so a slot clicked at "9:00" in the calendar prefills the form as 9:00, not
// shifted by the browser's UTC offset.
function toDateInput(d: Date) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
function toTimeInput(d: Date) {
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}
const minutosDeHora = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
const horaDeMinutos = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const soloDigitos = (t: string) => t.replace(/\D/g, "").replace(/^34(?=\d{9}$)/, "");
const DCORTO = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export interface NewAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional prefill — used when creating from a calendar slot or waitlist entry. */
  defaultDate?: Date;
  defaultEmployeeId?: EmployeeId;
  defaultServiceId?: string;
  defaultClientName?: string;
  defaultPhone?: string;
  onCreated?: (appt: Appointment) => void;
  /**
   * Los sábados de Cardedal son 55-60 clientes que llaman esa misma mañana,
   * uno detrás de otro. Con esto el formulario ofrece "Guardar y crear otra":
   * se queda abierto y limpio para la siguiente llamada en vez de obligar a
   * volver a la agenda y abrirlo otra vez.
   */
  allowChaining?: boolean;
}

/**
 * «Nueva cita» a lo grande (identidad «Arena», DESIGN.md): una capa blanca
 * que cubre todo salvo el menú lateral, con tres columnas — clienta;
 * servicio, profesional, día, hora y duración; y el resumen con «Guardar
 * cita». La página de debajo no se toca. Si la cita ya tiene algo tocado,
 * cualquier salida (Cerrar, Escape, un enlace del menú) pregunta antes.
 *
 * Misma API y mismo guardado que el diálogo de siempre: la abren la
 * cabecera, el calendario (con profesional y hora puestas), la lista de
 * espera, la ficha y Hoy.
 */
/**
 * Lote 16: cerrado, el formulario no se monta (antes calculaba clientas
 * frecuentes, huecos y carta en cada pintado de cada pantalla que lo lleva).
 * Se queda montado 400 ms tras cerrar para que la salida se anime.
 */
export function NewAppointmentDialog(props: NewAppointmentDialogProps) {
  const [montado, setMontado] = useState(props.open);
  useEffect(() => {
    if (props.open) {
      setMontado(true);
      return;
    }
    const t = setTimeout(() => setMontado(false), 400);
    return () => clearTimeout(t);
  }, [props.open]);
  if (!props.open && !montado) return null;
  return <FormularioNuevaCita {...props} />;
}

function FormularioNuevaCita({
  open,
  onOpenChange,
  defaultDate,
  defaultEmployeeId,
  defaultServiceId,
  defaultClientName,
  defaultPhone,
  onCreated,
  allowChaining = false,
}: NewAppointmentDialogProps) {
  // Al cerrar, el foco vuelve al botón que la abrió (no modal y sin Trigger: Radix no lo hace).
  const focoDeVuelta = useFocoDeVuelta(open);
  const navigate = useNavigate();
  const services = useSalonStore((s) => s.services);
  const clients = useSalonStore((s) => s.clients);
  const appointments = useSalonStore((s) => s.appointments);
  const addAppointment = useSalonStore((s) => s.addAppointment);
  const zonaHoraria = useSalonStore((s) => zonaDelSalon(s.salonProfile));
  const addClient = useSalonStore((s) => s.addClient);
  const addService = useSalonStore((s) => s.addService);
  const salonName = useSalonStore((s) => s.salonProfile.name);
  const activeServices = services.filter((s) => s.active !== false);
  const serviceMap = selectServiceMap(services);

  const [clientChoice, setClientChoice] = useState<string>("__new");
  const [busqueda, setBusqueda] = useState("");
  const [newName, setNewName] = useState(defaultClientName ?? "");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [serviceIds, setServiceIds] = useState<string[]>(() =>
    [defaultServiceId ?? activeServices[0]?.id].filter((id): id is string => !!id),
  );
  // Lote 11: sin «crear para otra», solo su profesional; las citas de todas siguen para no pisar.
  const employees = useEquipoParaDarCita();
  // Con un solo profesional no hay a quién asignar: se asigna solo y el
  // selector desaparece del formulario.
  const soloUno = esSoloUnProfesional(employees);
  const [employeeId, setEmployeeId] = useState<EmployeeId>(defaultEmployeeId ?? employees[0].id);
  const [date, setDate] = useState(toDateInput(defaultDate ?? new Date()));
  const [time, setTime] = useState(toTimeInput(defaultDate ?? new Date()));
  const [note, setNote] = useState("");
  /**
   * Duración elegida a mano, en minutos. `null` = la que sale del catálogo
   * (o la recordada, si la hay). María (PeluChic) lo dijo tal cual: "el
   * tiempo de cada cita lo decido yo".
   */
  const [duracionManual, setDuracionManual] = useState<number | null>(null);
  /** Cuántas citas seguidas se llevan creadas sin cerrar el formulario. */
  const [encadenadas, setEncadenadas] = useState(0);
  /** Popup «¿Seguro que quieres salir?» y, si venía de un enlace, a dónde iba. */
  const [confirmarSalida, setConfirmarSalida] = useState<{ destino?: string } | null>(null);
  /** Citas con las que choca la que se va a guardar, a la espera de que la dueña decida. */
  const [solape, setSolape] = useState<{ choques: Appointment[]; encadenar: boolean } | null>(null);
  const capa = useRef<HTMLDivElement>(null);
  const inicial = useRef("");
  /** Sube cada vez que se rellena la capa: la foto de «cómo estaba» se toma justo después. */
  const [semilla, setSemilla] = useState(0);

  // Re-sync prefill whenever the dialog is (re)opened with new defaults.
  useEffect(() => {
    if (!open) return;
    // Si llega el teléfono de alguien que ya es clienta (desde su ficha o la
    // lista de espera), se elige su ficha: si no, se crearía una repetida.
    const existente = defaultPhone
      ? clients.find((c) => c.phone && soloDigitos(c.phone) === soloDigitos(defaultPhone))
      : undefined;
    setClientChoice(existente?.id ?? "__new");
    setBusqueda("");
    setNewName(existente ? "" : (defaultClientName ?? ""));
    setPhone(existente ? "" : (defaultPhone ?? ""));
    setServiceIds([defaultServiceId ?? activeServices[0]?.id].filter((id): id is string => !!id));
    setOtro(null);
    setEmployeeId(defaultEmployeeId ?? employees[0].id);
    setDate(toDateInput(defaultDate ?? new Date()));
    setTime(toTimeInput(defaultDate ?? new Date()));
    setNote("");
    setDuracionManual(null);
    setEncadenadas(0);
    setConfirmarSalida(null);
    setSolape(null);
    setSemilla((n) => n + 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function toggleService(id: string) {
    setOtro(null);
    setServiceIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  }

  // «Otro…» (9g): un servicio que no está en la carta, con nombre, duración y
  // precio libres. Excluye a los de la carta. Con la casilla, se añade a la
  // carta al guardar; sin ella, vive solo en esta cita (`libre:<nombre>`).
  const [otro, setOtro] = useState<{ nombre: string; precio: string; enCarta: boolean } | null>(null);
  const precioOtro = otro ? Number(otro.precio.replace(",", ".").trim()) : NaN;
  const precioOtroValido = !!otro && otro.precio.trim() !== "" && Number.isFinite(precioOtro) && precioOtro >= 0;

  const chosen = serviceIds.map((id) => serviceMap[id]).filter(Boolean);
  // La cita bloquea y cobra la suma de todos los servicios elegidos.
  const suma = sumServices(chosen);
  const catalogoMin = otro ? 60 : suma.durationMin;
  const total = otro ? (precioOtroValido ? Math.round(precioOtro * 100) / 100 : 0) : suma.priceEur;

  // Si a esta persona estos mismos servicios le llevaron otra cosa la última
  // vez, se propone ESO y se dice por qué. El catálogo sabe cuánto dura un
  // corte; no sabe cuánto dura el corte de esta clienta.
  const recordada = duracionRecordada(
    appointments,
    clientChoice !== "__new" ? clientChoice : undefined,
    serviceIds,
    catalogoMin,
  );
  const totalMin = duracionManual ?? recordada?.minutos ?? catalogoMin;
  // Duraciones a elegir: las de siempre más la del catálogo y la recordada.
  const opcionesDuracion = [
    ...new Set([30, 40, 45, 60, 90, 120, catalogoMin, totalMin].filter((n) => n > 0)),
  ].sort((a, b) => a - b);

  // ¿Hay algo tocado? Se compara con cómo estaba al abrir: si no, se cierra sin preguntar.
  const huella = JSON.stringify([clientChoice, newName, phone, serviceIds, employeeId, date, time, note, duracionManual, otro]);
  // La foto se toma en el render que ya lleva el relleno (profesional y hora
  // de un hueco, clienta de la ficha…); si no, abrir desde el calendario
  // contaba como «tocada» y Escape preguntaba sin motivo.
  useEffect(() => {
    if (open) inicial.current = huella;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [semilla]);
  const tocada = open && !!inicial.current && huella !== inicial.current;

  function cerrar() {
    onOpenChange(false);
  }
  function intentarSalir(destino?: string) {
    if (tocada) setConfirmarSalida({ destino });
    else {
      cerrar();
      if (destino) void navigate({ to: destino });
    }
  }

  // Un enlace del menú con la cita a medio registrar: primero se pregunta.
  useEffect(() => {
    if (!open) return;
    function alPulsar(e: MouseEvent) {
      const enlace = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!enlace || capa.current?.contains(enlace)) return;
      if (enlace.target === "_blank" || e.metaKey || e.ctrlKey) return;
      const url = new URL(enlace.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      e.preventDefault();
      e.stopPropagation();
      intentarSalir(url.pathname + url.search);
    }
    document.addEventListener("click", alPulsar, true);
    return () => document.removeEventListener("click", alPulsar, true);
  });

  // ---- Día, hora, profesional ----
  const hoy = new Date();
  const fechaElegida = new Date(`${date}T00:00:00`);
  const dias = diasParaElegir(hoy, fechaElegida);
  const weekday = fechaElegida.getDay();
  const ocupanDia = useMemo(() => citasQueOcupan(appointments, fechaElegida), [appointments, date]); // eslint-disable-line react-hooks/exhaustive-deps
  const empleado = employees.find((e) => e.id === employeeId) ?? employees[0];
  const minutoElegido = minutosDeHora(time);
  const horasPro = empleado ? horasDeProfesional(empleado, weekday) : [];
  const horasVisibles = [...new Set([...horasPro, ...(horasPro.includes(minutoElegido) ? [] : [minutoElegido])])].sort((a, b) => a - b);
  const esPasada = (m: number) => toDateInput(hoy) === date && m < hoy.getHours() * 60 + hoy.getMinutes();

  function cualquieraLibre() {
    const libre = primeraLibre(employees, ocupanDia, weekday, minutoElegido, totalMin);
    if (libre) {
      setEmployeeId(libre.id);
      toast.success(`${libre.name} está libre a las ${time}`);
    } else {
      toast.error(`Nadie está libre a las ${time} durante ${duracionLegible(totalMin)}`);
    }
  }

  // ---- Clienta ----
  const elegida = clientChoice !== "__new" ? clients.find((c) => c.id === clientChoice) : undefined;
  const frecuentes = useMemo(() => clientasFrecuentes(appointments, clients, new Date()), [appointments, clients]);
  const resultados = busqueda.trim() ? buscarClientas(busqueda, { clientes: clients, citas: appointments }).slice(0, 7) : [];
  const fichaRapida = elegida
    ? fichaDeClienta(elegida.id, { citas: appointments, clientes: clients, servicios: services, equipo: employees, ahora: new Date() })
    : null;

  // ---- Guardar ----
  function validar(): boolean {
    if (otro) {
      if (!otro.nombre.trim()) {
        toast.error("Escribe el nombre del servicio");
        return false;
      }
      if (!precioOtroValido) {
        toast.error("Escribe el precio del servicio, por ejemplo 35");
        return false;
      }
    } else if (!chosen.length) {
      toast.error("Elige al menos un servicio");
      return false;
    }
    if (!date || !time) {
      toast.error("Elige día y hora");
      return false;
    }
    if (clientChoice === "__new" && !newName.trim()) {
      toast.error("Escribe el nombre de la clienta");
      return false;
    }
    if (clientChoice !== "__new" && !elegida) {
      toast.error("Elige una clienta");
      return false;
    }
    return true;
  }

  function handleSubmit(encadenar = false) {
    if (!validar()) return;
    // Antes de guardar se mira si pisa otra cita de esa profesional. El
    // choque no se prohíbe: es su agenda, ella decide (contrato E1).
    const choques = solapaConAgenda(appointments, {
      employeeId,
      start: new Date(`${date}T${time}:00`).toISOString(),
      duration: totalMin,
    });
    if (choques.length) {
      setSolape({ choques, encadenar });
      return;
    }
    guardar(encadenar, {});
  }

  function guardar(encadenar: boolean, opciones: OpcionesGuardado) {
    let clientId: string;
    let clientName: string;
    let clientPhone = "";
    let clientEmail: string | undefined;
    if (elegida) {
      clientId = elegida.id;
      clientName = elegida.name;
      clientPhone = elegida.phone;
      clientEmail = elegida.email;
    } else {
      clientName = newName.trim();
      if (phone.trim()) {
        const created = addClient({ name: clientName, phone: phone.trim() });
        clientId = created.id;
        clientPhone = phone.trim();
      } else {
        clientId = `walkin-${Date.now()}`;
      }
    }

    // En la zona del salón, no la del aparato (contrato E2).
    const startISO = isoDelSalon(date, time, zonaHoraria);
    const start = new Date(startISO);
    let idsDeServicio = chosen.map((s) => s.id);
    if (otro) {
      if (otro.enCarta) {
        // Entra en la carta con la duración y el precio de esta cita; el color
        // se lo da su posición en la carta, como a los demás.
        const nuevo = addService({ name: otro.nombre.trim(), description: "", durationMin: totalMin, priceEur: total, active: true });
        idsDeServicio = [nuevo.id];
        toast.success("Servicio añadido a la carta", { description: otro.nombre.trim() });
      } else {
        idsDeServicio = [idServicioLibre(otro.nombre)];
      }
    }
    // Contrato E1 (lib/solape.ts): `permitirSolape` viaja tal cual la dueña
    // lo confirmó en `DialogoSolape`; sin él, el servidor rechazaría un
    // choque real con RESERVA_SOLAPE_PANEL.
    const appt = addAppointment(
      {
        clientId,
        clientName,
        serviceIds: idsDeServicio,
        employeeId,
        start: startISO,
        duration: totalMin,
        priceEur: total,
        status: "confirmed",
        note,
      },
      // Con teléfono se crea/reconoce la ficha del cliente; sin él es un "Sin
      // cita" y la cita sube igual, solo que sin ficha. Lo lleva la store,
      // que sabe qué salón está gestionando este panel.
      clientPhone ? { name: clientName, phone: clientPhone, email: clientEmail } : undefined,
      opciones,
    );

    // Lote 12: «Cita de Ana guardada · vie 10:00» con «Deshacer» (la borra).
    const cuando = new Date(appt.start).toLocaleString("es-ES", { weekday: "short", hour: "2-digit", minute: "2-digit" }).replace(",", "");
    avisar(`Cita de ${clientName.split(" ")[0]} guardada · ${cuando}`, () => useSalonStore.getState().deleteAppointment(appt.id));
    onCreated?.(appt);

    if (encadenar) {
      // Se queda abierto y en blanco, con la fecha puesta donde estaba: es la
      // diferencia entre 60 llamadas de un sábado y 60 idas y venidas a la
      // agenda. Solo se limpia lo que cambia de un cliente al siguiente.
      setEncadenadas((n) => n + 1);
      setClientChoice("__new");
      setBusqueda("");
      setNewName("");
      setPhone("");
      setNote("");
      setDuracionManual(null);
      setServiceIds([activeServices[0]?.id].filter((id): id is string => !!id));
      setOtro(null);
      setSemilla((n) => n + 1);
      return;
    }
    cerrar();
  }

  // ---- Piezas ----
  const etiquetaCol = "mb-3.5 text-xs font-extrabold tracking-[0.06em] text-muted-foreground uppercase";
  const etiquetaCampo = "mb-2 block text-[12.5px] font-bold text-cafe-medio";
  const opcion = (on: boolean) =>
    cn(
      "inline-flex h-10 items-center gap-2 rounded-full border px-[15px] text-[13.5px] font-bold transition-colors",
      on ? "border-salvia bg-salvia-clara text-hoja-tinta" : "border-input bg-card text-cafe-medio hover:bg-nata",
    );
  const columna = "flex min-w-0 flex-col rounded-[20px] border border-border bg-card p-5 md:p-[22px]";
  const fechaLarga = fechaElegida.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  const ocupadaElegida = empleado ? horaOcupada(ocupanDia, empleado.id, minutoElegido, totalMin) : false;
  const trabajaElegida = empleado ? trabajaEn(empleado, weekday, minutoElegido, totalMin) : true;

  return (
    <>
      {/* No modal: el menú lateral sigue vivo para que un enlace pueda
          preguntar «¿seguro que quieres salir?» en vez de quedarse muerto. */}
      <DialogPrimitive.Root
        open={open}
        modal={false}
        onOpenChange={(o) => {
          if (!o) intentarSalir();
        }}
      >
        <DialogPrimitive.Portal>
          <DialogPrimitive.Content
            ref={capa}
            aria-describedby={undefined}
            {...focoDeVuelta}
            onEscapeKeyDown={(e) => {
              e.preventDefault();
              intentarSalir();
            }}
            // Pulsar fuera (el menú lateral) cuenta como salir; los enlaces
            // del menú ya los recoge el aviso de arriba.
            onPointerDownOutside={(e) => {
              e.preventDefault();
            }}
            onInteractOutside={(e) => e.preventDefault()}
            className="fixed inset-y-0 right-0 left-0 z-50 flex flex-col bg-background outline-none md:left-[244px]"
          >
            {/* Cabecera de la capa */}
            <div className="flex flex-none items-center gap-3.5 border-b border-border px-4 py-3 md:px-7 md:py-4">
              <div className="min-w-0">
                <p className="hidden text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase md:block">Agenda de {salonName}</p>
                <DialogPrimitive.Title className="text-xl font-extrabold tracking-[-0.02em] md:text-2xl">Nueva cita</DialogPrimitive.Title>
              </div>
              <span
                className={cn(
                  "ml-auto hidden h-6 items-center rounded-full px-2.5 text-[12.5px] font-bold md:inline-flex",
                  tocada ? "border-[1.5px] border-dashed border-moca bg-card text-primary" : "bg-nata text-cafe-medio",
                )}
              >
                {tocada ? "Sin guardar" : "Sin cambios"}
              </span>
              {encadenadas > 0 && (
                <span className="hidden text-[12.5px] text-muted-foreground md:inline">
                  {encadenadas} {encadenadas === 1 ? "cita creada" : "citas creadas"} sin salir de aquí
                </span>
              )}
              <Button type="button" variant="outline" className="ml-auto h-[42px] md:ml-0" onClick={() => intentarSalir()}>
                <X className="size-[18px]" strokeWidth={1.6} />
                Cerrar
              </Button>
            </div>

            <form
              className="flex min-h-0 flex-1 overflow-auto bg-perla p-4 pb-28 md:px-7 md:py-6 lg:pb-6"
              onSubmit={(e) => {
                e.preventDefault();
                handleSubmit(false);
              }}
            >
              <div className="grid min-h-full flex-1 grid-cols-1 items-stretch gap-4 md:gap-5 lg:grid-cols-[minmax(260px,1fr)_minmax(360px,1.5fr)_minmax(260px,0.9fr)]">
                {/* 1 · Clienta */}
                <section className={columna} aria-label="Clienta">
                  <h3 className={etiquetaCol}>1 · Clienta</h3>
                  {elegida && fichaRapida ? (
                    <div className="rounded-2xl bg-nata p-3.5 text-[13px]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-display text-xl leading-tight font-medium">{elegida.name}</p>
                          <p className="text-muted-foreground tabular-nums">{elegida.phone}</p>
                        </div>
                        <button type="button" className="text-[12.5px] font-bold text-primary underline-offset-2 hover:underline" onClick={() => setClientChoice("__new")}>
                          Cambiar
                        </button>
                      </div>
                      <p className="mt-2 text-muted-foreground tabular-nums">
                        {fichaRapida.resumen.numeroVisitas} visitas
                        {fichaRapida.resumen.ultimaVisita
                          ? ` · última ${new Date(fichaRapida.resumen.ultimaVisita).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`
                          : ""}
                        {fichaRapida.resumen.servicioHabitual ? ` · suele pedir ${fichaRapida.resumen.servicioHabitual.toLowerCase()}` : ""}
                      </p>
                      {fichaRapida.avisos.length > 0 && (
                        <div className="mt-2.5 flex gap-2 rounded-xl border border-melocoton-borde bg-melocoton px-2.5 py-2 text-[12.5px] text-melocoton-tinta">
                          <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.6} />
                          <div>{fichaRapida.avisos.map((a) => <p key={a}>{a}</p>)}</div>
                        </div>
                      )}
                      <p className={cn("mt-2.5 rounded-xl px-2.5 py-2 text-[12.5px]", fichaRapida.resumen.ultimoColor ? "bg-salvia-clara text-hoja-tinta" : "bg-card text-muted-foreground")}>
                        <b>Último color:</b> {fichaRapida.resumen.ultimoColor?.formula ?? "sin fórmula anotada"}
                      </p>
                    </div>
                  ) : (
                    <>
                      <label className="flex h-12 items-center gap-2 rounded-xl border border-input bg-card px-3 text-muted-foreground focus-within:border-moca focus-within:ring-3 focus-within:ring-moca/15">
                        <Search className="size-[18px] shrink-0" strokeWidth={1.6} />
                        <input
                          autoFocus
                          value={busqueda}
                          onChange={(e) => setBusqueda(e.target.value)}
                          placeholder="Nombre o teléfono"
                          aria-label="Buscar clienta por nombre o teléfono"
                          className="min-w-0 flex-1 bg-transparent text-[15px] text-foreground outline-none placeholder:text-muted-foreground"
                        />
                      </label>
                      <p className="mt-4 mb-1.5 text-[11px] font-bold tracking-[0.06em] text-muted-foreground uppercase">
                        {busqueda.trim() ? "Resultados" : "Vienen a menudo"}
                      </p>
                      <div className="flex flex-col">
                        {(busqueda.trim()
                          ? resultados.map((c) => ({ client: c, detalle: c.phone }))
                          : frecuentes.map((f) => ({
                              client: f.client,
                              detalle: `${f.visitas} en los últimos 4 meses · última ${new Date(f.ultima).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}`,
                            }))
                        ).map(({ client, detalle }) => (
                          <button
                            key={client.id}
                            type="button"
                            onClick={() => setClientChoice(client.id)}
                            className="flex items-center gap-2.5 rounded-xl px-2 py-2 text-left hover:bg-nata"
                          >
                            <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-arena text-[11px] font-extrabold" aria-hidden="true">
                              {client.name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <b className="block truncate">{client.name}</b>
                              <span className="block truncate text-[12.5px] text-muted-foreground tabular-nums">{detalle}</span>
                            </span>
                          </button>
                        ))}
                        {busqueda.trim() && resultados.length === 0 && (
                          <p className="px-2 py-1 text-[12.5px] text-muted-foreground">Ninguna clienta con ese nombre o teléfono.</p>
                        )}
                      </div>
                      <div className="mt-4 rounded-2xl border border-dashed border-lino-fuerte p-3.5">
                        <p className="mb-2.5 flex items-center gap-1.5 text-[12.5px] font-bold text-cafe-medio">
                          <UserPlus className="size-[15px]" strokeWidth={1.6} />
                          Clienta nueva
                        </p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                          <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder={busqueda.trim() && !/\d/.test(busqueda) ? busqueda : "Nombre"} aria-label="Nombre de la clienta nueva" className="h-11" />
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Teléfono (opcional)" aria-label="Teléfono de la clienta nueva" className="h-11" inputMode="tel" />
                        </div>
                      </div>
                    </>
                  )}
                </section>

                {/* 2 · Servicio, profesional y hora */}
                <section className={columna} aria-label="Servicio, profesional y hora">
                  <h3 className={etiquetaCol}>2 · Servicio, profesional y hora</h3>
                  <span className={etiquetaCampo}>Servicio</span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeServices.map((s) => {
                      const on = serviceIds.includes(s.id);
                      return (
                        <button key={s.id} type="button" aria-pressed={on} onClick={() => toggleService(s.id)} className={opcion(on)}>
                          <i className="size-2.5 rounded-[4px]" style={{ background: `var(--serv-${indiceColorServicio(s.id, services)}-borde)` }} aria-hidden="true" />
                          {s.name} · {eur(s.priceEur).replace(",00", "")}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      aria-pressed={!!otro}
                      onClick={() => {
                        if (otro) return setOtro(null);
                        setServiceIds([]);
                        setOtro({ nombre: "", precio: "", enCarta: false });
                      }}
                      className={opcion(!!otro)}
                    >
                      Otro…
                    </button>
                  </div>
                  {otro && (
                    <div className="mt-3 grid gap-3 rounded-2xl border border-lino bg-card p-3.5">
                      <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
                        <label className="grid gap-1 text-[13px] font-bold text-cafe">
                          Nombre del servicio
                          <input
                            autoFocus
                            value={otro.nombre}
                            maxLength={60}
                            onChange={(e) => setOtro({ ...otro, nombre: e.target.value })}
                            placeholder="Por ejemplo, Recogido con trenza"
                            className="h-10 rounded-xl border border-input bg-blanco px-3 text-[14px] font-normal"
                          />
                        </label>
                        <label className="grid gap-1 text-[13px] font-bold text-cafe">
                          Precio (€)
                          <input
                            value={otro.precio}
                            inputMode="decimal"
                            onChange={(e) => setOtro({ ...otro, precio: e.target.value })}
                            placeholder="35"
                            aria-invalid={otro.precio.trim() !== "" && !precioOtroValido}
                            className="h-10 rounded-xl border border-input bg-blanco px-3 text-[14px] font-normal tabular-nums"
                          />
                        </label>
                      </div>
                      <p className="text-[12.5px] text-cafe-suave">La duración se elige abajo, en «Duración».</p>
                      <label className="flex items-center gap-2 text-[13.5px] text-cafe">
                        <input type="checkbox" className="size-4 accent-[var(--hoja)]" checked={otro.enCarta} onChange={(e) => setOtro({ ...otro, enCarta: e.target.checked })} />
                        Guardar como nuevo servicio en la carta
                      </label>
                    </div>
                  )}

                  {!soloUno && (
                    <>
                      <span className={cn(etiquetaCampo, "mt-5")}>Profesional</span>
                      <div className="flex flex-wrap gap-1.5">
                        {employees.map((e, i) => (
                          <button key={e.id} type="button" aria-pressed={employeeId === e.id} onClick={() => setEmployeeId(e.id)} className={opcion(employeeId === e.id)}>
                            <span className="grid size-6 place-items-center rounded-full text-[10px] font-extrabold text-cafe" style={{ background: `var(--stylist-${["mario", "diego", "ruben"][i % 3]})` }} aria-hidden="true">
                              {e.name[0]}
                            </span>
                            {e.name}
                          </button>
                        ))}
                        <button type="button" onClick={cualquieraLibre} className={opcion(false)}>
                          Cualquiera libre
                        </button>
                      </div>
                    </>
                  )}

                  <span className={cn(etiquetaCampo, "mt-5")}>Día</span>
                  <div className="grid grid-cols-7 gap-1.5">
                    {dias.map((d) => {
                      const on = toDateInput(d) === date;
                      const abre = employees.some((e) => horasDeProfesional(e, d.getDay()).length > 0);
                      return (
                        <button
                          key={d.getTime()}
                          type="button"
                          disabled={!abre}
                          onClick={() => setDate(toDateInput(d))}
                          className={cn(
                            "rounded-xl border py-2 text-xs leading-tight font-bold disabled:cursor-not-allowed disabled:opacity-40",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card hover:bg-nata",
                          )}
                        >
                          {DCORTO[d.getDay()]}
                          <b className="block text-[17px] tabular-nums">{d.getDate()}</b>
                        </button>
                      );
                    })}
                  </div>
                  <label className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    Otro día
                    <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-auto" aria-label="Elegir otro día" />
                  </label>

                  <span className={cn(etiquetaCampo, "mt-5")}>
                    Hora <span className="font-normal text-muted-foreground">· tachadas = ocupadas o ya pasadas</span>
                  </span>
                  {horasVisibles.length === 0 ? (
                    <p className="rounded-xl bg-nata px-3 py-2 text-[12.5px] text-muted-foreground">
                      {empleado?.name ?? "Nadie"} no trabaja este día. Elige otro día u otra profesional.
                    </p>
                  ) : (
                    <div className="grid grid-cols-[repeat(auto-fill,minmax(70px,1fr))] gap-1.5">
                      {horasVisibles.map((m) => {
                        const ocupada = empleado ? horaOcupada(ocupanDia, empleado.id, m, totalMin) : false;
                        const pasada = esPasada(m);
                        const on = m === minutoElegido;
                        return (
                          <button
                            key={m}
                            type="button"
                            disabled={(ocupada || pasada) && !on}
                            onClick={() => setTime(horaDeMinutos(m))}
                            aria-pressed={on}
                            className={cn(
                              "h-[38px] rounded-[10px] border text-[13px] font-bold tabular-nums",
                              on && "border-primary bg-primary text-primary-foreground",
                              !on && (ocupada || pasada) && "cursor-not-allowed border-input bg-perla text-taupe line-through",
                              !on && !ocupada && !pasada && "border-input bg-card hover:bg-nata",
                            )}
                          >
                            {horaDeMinutos(m)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <label className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                    Otra hora
                    <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-auto" aria-label="Escribir otra hora" />
                  </label>
                  {(ocupadaElegida || !trabajaElegida) && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-melocoton-tinta">
                      <TriangleAlert className="mt-px size-3.5 shrink-0" strokeWidth={1.6} />
                      {ocupadaElegida
                        ? `${empleado?.name} ya tiene una cita a esa hora. Puedes guardarla igual: te preguntaremos antes.`
                        : `${empleado?.name} no trabaja a esa hora.`}
                    </p>
                  )}

                  <span className={cn(etiquetaCampo, "mt-5")}>Duración</span>
                  <div className="flex flex-wrap gap-1.5">
                    {opcionesDuracion.map((min) => (
                      <button key={min} type="button" aria-pressed={totalMin === min} onClick={() => setDuracionManual(min)} className={opcion(totalMin === min)}>
                        {duracionLegible(min)}
                      </button>
                    ))}
                    <DuracionOtra valor={totalMin} onElegir={setDuracionManual} claseChip={opcion(false)} />
                  </div>
                  {recordada && duracionManual === null && (
                    <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-primary">
                      <Clock3 className="mt-px size-3.5 shrink-0" strokeWidth={1.6} aria-hidden="true" />
                      <span>
                        La última vez tardó {recordada.minutos} min (
                        {new Date(recordada.cuando).toLocaleDateString("es", { day: "numeric", month: "long" })}), no los {catalogoMin} de la carta. Te proponemos {recordada.minutos}.
                      </span>
                    </p>
                  )}
                  {duracionManual !== null && duracionManual !== catalogoMin && (
                    <p className="mt-2 text-[12.5px] text-muted-foreground">La carta dice {duracionLegible(catalogoMin)}: esta cita dura {duracionLegible(duracionManual)}.</p>
                  )}

                  <label className={cn(etiquetaCampo, "mt-5")} htmlFor="na-note">
                    Nota <span className="font-normal text-muted-foreground">· opcional</span>
                  </label>
                  <Textarea id="na-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Alergias, preferencias…" rows={2} />
                </section>

                {/* 3 · Resumen */}
                <section className={columna} aria-label="Resumen">
                  <h3 className={etiquetaCol}>3 · Resumen</h3>
                  <dl className="flex flex-col text-sm">
                    {[
                      ["Clienta", elegida?.name ?? (newName.trim() || "Sin elegir")],
                      ["Servicio", otro ? otro.nombre.trim() || "Otro, sin nombre" : chosen.length ? serviceLabelOf({ serviceIds }, serviceMap) : "Sin elegir"],
                      ...(soloUno ? [] : [["Con", empleado?.name ?? "—"]]),
                      ["Día", fechaLarga],
                      ["Hora", `${time}–${horaDeMinutos(minutoElegido + totalMin)}`],
                      ["Duración", duracionLegible(totalMin)],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between gap-3 border-b border-border py-2.5">
                        <dt className="text-muted-foreground">{k}</dt>
                        <dd className="text-right font-bold tabular-nums">{v}</dd>
                      </div>
                    ))}
                  </dl>
                  <div className="mt-4 flex items-baseline justify-between">
                    <span className="text-muted-foreground">Precio</span>
                    <span className="text-[28px] font-extrabold tabular-nums">{eur(total).replace(",00", "")}</span>
                  </div>
                  <p className="mt-3 flex gap-2 rounded-2xl bg-salvia-clara px-3.5 py-3 text-[12.5px] text-hoja-tinta">
                    <MessageCircle className="mt-px size-[15px] shrink-0" strokeWidth={1.6} />
                    Queda confirmada en tu agenda al guardar. Si quieres avisarla, hazlo por WhatsApp desde su ficha.
                  </p>
                  <div className="mt-auto flex flex-col gap-2 pt-5">
                    <Button type="submit" className="h-[54px] w-full text-base">
                      <Check className="size-5" strokeWidth={1.8} />
                      Guardar cita
                    </Button>
                    {allowChaining && (
                      <Button type="button" variant="outline" className="h-[42px] w-full" onClick={() => handleSubmit(true)}>
                        Guardar y crear otra
                      </Button>
                    )}
                    <Button type="button" variant="ghost" className="h-[42px] w-full" onClick={() => intentarSalir()}>
                      Cancelar
                    </Button>
                  </div>
                </section>
              </div>
              {/* Móvil: el precio y «Guardar cita» siempre a mano, abajo. */}
              <div className="fixed inset-x-0 bottom-0 z-10 flex items-center gap-3 border-t border-border bg-card px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] lg:hidden">
                <span className="min-w-0 flex-1 leading-tight">
                  <b className="block text-xl tabular-nums">{eur(total).replace(",00", "")}</b>
                  <span className="block truncate text-[12.5px] text-muted-foreground tabular-nums">{time} · {duracionLegible(totalMin)}{soloUno ? "" : ` · ${empleado?.name ?? ""}`}</span>
                </span>
                <Button type="submit" className="h-12 px-6 text-base">Guardar cita</Button>
              </div>
            </form>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>

      {/* ¿Salir con la cita a medio registrar? «Seguir» es la opción por defecto. */}
      <AlertDialog open={!!confirmarSalida} onOpenChange={(o) => !o && setConfirmarSalida(null)}>
        <AlertDialogContent className="rounded-[22px] sm:max-w-[440px]">
          <AlertDialogHeader>
            <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-melocoton text-melocoton-tinta">
              <TriangleAlert className="size-5" strokeWidth={1.6} />
            </span>
            <AlertDialogTitle className="text-xl font-extrabold">¿Seguro que quieres salir?</AlertDialogTitle>
            <AlertDialogDescription>Se perderá esta cita a medio registrar.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                const destino = confirmarSalida?.destino;
                setConfirmarSalida(null);
                cerrar();
                if (destino) void navigate({ to: destino });
              }}
            >
              Salir sin guardar
            </AlertDialogCancel>
            <AlertDialogAction autoFocus onClick={() => setConfirmarSalida(null)}>
              Seguir con la cita
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DialogoSolape
        choques={solape?.choques ?? []}
        profesional={empleado?.name ?? ""}
        abierto={!!solape}
        onCancelar={() => setSolape(null)}
        onConfirmar={() => {
          const encadenar = solape?.encadenar ?? false;
          setSolape(null);
          guardar(encadenar, { permitirSolape: true });
        }}
        carta={serviceMap}
      />
    </>
  );
}

/**
 * «Esta hora pisa otra cita». No se prohíbe —es su agenda—, pero se enseña
 * con qué choca antes de guardar. Maquetado contra el contrato de BACKEND
 * (sección E1): al confirmar se guarda con `{ permitirSolape: true }`.
 */
export function DialogoSolape({
  choques,
  profesional,
  abierto,
  onCancelar,
  onConfirmar,
  carta,
}: {
  choques: Appointment[];
  profesional: string;
  abierto: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
  carta: Parameters<typeof serviceLabelOf>[1];
}) {
  return (
    <AlertDialog open={abierto} onOpenChange={(o) => !o && onCancelar()}>
      <AlertDialogContent className="rounded-[22px] sm:max-w-[460px]">
        <AlertDialogHeader>
          <span className="mb-1 grid size-12 place-items-center rounded-2xl bg-melocoton text-melocoton-tinta">
            <TriangleAlert className="size-5" strokeWidth={1.6} />
          </span>
          <AlertDialogTitle className="text-xl font-extrabold">Esa hora pisa otra cita</AlertDialogTitle>
          <AlertDialogDescription>
            {profesional ? `${profesional} ya tiene ` : "Ya hay "}
            {choques.length === 1 ? "esta cita" : `estas ${choques.length} citas`} a esa hora. Puedes guardarla igual si sabes que os da tiempo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <ul className="overflow-hidden rounded-2xl border border-border">
          {choques.map((a) => (
            <li key={a.id} className="flex items-center gap-3 border-t border-border px-4 py-2.5 first:border-t-0">
              <span className="w-[108px] shrink-0 font-extrabold whitespace-nowrap tabular-nums">
                {hora(a.start)}–{hora(+new Date(a.start) + a.duration * 60_000)}
              </span>
              <span className="min-w-0">
                <b className="block truncate">{a.status === "blocked" ? a.note || "Bloqueo" : a.clientName}</b>
                <span className="block truncate text-[12.5px] text-muted-foreground">
                  {a.status === "blocked" ? "Tiempo bloqueado" : serviceLabelOf(a, carta)}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancelar}>Cambiar la hora</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirmar}>Guardar igual</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
