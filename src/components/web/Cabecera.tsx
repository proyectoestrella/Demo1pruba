import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NAV_WEB, enlaceCorreo } from "@/lib/sishow-web";
import { MarcaSishow } from "./Marca";

/**
 * Cabecera fija de la web oficial: logo y «Hablemos» (correo). Desde el
 * 27-09-2026 `NAV_WEB` está vacío (Tomás retiró funcionalidades, precios y
 * contacto de la vista pública; ver `src/web-archivada/README.md`), así que
 * la navegación central no pinta nada; se deja el `.map` para reactivarla
 * sin tocar esta plantilla. En móvil y tablet, un menú que se cierra solo al
 * cambiar de página.
 */
export function Cabecera() {
  const [abierto, setAbierto] = useState(false);
  const ruta = useRouterState({ select: (s) => s.location.pathname });
  useEffect(() => setAbierto(false), [ruta]);

  return (
    <header className="ws-cabecera">
      <div className="ws-contenedor flex min-h-[4.25rem] items-center justify-between gap-3">
        <Link to="/" className="flex min-h-11 items-center rounded-lg no-underline" aria-label="siShow, inicio">
          <MarcaSishow />
        </Link>
        <nav aria-label="Principal" className="hidden items-center gap-7 lg:flex">
          {NAV_WEB.map((e) => (
            <Link key={e.ruta} to={e.ruta} className="ws-nav-enlace" activeProps={{ "aria-current": "page" }}>
              {e.texto}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <a href={enlaceCorreo()} className="ws-boton ws-boton-p min-h-11 px-5 text-[0.95rem]">
            Hablemos
          </a>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-full border border-[color:var(--ws-lino-f)] text-[color:var(--ws-cafe)] lg:hidden"
            aria-expanded={abierto}
            aria-controls="ws-menu-movil"
            aria-label={abierto ? "Cerrar el menú" : "Abrir el menú"}
            onClick={() => setAbierto((a) => !a)}
          >
            {abierto ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="ws-menu-movil" aria-label="Principal" hidden={!abierto} className="ws-menu-movil lg:hidden">
        <ul className="ws-contenedor flex flex-col py-2">
          {[{ ruta: "/" as const, texto: "Inicio" }, ...NAV_WEB].map((e) => (
            <li key={e.ruta}>
              <Link
                to={e.ruta}
                className="flex min-h-12 items-center border-b border-[color:var(--ws-lino)] text-[1.05rem] font-semibold no-underline"
                activeProps={{ "aria-current": "page", className: "text-[color:var(--ws-moca)]" }}
                activeOptions={{ exact: true }}
              >
                {e.texto}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
