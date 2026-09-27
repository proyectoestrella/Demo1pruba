import { Link } from "@tanstack/react-router";
import { CORREO_SISHOW, ENLACE_PANEL_EJEMPLO, ENLACE_WEB_EJEMPLO, enlaceCorreo, enlaceWhatsapp } from "@/lib/sishow-web";
import { MarcaSishow } from "./Marca";

const TITULO = "text-[0.95rem] font-extrabold text-[color:var(--ws-cafe)]";
const ENLACE = "inline-flex min-h-10 items-center text-[color:var(--ws-cafe-m)] no-underline hover:text-[color:var(--ws-cafe)] hover:underline";

/** Pie de la web oficial: qué es siShow, páginas, contacto y legales. */
export function Pie() {
  const whatsapp = enlaceWhatsapp();
  return (
    <footer className="border-t border-[color:var(--ws-lino)] bg-[color:var(--ws-arena)]">
      <div className="ws-contenedor grid grid-cols-2 gap-x-6 gap-y-10 py-14 sm:grid-cols-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="col-span-2 max-w-sm sm:col-span-3 lg:col-span-1">
          <Link to="/" className="inline-flex min-h-11 items-center no-underline" aria-label="siShow, inicio">
            <MarcaSishow />
          </Link>
          <p className="ws-texto mt-3 text-[0.95rem]">
            Reservas online, agenda del equipo, fichas con el color de cada clienta y caja, para peluquerías y centros
            de belleza.
          </p>
          <a href={enlaceCorreo()} className="ws-enlace mt-4 inline-flex min-h-10 items-center">
            {CORREO_SISHOW}
          </a>
        </div>
        <nav aria-label="Producto">
          <p className={TITULO}>Producto</p>
          <ul className="mt-2">
            <li><Link to="/funcionalidades" className={ENLACE}>Funcionalidades</Link></li>
            <li><Link to="/precios" className={ENLACE}>Precios</Link></li>
            <li><a href={ENLACE_WEB_EJEMPLO} className={ENLACE}>Web de reservas de ejemplo</a></li>
            <li><a href={ENLACE_PANEL_EJEMPLO} className={ENLACE}>Panel de ejemplo</a></li>
          </ul>
        </nav>
        <nav aria-label="Contacto">
          <p className={TITULO}>Contacto</p>
          <ul className="mt-2">
            <li><Link to="/contacto" className={ENLACE}>Hablemos</Link></li>
            <li><a href={enlaceCorreo()} className={ENLACE}>Correo</a></li>
            {whatsapp && (
              <li><a href={whatsapp} target="_blank" rel="noopener noreferrer" className={ENLACE}>WhatsApp</a></li>
            )}
          </ul>
        </nav>
        <nav aria-label="Legal">
          <p className={TITULO}>Legal</p>
          <ul className="mt-2">
            <li><Link to="/legal/aviso-legal" className={ENLACE}>Aviso legal</Link></li>
            <li><Link to="/legal/privacidad" className={ENLACE}>Privacidad</Link></li>
            <li><Link to="/legal/cookies" className={ENLACE}>Cookies</Link></li>
          </ul>
        </nav>
      </div>
      <div className="border-t border-[color:var(--ws-lino)]">
        <div className="ws-contenedor flex flex-col gap-1 py-5 text-[0.875rem] text-[color:var(--ws-cafe-m)] sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} siShow</p>
          <p>Hecho para peluquerías y centros de belleza</p>
        </div>
      </div>
    </footer>
  );
}
