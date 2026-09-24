import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ExternalLink,
  Loader2,
  Monitor,
  RefreshCw,
  Smartphone,
  TriangleAlert,
} from "lucide-react";

import { useSalonStore } from "@/lib/store";
import { useRealSalonSlug } from "@/lib/use-real-salon";
import { saveSalonProfile } from "@/lib/api/salons.functions";
import { DEMO_PARAM, encodeDemoProfile } from "@/lib/demo-profile";
import {
  borradorDesdePerfil,
  hayCambios,
  perfilDesdeBorrador,
  validarBorrador,
  type BorradorLanding,
  type ErrorCampo,
} from "@/lib/landing-edit";
import { DAY_LABELS_ES } from "@/lib/opening-hours";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SalonProfile } from "@/lib/mock/types";
import { useEquipo } from "@/lib/use-equipo";

export const Route = createFileRoute("/app/web")({ component: MiWeb });

/** Anchos de la vista previa. El del móvil es un iPhone 14; el de escritorio, un portátil. */
const ANCHOS = { movil: 390, escritorio: 1280 } as const;
type Dispositivo = keyof typeof ANCHOS;

/** Milisegundos de calma antes de volver a pintar la vista previa mientras se teclea. */
const ESPERA_PREVIA_MS = 450;

function MiWeb() {
  const salonProfile = useSalonStore((s) => s.salonProfile);
  const equipo = useEquipo();
  const updateSalonProfile = useSalonStore((s) => s.updateSalonProfile);
  const realSlug = useRealSalonSlug();
  const esReal = Boolean(realSlug);
  const slugPrevia = realSlug ?? salonProfile.slug ?? "demo";

  /** Lo último que se sabe publicado: el punto al que vuelve «Descartar» y la base de «Deshacer». */
  const [publicado, setPublicado] = useState<SalonProfile>(salonProfile);
  const [borrador, setBorrador] = useState<BorradorLanding>(() =>
    borradorDesdePerfil(salonProfile),
  );
  const [errores, setErrores] = useState<ErrorCampo[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [dispositivo, setDispositivo] = useState<Dispositivo>("movil");
  /** El perfil anterior a la última publicación, mientras «Deshacer» siga en pantalla. */
  const [anterior, setAnterior] = useState<SalonProfile | null>(null);

  // El perfil real llega DESPUÉS del primer render (`useRealSalon` lo pide a
  // Supabase). Sin esto, el dueño entraba a «Mi web» y veía el borrador del
  // salón de ejemplo durante medio segundo — y si escribía en ese medio
  // segundo, publicaba encima el salón equivocado. Se recarga el borrador
  // cuando cambia el salón cargado, pero solo si no hay nada escrito sin
  // publicar: pisar lo que alguien está tecleando es peor que cualquier otra
  // cosa que pueda pasar en esta pantalla.
  const sucio = useMemo(
    () => hayCambios(borrador, borradorDesdePerfil(publicado)),
    [borrador, publicado],
  );
  const sucioRef = useRef(sucio);
  sucioRef.current = sucio;
  useEffect(() => {
    if (sucioRef.current) return;
    setPublicado(salonProfile);
    setBorrador(borradorDesdePerfil(salonProfile));
  }, [salonProfile]);

  /* ------------------------------------------------------------------ */
  /* Vista previa                                                        */
  /* ------------------------------------------------------------------ */

  // La vista previa NO es una maqueta: es la web pública de verdad, en un
  // iframe, con el borrador metido por el mismo `?d=` que ya usan los enlaces
  // de demo. Así es literalmente el mismo componente, el mismo CSS y el mismo
  // contenido que verá su cliente — si se pintara aparte, el dueño estaría
  // decidiendo sobre un dibujo.
  const perfilPrevio = useMemo<Partial<SalonProfile>>(
    () => ({
      // Las fotos de la galería y las políticas no se editan en esta
      // pantalla, pero tienen que ir en la vista previa o saldría una galería
      // vacía y unas condiciones de cancelación que no son las suyas.
      photoCount: publicado.photoCount,
      galleryPhotos: publicado.galleryPhotos,
      noShowFeeEur: publicado.noShowFeeEur,
      noShowNoticeHours: publicado.noShowNoticeHours,
      smartSpread: publicado.smartSpread,
      lastSlotBufferMin: publicado.lastSlotBufferMin,
      ...perfilDesdeBorrador(borrador),
    }),
    [borrador, publicado],
  );

  const urlPrevia = useMemo(
    () => `/s/${slugPrevia}?${DEMO_PARAM}=${encodeDemoProfile(perfilPrevio)}`,
    [slugPrevia, perfilPrevio],
  );

  // Se espera a que pare de teclear antes de recargar el iframe: una recarga
  // por pulsación deja la vista previa parpadeando y no se lee nada.
  const [urlPintada, setUrlPintada] = useState(urlPrevia);
  useEffect(() => {
    const t = setTimeout(() => setUrlPintada(urlPrevia), ESPERA_PREVIA_MS);
    return () => clearTimeout(t);
  }, [urlPrevia]);
  const alDia = urlPintada === urlPrevia;

  // Cambiar el `src` del iframe lo devuelve arriba del todo. Como es del mismo
  // origen, se puede anotar por dónde iba y volver a ese punto al terminar de
  // cargar: sin esto, editar el horario —que está a mitad de página— mandaba
  // la vista previa al hero en cada cambio.
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const scrollRef = useRef(0);
  useEffect(() => {
    try {
      scrollRef.current = iframeRef.current?.contentWindow?.scrollY ?? 0;
    } catch {
      scrollRef.current = 0;
    }
  }, [urlPintada]);
  const alCargarPrevia = useCallback(() => {
    try {
      iframeRef.current?.contentWindow?.scrollTo(0, scrollRef.current);
      // La vista previa es un móvil simulado: enseñar dentro la barra de
      // scroll gris del sistema, con sus flechas, delata que es un iframe y
      // además se come unos píxeles del ancho. Se esconde solo aquí dentro
      // (mismo origen), sin tocar la web de verdad, y el scroll sigue yendo.
      const doc = iframeRef.current?.contentDocument;
      if (doc && !doc.getElementById("previa-sin-scrollbar")) {
        const estilo = doc.createElement("style");
        estilo.id = "previa-sin-scrollbar";
        estilo.textContent =
          "html{scrollbar-width:none;-ms-overflow-style:none}html::-webkit-scrollbar{width:0;height:0;display:none}";
        doc.head.appendChild(estilo);
      }
    } catch {
      // Otro origen o iframe aún sin documento: no pasa nada, se queda arriba.
    }
  }, []);

  /* ------------------------------------------------------------------ */
  /* Publicar                                                            */
  /* ------------------------------------------------------------------ */

  function campo<K extends keyof BorradorLanding>(clave: K, valor: BorradorLanding[K]) {
    setBorrador((b) => ({ ...b, [clave]: valor }));
    // El error de un campo desaparece en cuanto se toca: dejarlo puesto
    // mientras lo está corrigiendo es regañarle por algo que ya está haciendo.
    setErrores((e) => e.filter((err) => err.campo !== clave));
  }

  async function publicar() {
    // El borrador conserva el equipo para compatibilidad con el perfil, pero
    // aquí ya no se edita: lo gestiona Equipo y admite hasta seis personas.
    const fallos = validarBorrador({ ...borrador, team: "" });
    setErrores(fallos);
    if (fallos.length > 0) {
      toast.error(
        fallos.length === 1
          ? "Hay algo que revisar antes de publicar"
          : `Hay ${fallos.length} cosas que revisar antes de publicar`,
      );
      return;
    }

    const previo = { ...publicado, team: salonProfile.team, teamHours: salonProfile.teamHours, teamIds: salonProfile.teamIds };
    const parche = perfilDesdeBorrador(borrador);
    // El equipo se edita en una sola pantalla. No guardar una copia antigua
    // de nombres ni horarios cuando se publica otro cambio de la web.
    const { team: _equipoSinEditar, ...parcheWeb } = parche;
    const nuevo: SalonProfile = { ...salonProfile, ...parcheWeb };

    if (!esReal || !realSlug) {
      // Demo de venta: el perfil vive dentro del enlace, no en ninguna tabla.
      // Se aplica en este navegador para que el resto del panel lo vea, pero
      // NO se promete nada que no sea cierto.
      updateSalonProfile(parcheWeb);
      setPublicado(nuevo);
      setAnterior(previo);
      toast.success("Cambios aplicados en esta demo", {
        description: "No se ha publicado nada: una demo no tiene web propia que actualizar.",
      });
      return;
    }

    setGuardando(true);
    try {
      // Se espera al servidor ANTES de tocar nada local: si esto falla, lo
      // escrito sigue en su caja y la web pública no se ha movido.
      const res = await saveSalonProfile({
        data: { slug: realSlug, profile: nuevo as unknown as Record<string, unknown> },
      });
      if (!res.synced) {
        toast.error(
          res.motivo === "sin-backend"
            ? "No se ha publicado: este siShow todavía no está conectado a su base de datos."
            : "No se ha publicado: falta aplicar una parte de la base de datos.",
          { description: "Lo que has escrito sigue aquí. Avísanos y lo dejamos listo." },
        );
        return;
      }
      // Ya está arriba: ahora sí se aplica en el panel. Esto vuelve a subirlo
      // por la vía de siempre (`pushSalonProfile`), que es el mismo upsert —
      // repetirlo no cambia nada y mantiene una sola forma de escribir.
      updateSalonProfile(parcheWeb);
      setPublicado(nuevo);
      setAnterior(previo);
      toast.success("Publicado: tu web ya muestra estos cambios", {
        description: "Cualquiera que abra tu enlace lo ve ya.",
      });
    } catch (err) {
      console.error("No se pudo publicar el perfil:", err);
      toast.error("No se ha podido publicar", {
        description:
          "No se ha cambiado nada de tu web y no has perdido lo escrito. Comprueba la conexión y vuelve a darle a Publicar.",
      });
    } finally {
      setGuardando(false);
    }
  }

  async function deshacer() {
    if (!anterior) return;
    const volver = anterior;
    if (esReal && realSlug) {
      setGuardando(true);
      try {
        const res = await saveSalonProfile({
          data: { slug: realSlug, profile: volver as unknown as Record<string, unknown> },
        });
        if (!res.synced) {
          toast.error("No se ha podido deshacer: tu web sigue con el último cambio publicado.");
          return;
        }
      } catch (err) {
        console.error("No se pudo deshacer el perfil:", err);
        toast.error("No se ha podido deshacer", {
          description: "Tu web sigue con el último cambio publicado. Inténtalo otra vez.",
        });
        return;
      } finally {
        setGuardando(false);
      }
    }
    updateSalonProfile(volver);
    setPublicado(volver);
    setBorrador(borradorDesdePerfil(volver));
    setErrores([]);
    setAnterior(null);
    toast.success("Deshecho: tu web ha vuelto a como estaba");
  }

  function descartar() {
    setBorrador(borradorDesdePerfil(publicado));
    setErrores([]);
  }

  const errorDe = (clave: keyof BorradorLanding) =>
    errores.filter((e) => e.campo === clave).map((e) => e.mensaje);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Mi web"
        description="Lo que ven tus clientes cuando abren tu enlace. Cámbialo aquí y míralo al momento."
      />

      {!esReal && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <p>
            <strong>Esto es una demo de venta.</strong> Aquí no hay ninguna web publicada que
            actualizar: los cambios se ven en la vista previa y en esta tablet, pero no salen a
            internet. Cuando el salón esté dado de alta, este mismo botón publica de verdad.
          </p>
        </div>
      )}

      {errores.length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm"
        >
          <p className="font-medium">
            {errores.length === 1
              ? "Hay algo que revisar antes de publicar:"
              : `Hay ${errores.length} cosas que revisar antes de publicar:`}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {errores.map((e, i) => (
              <li key={`${e.campo}-${i}`}>{e.mensaje}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Barra de acciones. Pegajosa arriba: en un iPad, con el editor largo,
          el botón de publicar tiene que estar siempre a un dedo. */}
      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-card/95 p-3 backdrop-blur">
        <Button
          onClick={publicar}
          disabled={guardando || !sucio}
          className="min-h-11 flex-1 sm:flex-none"
        >
          {guardando ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {esReal ? "Publicar cambios" : "Aplicar en la demo"}
        </Button>
        <Button
          variant="outline"
          onClick={descartar}
          disabled={guardando || !sucio}
          className="min-h-11"
        >
          Descartar
        </Button>
        {anterior && (
          <Button variant="outline" onClick={deshacer} disabled={guardando} className="min-h-11">
            <RefreshCw className="h-4 w-4" />
            Deshacer
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {sucio ? "Cambios sin publicar" : "Todo publicado"}
        </span>
      </div>

      {/* `min-w-0` en la rejilla y en sus dos columnas: sin él, la columna de
          la vista previa impone su ancho real (390 px del móvil simulado) como
          ancho mínimo de la única columna que hay en móvil, y la pantalla
          entera se iba 42 px a la derecha con los campos cortados. */}
      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ---------------- Editor ---------------- */}
        <div className="min-w-0 space-y-5">
          <Bloque titulo="Lo primero que se ve">
            <Campo
              etiqueta="Nombre del salón"
              valor={borrador.name}
              onChange={(v) => campo("name", v)}
              errores={errorDe("name")}
            />
            <Campo
              etiqueta="Tipo de negocio"
              valor={borrador.tagline}
              onChange={(v) => campo("tagline", v)}
              pista="El rótulo bajo el nombre: «Barbería clásica», «Peluquería y estética»."
            />
            <CampoLargo
              etiqueta="Presentación"
              valor={borrador.about}
              onChange={(v) => campo("about", v)}
              filas={3}
              pista="El párrafo bajo el titular y en el pie de la web."
            />
            <Campo
              etiqueta="Especialidades"
              valor={borrador.specialties}
              onChange={(v) => campo("specialties", v)}
              pista="Separadas por comas. Van rotando tras «Especialistas en»."
            />
            <Campo
              etiqueta="Foto de portada (enlace)"
              valor={borrador.heroImage}
              onChange={(v) => campo("heroImage", v)}
              errores={errorDe("heroImage")}
              pista="Vacío usa una foto de ejemplo. Tiene que acabar en .jpg, .png o .webp."
            />
          </Bloque>

          <Bloque titulo="Cómo te encuentran">
            <Campo
              etiqueta="Dirección"
              valor={borrador.address}
              onChange={(v) => campo("address", v)}
              pista="Mueve también el mapa de «Cómo llegar»."
            />
            <Campo
              etiqueta="Teléfono"
              valor={borrador.phone}
              onChange={(v) => campo("phone", v)}
              errores={errorDe("phone")}
              tipo="tel"
            />
            <Campo
              etiqueta="Instagram"
              valor={borrador.instagram}
              onChange={(v) => campo("instagram", v)}
            />
          </Bloque>

          <Bloque titulo="Tus reseñas de Google">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Nota"
                valor={borrador.rating}
                onChange={(v) => campo("rating", v)}
                errores={errorDe("rating")}
                pista="De 0 a 5. Sale junto al nombre, arriba del todo."
              />
              <Campo
                etiqueta="Nº de reseñas"
                valor={borrador.reviewCount}
                onChange={(v) => campo("reviewCount", v)}
                errores={errorDe("reviewCount")}
              />
            </div>
          </Bloque>

          <Bloque titulo="Horario">
            <div className="grid gap-2 sm:grid-cols-2">
              {DAY_LABELS_ES.map((etiqueta, i) => (
                <div key={etiqueta} className="flex items-center gap-2">
                  <span className="w-20 shrink-0 text-xs text-muted-foreground">{etiqueta}</span>
                  <Input
                    aria-label={etiqueta}
                    value={borrador.openingHours[i] ?? ""}
                    onChange={(e) =>
                      campo(
                        "openingHours",
                        borrador.openingHours.map((v, j) => (j === i ? e.target.value : v)),
                      )
                    }
                    placeholder="10:00–14:00, 17:00–20:00 · o Cerrado"
                    className="h-11 font-mono text-xs"
                  />
                </div>
              ))}
            </div>
            <Fallos mensajes={errorDe("openingHours")} />
            <p className="text-xs text-muted-foreground">
              Sale en la píldora «Abierto · cierra a las…», en «Cómo llegar» y en el pie.
            </p>
          </Bloque>

          <Bloque titulo="Servicios y precios">
            <CampoLargo
              etiqueta="Tu carta"
              valor={borrador.menu}
              onChange={(v) => campo("menu", v)}
              errores={errorDe("menu")}
              filas={6}
              mono
              pista="Un servicio por línea: Nombre | minutos | precio. Puedes añadir el grupo al final: «Corte | 30 | 15 | Cortes». Déjalo vacío para usar la carta de ejemplo."
            />
          </Bloque>

          <Bloque titulo="Equipo">
            <p className="text-sm text-muted-foreground">Este equipo también aparece en tus reservas. Cambia nombres, especialidades y horarios desde su pantalla.</p>
            <ul className="mt-3 space-y-1 text-sm">{equipo.map((persona) => <li key={persona.id}>{persona.name}{persona.specialty ? ` · ${persona.specialty}` : ""}</li>)}</ul>
            <Link to="/app/employees" className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-primary">Editar equipo y horarios</Link>
          </Bloque>

          <Bloque titulo="Preguntas frecuentes">
            <CampoLargo
              etiqueta="Lo que te preguntan siempre"
              valor={borrador.faq}
              onChange={(v) => campo("faq", v)}
              errores={errorDe("faq")}
              filas={6}
              pista="Una por línea: Pregunta | Respuesta. Vacío deja las cuatro que la app escribe sola a partir de tu política de cancelación."
            />
          </Bloque>

          <Bloque titulo="Franjas prioritarias">
            <CampoLargo
              etiqueta="Las horas que quieres llenar primero"
              valor={borrador.priorityHours}
              onChange={(v) => campo("priorityHours", v)}
              errores={errorDe("priorityHours")}
              filas={3}
              mono
              pista="Una por línea, hasta tres: 10:00-13:00. Se ofrecen las primeras al reservar; el resto siguen disponibles en «Ver todas las horas»."
            />
          </Bloque>
        </div>

        {/* ---------------- Vista previa ---------------- */}
        <div className="min-w-0 lg:sticky lg:top-32 lg:h-[calc(100vh-11rem)]">
          <div className="flex h-full min-w-0 flex-col rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="mb-3 flex items-center gap-2">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Tu web, de verdad
              </p>
              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant={dispositivo === "movil" ? "default" : "outline"}
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => setDispositivo("movil")}
                  aria-label="Ver en móvil"
                  title="Ver en móvil"
                >
                  <Smartphone className="h-4 w-4" />
                </Button>
                <Button
                  variant={dispositivo === "escritorio" ? "default" : "outline"}
                  size="icon"
                  className="h-11 w-11"
                  onClick={() => setDispositivo("escritorio")}
                  aria-label="Ver en ordenador"
                  title="Ver en ordenador"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" className="h-11 w-11" asChild>
                  <a
                    href={urlPintada}
                    target="_blank"
                    rel="noreferrer"
                    aria-label="Abrir la vista previa en otra pestaña"
                    title="Abrir en otra pestaña"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </div>

            <Marco ancho={ANCHOS[dispositivo]}>
              <iframe
                ref={iframeRef}
                key={dispositivo}
                src={urlPintada}
                onLoad={alCargarPrevia}
                title="Vista previa de tu web"
                className="h-full w-full border-0 bg-background"
              />
            </Marco>

            <p className="mt-2 text-center text-xs text-muted-foreground">
              {alDia
                ? dispositivo === "movil"
                  ? "Así la ven desde el móvil, que es por donde entran casi todos."
                  : "Así la ven desde un ordenador."
                : "Actualizando la vista previa…"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * El marco de la vista previa: se pinta a su ancho real (390 o 1280 px) y se
 * ESCALA para caber en el hueco disponible. Escalar y no encoger es la única
 * forma de que lo que se ve sea la maquetación de verdad de ese ancho: si se
 * dejara el iframe al ancho del panel, las media queries de Tailwind darían
 * otra maquetación y la vista previa mentiría.
 */
function Marco({ ancho, children }: { ancho: number; children: React.ReactNode }) {
  const hueco = useRef<HTMLDivElement | null>(null);
  const [escala, setEscala] = useState(1);
  const [alto, setAlto] = useState(720);

  useEffect(() => {
    const el = hueco.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const medir = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0) setEscala(Math.min(1, w / ancho));
      if (h > 0) setAlto(h);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ancho]);

  return (
    <div ref={hueco} className="min-h-[480px] w-full min-w-0 flex-1 overflow-hidden">
      {/* Envoltorio al tamaño YA escalado: es lo que ocupa sitio y lo que se
          centra. Dentro va el marco a su tamaño real, escalado desde la
          esquina — centrar un elemento más ancho que su hueco no funciona. */}
      <div
        className="mx-auto h-full overflow-hidden rounded-xl border border-border shadow-sm"
        style={{ width: ancho * escala }}
      >
        <div
          style={{
            width: ancho,
            height: escala > 0 ? alto / escala : alto,
            transform: `scale(${escala})`,
            transformOrigin: "top left",
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function Bloque({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-border/60 bg-card p-5">
      <h2 className="text-xs uppercase tracking-widest text-muted-foreground">{titulo}</h2>
      {children}
    </section>
  );
}

function Fallos({ mensajes }: { mensajes: string[] }) {
  if (mensajes.length === 0) return null;
  return (
    <ul className="space-y-1 text-xs text-destructive">
      {mensajes.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  pista,
  errores = [],
  tipo = "text",
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  pista?: string;
  errores?: string[];
  tipo?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{etiqueta}</Label>
      <Input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={errores.length > 0}
        className={cn("h-11", errores.length > 0 && "border-destructive")}
      />
      <Fallos mensajes={errores} />
      {pista ? <p className="text-xs text-muted-foreground">{pista}</p> : null}
    </div>
  );
}

function CampoLargo({
  etiqueta,
  valor,
  onChange,
  pista,
  errores = [],
  filas = 4,
  mono = false,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  pista?: string;
  errores?: string[];
  filas?: number;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-widest text-muted-foreground">{etiqueta}</Label>
      <Textarea
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        rows={filas}
        aria-invalid={errores.length > 0}
        className={cn(
          "resize-y",
          mono && "font-mono text-xs",
          errores.length > 0 && "border-destructive",
        )}
      />
      <Fallos mensajes={errores} />
      {pista ? <p className="text-xs text-muted-foreground">{pista}</p> : null}
    </div>
  );
}
