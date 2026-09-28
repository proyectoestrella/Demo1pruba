import type { SVGProps } from "react";
import { ArrowUpRight, Facebook, Instagram, Newspaper, ShoppingBag } from "lucide-react";
import { Reveal } from "@/components/Reveal";
import { TrazoTitulo } from "@/components/web-salon/Movimiento";
import { cn } from "@/lib/utils";
import { CONTENEDOR_SALON, SECCION_WEB, urlSegura, type EnlacesSalon } from "@/lib/web-publica";

/**
 * Enlaces y promoción de la web del salón (lote 18.4): WhatsApp, redes, blog,
 * tienda y boletín. Todo sale del perfil; lo que falta no se pinta.
 */

/** Logotipo de WhatsApp (Simple Icons, CC0), en `currentColor`. */
export function IconoWhatsApp(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
    </svg>
  );
}

/** Atributos de un enlace que sale de la web del salón. */
export const FUERA = { target: "_blank", rel: "noopener noreferrer" } as const;

/**
 * Instagram y Facebook como botones redondos de 44 px (objetivo táctil), con
 * nombre accesible. `tono="oscuro"` para el pie en chocolate.
 */
export function RedesSalon({
  enlaces,
  nombre,
  className,
  tono = "claro",
}: {
  enlaces: EnlacesSalon;
  nombre: string;
  className?: string;
  tono?: "claro" | "oscuro";
}) {
  const redes = [
    enlaces.instagram && { href: enlaces.instagram, label: `Instagram de ${nombre}`, Icono: Instagram },
    enlaces.facebook && { href: enlaces.facebook, label: `Facebook de ${nombre}`, Icono: Facebook },
  ].filter(Boolean) as { href: string; label: string; Icono: typeof Instagram }[];
  if (!redes.length) return null;
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {redes.map(({ href, label, Icono }) => (
        <a
          key={href}
          href={href}
          {...FUERA}
          aria-label={label}
          title={label}
          className={cn(
            "grid size-11 place-items-center rounded-full transition-colors",
            tono === "oscuro"
              ? "text-ws-caramelo hover:bg-white/10 hover:text-ws-crema"
              : "text-ws-chocolate hover:bg-ws-arena hover:text-ws-tinta",
          )}
        >
          <Icono className="h-[18px] w-[18px]" aria-hidden="true" />
        </a>
      ))}
    </div>
  );
}

/** Enlace externo en texto, con la flecha de «sale de aquí». */
export function EnlaceFuera({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <a href={href} {...FUERA} className={cn("inline-flex items-center gap-1", className)}>
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden="true" />
      <span className="sr-only"> (se abre en otra pestaña)</span>
    </a>
  );
}

const BOTON_SECUNDARIO =
  "inline-flex h-11 items-center gap-2 rounded-full border border-lino-fuerte bg-card px-5 text-sm font-semibold text-foreground transition-colors hover:bg-ws-arena";
const BOTON_PRIMARIO =
  "inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-ws-chocolate";

/**
 * Franja «Síguenos»: boletín (si el salón lo tiene), redes y blog, y tienda
 * online. Tres tarjetas del mismo peso, una acción cada una; si no hay nada
 * que enseñar, la sección no existe.
 */
export function BloqueComunidad({
  nombre,
  enlaces,
  boletin,
}: {
  nombre: string;
  enlaces: EnlacesSalon;
  boletin?: { texto: string; url: string; condiciones?: string };
}) {
  const urlBoletin = boletin?.texto?.trim() ? urlSegura(boletin.url) : undefined;
  const hayRedes = !!(enlaces.instagram || enlaces.facebook || enlaces.blog);
  const tarjetas = [urlBoletin, hayRedes, enlaces.tienda].filter(Boolean).length;
  if (!tarjetas) return null;

  return (
    <section id="siguenos" aria-labelledby="siguenos-titulo" className="bg-ws-salvia-clara">
      <div className={cn(CONTENEDOR_SALON, SECCION_WEB)}>
        <Reveal className="mb-8 md:mb-10">
          <p className="ws-etiqueta">Más de {nombre}</p>
          <h2 id="siguenos-titulo" className="mt-2 ws-titulo text-[28px] md:text-[38px]">
            Síguenos
          </h2>
          <TrazoTitulo className="mt-2" />
        </Reveal>
        <div
          className={cn(
            "grid gap-3 md:gap-4",
            tarjetas === 3 && "md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_1fr]",
            tarjetas === 2 && "md:grid-cols-2",
          )}
        >
          {urlBoletin && boletin && (
            <Reveal className={cn("h-full", tarjetas === 3 && "md:col-span-2 xl:col-span-1")}>
              <div className="flex h-full flex-col rounded-[20px] border border-lino bg-card p-5 sm:p-6">
                <p className="ws-etiqueta">Boletín</p>
                <p className="mt-2 text-lg font-bold leading-snug text-foreground text-balance">{boletin.texto}</p>
                {boletin.condiciones?.trim() ? (
                  <p className="mt-2 text-[13px] text-muted-foreground">{boletin.condiciones}</p>
                ) : null}
                <div className="mt-auto pt-5">
                  <a href={urlBoletin} {...FUERA} className={BOTON_PRIMARIO}>
                    Apuntarme al boletín <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                </div>
              </div>
            </Reveal>
          )}
          {hayRedes && (
            <Reveal delay={60} className="h-full">
              <div className="flex h-full flex-col rounded-[20px] border border-lino bg-card p-5 sm:p-6">
                <p className="ws-etiqueta">Redes y blog</p>
                <p className="mt-2 text-[15px] text-muted-foreground">Lo último de {nombre}, en sus redes y su blog.</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-5">
                  {enlaces.instagram && (
                    <a href={enlaces.instagram} {...FUERA} className={BOTON_SECUNDARIO}>
                      <Instagram className="h-4 w-4 text-ws-eucalipto" aria-hidden="true" /> Instagram
                    </a>
                  )}
                  {enlaces.facebook && (
                    <a href={enlaces.facebook} {...FUERA} className={BOTON_SECUNDARIO}>
                      <Facebook className="h-4 w-4 text-ws-eucalipto" aria-hidden="true" /> Facebook
                    </a>
                  )}
                  {enlaces.blog && (
                    <a href={enlaces.blog} {...FUERA} className={BOTON_SECUNDARIO}>
                      <Newspaper className="h-4 w-4 text-ws-eucalipto" aria-hidden="true" /> Blog
                    </a>
                  )}
                </div>
              </div>
            </Reveal>
          )}
          {enlaces.tienda && (
            <Reveal delay={120} className="h-full">
              <div className="flex h-full flex-col rounded-[20px] border border-lino bg-card p-5 sm:p-6">
                <p className="ws-etiqueta">Tienda online</p>
                <p className="mt-2 text-[15px] text-muted-foreground">Visita la tienda online de {nombre}.</p>
                <div className="mt-auto pt-5">
                  <a href={enlaces.tienda} {...FUERA} className={BOTON_SECUNDARIO}>
                    <ShoppingBag className="h-4 w-4 text-ws-eucalipto" aria-hidden="true" /> Tienda online
                    <span className="sr-only"> (se abre en otra pestaña)</span>
                  </a>
                </div>
              </div>
            </Reveal>
          )}
        </div>
      </div>
    </section>
  );
}
