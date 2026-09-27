import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CORREO_SISHOW, REVISION_LEGAL, SITIO_URL, TITULAR, datosTitularPendientes, enlaceCorreo } from "@/lib/sishow-web";
import { IntroPagina } from "./IntroPagina";

const LEGALES = [
  { ruta: "/legal/aviso-legal" as const, texto: "Aviso legal" },
  { ruta: "/legal/privacidad" as const, texto: "Política de privacidad" },
  { ruta: "/legal/cookies" as const, texto: "Política de cookies" },
];

/**
 * Esqueleto de una página legal: título, fecha de revisión y texto a medida
 * de lectura. En escritorio, al lado, los otros textos legales y a quién
 * escribir, fijos al bajar.
 */
export function PaginaLegal({
  titulo,
  entradilla,
  children,
  despues,
}: {
  titulo: string;
  entradilla: string;
  children: ReactNode;
  /** Contenido a todo el ancho de la columna tras el texto (tablas). */
  despues?: ReactNode;
}) {
  return (
    <>
      <IntroPagina titulo={titulo} entradilla={entradilla} />
      <div className="ws-contenedor ws-seccion-s grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,46rem)_minmax(0,1fr)] lg:gap-16">
        <div>
          <article className="ws-legal text-[1.02rem] leading-relaxed">
            <p className="text-[0.95rem]">Última revisión: {REVISION_LEGAL}.</p>
            {children}
          </article>
          {despues}
        </div>
        <aside className="lg:justify-self-end" aria-label="Textos legales">
          <div className="ws-tarjeta-arena p-6 lg:sticky lg:top-24 lg:w-72">
            <p className="font-extrabold">Textos legales</p>
            <ul className="mt-2">
              {LEGALES.map((l) => (
                <li key={l.ruta}>
                  <Link
                    to={l.ruta}
                    className="inline-flex min-h-10 items-center text-[color:var(--ws-cafe-m)] no-underline hover:text-[color:var(--ws-cafe)] hover:underline"
                    activeProps={{ "aria-current": "page", className: "font-bold text-[color:var(--ws-cafe)]" }}
                  >
                    {l.texto}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-4 border-t border-[color:var(--ws-lino)] pt-4 text-[0.95rem] text-[color:var(--ws-cafe-m)]">
              ¿Dudas sobre tus datos? Escríbenos a{" "}
              <a href={enlaceCorreo("Protección de datos")} className="ws-enlace break-all">
                {CORREO_SISHOW}
              </a>
              .
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

/**
 * Datos del titular. Lo que falte se ve como pendiente, con estilo discreto;
 * el correo y el dominio sí se conocen.
 */
export function DatosTitular() {
  const faltan = datosTitularPendientes();
  return (
    <>
      {faltan.length > 0 && (
        <p className="ws-pendiente mt-4">
          <strong>Pendiente: datos del titular</strong> ({faltan.join(", ")}).
        </p>
      )}
      <ul>
        {TITULAR.nombre && <li><strong>Titular:</strong> {TITULAR.nombre}</li>}
        {TITULAR.nif && <li><strong>NIF:</strong> {TITULAR.nif}</li>}
        {TITULAR.domicilio && <li><strong>Domicilio:</strong> {TITULAR.domicilio}</li>}
        {TITULAR.registro && <li><strong>Datos registrales:</strong> {TITULAR.registro}</li>}
        <li>
          <strong>Correo:</strong>{" "}
          <a href={enlaceCorreo("Consulta legal")} className="ws-enlace">
            {CORREO_SISHOW}
          </a>
        </li>
        <li>
          <strong>Sitio web:</strong> {SITIO_URL.replace("https://", "")}
        </li>
      </ul>
    </>
  );
}
