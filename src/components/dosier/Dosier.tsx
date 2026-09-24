import type { DosierTexts } from "@/lib/dosier-content";
import { DOSIER_CSS } from "./dosier.css";

/**
 * Dosier comercial A4 de 4 páginas, personalizado por salón.
 *
 * Puerto fiel a React de `page1`..`page4` en el generador Python de
 * referencia (`gen2.py`). El bloque "Lo que nos contaste" (KNOWN) no se
 * porta: era solo para los PDF ya impresos de negocios concretos con los
 * que se había hablado, y esta ruta genera el dosier de cualquier salón que
 * se dé de alta en `/app/demos`.
 */

function ScissorsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="#B23B3B"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={22}
      height={22}
    >
      <circle cx={6} cy={6} r={3} />
      <circle cx={6} cy={18} r={3} />
      <line x1={20} y1={4} x2={8.12} y2={15.88} />
      <line x1={14.47} y1={14.48} x2={20} y2={20} />
      <line x1={8.12} y1={8.12} x2={12} y2={12} />
    </svg>
  );
}

function Page1({ t }: { t: DosierTexts }) {
  const { info } = t;
  return (
    <div className="page">
      <div className="topbar" />
      <div className="content">
        <div className="headerrow">
          <div className="logo">siShow</div>
          <ScissorsIcon />
        </div>
        <div className="eyebrow">{info.eyebrow}</div>
        <h1 className="headline" style={{ fontSize: `${t.headlineSizePt}pt` }}>
          {t.headlineL1}
          <br />
          {t.headlineL2}
        </h1>
        <p className="lead">
          siShow es el sistema de reservas y agenda pensado para el salón pequeño e independiente:{" "}
          {info.clientela} piden hora solos desde el móvil, la cita te entra a ti y la confirmas tú, y
          no pagas comisión por ninguna cita — pagues lo que pagues, es una cuota fija.
        </p>
        <div className="callout green">
          <b>Tú sigues mandando.</b> {info.personalLine} {info.personaCap} elige servicio y hora; tú
          confirmas, cambias el tiempo o se la pasas a quien mejor lo hace.
        </div>

        <h2 className="section">Lo que resuelve</h2>
        <ul className="bullets">
          <li>
            <b>Citas que fallan</b> y huecos que se quedan vacíos justo en la hora de más demanda.
          </li>
          <li>
            <b>Mensajes y llamadas a todas horas</b> para dar una hora: {info.persona} la coge{" "}
            {info.soloSola}, también a las once de la noche.
          </li>
          <li>
            <b>Comisiones y permanencias</b> de plataformas que se quedan con {info.clientela} y sus
            datos.
          </li>
        </ul>

        <h2 className="section">Lo que se queda como está</h2>
        <ul className="bullets green">
          <li>
            Tu forma de trabajar: quien quiera seguir llamando o pasándose, sigue igual, y tú lo apuntas
            en la misma agenda.
          </li>
          <li>El control de tu tiempo: cada servicio tiene su duración y cada persona del equipo su horario.</li>
          <li>Tus clientes y su historial, en tu negocio y en ningún otro sitio.</li>
        </ul>

        <div className="booking">
          <div className="booking-head">
            <div className="bname" style={{ fontSize: `${t.bookingHeaderSizePt}pt` }}>
              {t.nombre}
            </div>
            <div className="bsishow">siShow</div>
          </div>
          <div className="booking-row">
            <div className="label">Cliente</div>
            <div className="value">{t.bookingCliente}</div>
          </div>
          <div className="booking-row">
            <div className="label">Servicio</div>
            <div className="value">{t.bookingServicio}</div>
          </div>
          <div className="booking-row">
            <div className="label">Fecha</div>
            <div className="value">Vie 19 · 18:30</div>
          </div>
          <div className="booking-row" style={{ borderBottom: "none" }}>
            <div className="label">Estado</div>
            <div className="value">Pendiente de tu confirmación</div>
          </div>
          <div className="booking-foot">Sin comisión por esta cita · queda en el calendario de su móvil</div>
        </div>
        <div className="booking-caption">Ejemplo ilustrativo de cómo te entra una solicitud de cita.</div>
      </div>
      <div className="pfooter">
        <div>{t.footer}</div>
        <div>1 / 4</div>
      </div>
    </div>
  );
}

function Page2({ t }: { t: DosierTexts }) {
  const { info } = t;
  const clienteSingCap = info.clienteSing.charAt(0).toUpperCase() + info.clienteSing.slice(1);
  return (
    <div className="page">
      <div className="topbar" />
      <div className="content">
        <div className="headerrow">
          <div className="logo" style={{ fontSize: "15pt" }}>
            siShow
          </div>
          <ScissorsIcon />
        </div>
        <h1 className="title2">Así funciona siShow</h1>
        <p className="subtitle2">
          Una página de reservas con tu nombre, tus fotos y tus servicios, y un panel para llevar{" "}
          {info.lugar} — sin depender de que un marketplace decida enseñarte o no a sus usuarios.
        </p>

        <div className="steps">
          <div className="step">
            <div className="num">1</div>
            <div className="stext">
              <div className="stitle">Reservas por internet a cualquier hora, en tu propia página</div>
              <div className="sbody">
                {clienteSingCap} elige {info.serviciosLista}, con quién y a qué hora, desde el móvil y a
                cualquier hora. A ti te llega como solicitud.
              </div>
            </div>
          </div>
          <div className="step">
            <div className="num">2</div>
            <div className="stext">
              <div className="stitle">Tú confirmas y ajustas</div>
              <div className="sbody">
                Confirmas la cita con un toque, le cambias la duración o la hora si esa persona necesita
                más, o la pasas a otra persona del equipo. Nadie decide por ti.
              </div>
            </div>
          </div>
          <div className="step">
            <div className="num">3</div>
            <div className="stext">
              <div className="stitle">La cita queda en el calendario de tu cliente</div>
              <div className="sbody">
                Al reservar, se añade al calendario de su móvil (Google o Apple) y el propio móvil le
                avisa antes. Los recordatorios automáticos por mensaje llegan como extra.
              </div>
            </div>
          </div>
          <div className="step">
            <div className="num">4</div>
            <div className="stext">
              <div className="stitle">Ficha de cliente con memoria</div>
              <div className="sbody">
                Historial de citas, servicio favorito y un campo de notas para lo que solo sabe{" "}
                {info.quien}.
              </div>
            </div>
          </div>
          <div className="step">
            <div className="num">5</div>
            <div className="stext">
              <div className="stitle">Panel de analítica con asistente</div>
              <div className="sbody">
                Le preguntas en lenguaje normal —«¿qué servicio me ha dado más ingresos este mes?»— y te
                responde con los datos reales de tu negocio.
              </div>
            </div>
          </div>
          <div className="step">
            <div className="num">6</div>
            <div className="stext">
              <div className="stitle">Panel de gestión sin letra pequeña</div>
              <div className="sbody">
                Editas precios, servicios, horarios y equipo cuando quieras, sin tocar código ni llamar a
                nadie.
              </div>
            </div>
          </div>
        </div>

        <div className="pricebox">
          <div className="left">
            <div className="ptitle">
              Una cuota fija cada mes.
              <br />
              Nunca comisión por cliente.
            </div>
            <div className="psub">
              Sin comisión por reserva · Sin permanencia obligatoria · Tus clientes y sus datos se quedan
              en {info.lugar}
            </div>
          </div>
          <div className="right">
            <div className="plabel">Precio orientativo</div>
            <div className="pmain">Desde 30&nbsp;€/mes</div>
            <div className="pnote">
              + IVA · 25&nbsp;€/mes con permanencia de 3 meses · puesta en marcha 18&nbsp;€ el primer mes
            </div>
          </div>
        </div>
        <div className="pricecaption">
          Pensado para salones de 1 a 4 profesionales. El precio exacto y las condiciones se cierran
          juntos en la reunión.
        </div>
      </div>
      <div className="pfooter">
        <div>{t.footer}</div>
        <div>2 / 4</div>
      </div>
    </div>
  );
}

function Page3({ t, qrDataUri }: { t: DosierTexts; qrDataUri: string | null }) {
  const { info } = t;
  const hablamosP = `Te lo enseñamos en el móvil, con ${t.nombre} ya montado: tus fotos, tu horario y tus servicios. Sin registro previo y sin compromiso.`;
  const subtitle = "Tres situaciones que se repiten en el sector. Si alguna te suena, esto es lo que cambia con siShow.";
  return (
    <div className="page">
      <div className="topbar" />
      <div className="content">
        <div className="headerrow">
          <div className="logo" style={{ fontSize: "15pt" }}>
            siShow
          </div>
          <ScissorsIcon />
        </div>
        <h1 className="title3">¿Te suena?</h1>
        <p className="subtitle3">{subtitle}</p>

        <table className="cmp">
          <colgroup>
            <col style={{ width: "50%" }} />
            <col style={{ width: "50%" }} />
          </colgroup>
          <thead>
            <tr>
              <td>Si te pasa esto…</td>
              <td>…con siShow</td>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="sit">
                <span className="rowtitle">Citas que fallan y huecos vacíos</span>
                <ul>
                  <li>Alguien pide hora y no aparece, y ese hueco ya no se llena</li>
                  <li>
                    {info.nuevas} fallan más que {info.deSiempre}
                  </li>
                  <li>Un cambio de servicio de última hora te deja una hora parada</li>
                </ul>
              </td>
              <td className="con">
                <span className="rowtitle con-t">La cita queda en su calendario y tú tienes lista de espera</span>
                <ul>
                  <li>Al reservar, la cita se guarda en su móvil y le avisa</li>
                  <li>Si cobras señal, le llega tu texto con cómo dejarla al pedir la hora</li>
                  <li>Ves quién quería ese hueco y lo rellenas</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td className="sit">
                <span className="rowtitle">La agenda la llevas tú, y quieres seguir así</span>
                <ul>
                  <li>No todo el mundo tarda lo mismo</li>
                  <li>Tú decides quién hace cada servicio</li>
                  <li>A mediodía o en vacaciones sois menos</li>
                </ul>
              </td>
              <td className="con">
                <span className="rowtitle con-t">Tú confirmas cada cita</span>
                <ul>
                  <li>La solicitud te entra a ti: confirmas, cambias el tiempo o la pasas a otra persona</li>
                  <li>Cada servicio con su duración y cada persona con su horario</li>
                  <li>Si a las dos solo estás tú, no se ofrecen huecos que no puedes atender</li>
                </ul>
              </td>
            </tr>
            <tr>
              <td className="sit">
                <span className="rowtitle">Plataformas que cobran comisión o te atan</span>
                <ul>
                  <li>Un porcentaje por cada cliente nuevo que «te traen»</li>
                  <li>Tus clientes y su historial viven en su plataforma, no en la tuya</li>
                  <li>Permanencia de un año antes de poder irte</li>
                </ul>
              </td>
              <td className="con">
                <span className="rowtitle con-t">Cuota fija y clientes tuyos</span>
                <ul>
                  <li>30 € al mes, sin comisión, aunque llenes la agenda</li>
                  <li>Tu página con tu nombre: los datos se quedan en {info.lugar}</li>
                  <li>Sin permanencia: si no cumplimos, te vas</li>
                </ul>
              </td>
            </tr>
          </tbody>
        </table>

        <div className="hablamos">
          <div className="htext">
            <h2>¿Hablamos?</h2>
            <p>{hablamosP}</p>
            <div className="contact">
              <span className="carlos">Carlos</span> <span className="tel">+34 622 107 116</span>
              <br />
              <span className="mail">infosishow@gmail.com</span>
            </div>
          </div>
          {qrDataUri ? (
            <div className="qrbox">
              <img className="qr" src={qrDataUri} alt={`Código QR a la web de ${t.nombre}`} />
              <div className="qrcap">Escanea y verás {t.nombre} con siShow</div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="pfooter">
        <div>{t.footer}</div>
        <div>3 / 4</div>
      </div>
    </div>
  );
}

function Page4() {
  return (
    <div className="page blank4">
      <div className="topbar" />
      <div
        style={{
          position: "absolute",
          top: "12mm",
          right: "18mm",
          fontFamily: "'Big Shoulders Display', sans-serif",
          fontWeight: 700,
          fontSize: "11pt",
          color: "var(--ink)",
        }}
      >
        siShow
      </div>
      <div
        style={{
          position: "absolute",
          left: "18mm",
          bottom: "10mm",
          fontFamily: "'DM Mono', monospace",
          fontSize: "7.3pt",
          color: "var(--ink-soft)",
        }}
      >
        Carlos · +34 622 107 116 · infosishow@gmail.com
      </div>
    </div>
  );
}

export function Dosier({ texts, qrDataUri }: { texts: DosierTexts; qrDataUri: string | null }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: DOSIER_CSS }} />
      <Page1 t={texts} />
      <Page2 t={texts} />
      <Page3 t={texts} qrDataUri={qrDataUri} />
      <Page4 />
    </>
  );
}
