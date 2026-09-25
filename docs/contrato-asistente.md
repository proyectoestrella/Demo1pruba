# Contrato del motor del asistente para FRONTEND

Rama `codex/peluchic-backend`, carpeta `src/lib/asistente/`. Es un motor sin IA: normaliza, reconoce entidades, compara con el catálogo y responde con los datos del salón. Nunca inventa. Las piezas son funciones puras con pruebas. El motor no importa nada de la pantalla: recibe los datos por una interfaz inyectada.

## 1. Cómo se usa

```ts
import { crearAsistente } from "@/lib/asistente/responder";
import { crearFuentesPanel } from "@/lib/asistente/fuentes-panel"; // el adaptador de FRONTEND

const asistente = crearAsistente(crearFuentesPanel(leer, equipo, { plan, enlace }));
asistente.precalentar();                    // al abrir el panel, en un momento libre
const r = asistente.responder("¿y mañana?"); // RespuestaAsistente
asistente.reiniciar();                      // olvida el contexto de la conversación
```

- **`precalentar()` hay que llamarlo al abrir el panel**, por ejemplo en un `useEffect` o en `requestIdleCallback` al montar el chat. Prepara el catálogo, los índices y los cálculos de marketing, y con 3.300 citas tarda unos 300 ms. Después, cada pregunta tarda menos de 20 ms. Si no se llama, la primera pregunta tarda esos 300 ms, y la primera de marketing unos 100 ms más. Si cambian los datos, basta con volver a crear el asistente; los cálculos de marketing se renuevan solos cada cuarto de hora.
- **Contexto.** El asistente recuerda la última intención y sus entidades. «¿Y mañana?», «¿y Noelia?» o «¿y la semana que viene?» repiten la pregunta anterior con el dato nuevo. La charla borra el contexto.
- **Las fuentes** (`FuentesAsistente`, en `fuentes.ts`) son la única dependencia. BACKEND tiene la suya en `fuentes-backend.ts`. Lo que una fuente no sabe devuelve `null` y el asistente dice «Eso no lo tengo apuntado».

## 2. Las cuatro formas de respuesta

```ts
type RespuestaAsistente =
  | { tipo: "respuesta"; intencion: string; texto: string; cifras: Cifra[]; acciones: Accion[]; sugerencias: string[];
      tambien?: { intencion: string; texto: string } }
  | { tipo: "elegir"; intencion: string | null; texto: string; opciones: { etiqueta: string; pregunta: string }[] }
  | { tipo: "no-se"; texto: string; sugerencias: string[] }          // siempre 3
  | { tipo: "escalar"; intencion: string; texto: string; pasos: string[]; guia: string | null;
      contacto: { cierre: string; correo: string; mensaje: string } };

interface Cifra { etiqueta: string; valor: number; unidad?: "citas" | "€" | "%" | "min" | "clientas" | "veces" | "dias" | "huecos" | "señales" }
```

- **`respuesta`.** El texto va con la cifra primero y en negrita Markdown (`**18 citas**`), en frases cortas y en segunda persona. `acciones` trae como mucho una. `sugerencias` son preguntas ya escritas, con signos y tildes, para ponerlas en botones.
- **`tambien`.** Aparece cuando la pregunta también se parecía a una función que el plan del salón no incluye, por ejemplo «¿puedo descargarme el resumen del mes?», que puede ser el Excel o el informe por correo. Se responde lo que sí hay y `tambien.texto` («Si te referías a recibir el informe del mes por correo, eso llega con el plan **Todo incluido**: escríbenos a …») ya va al final de `texto`. El campo sirve por si el panel lo quiere pintar aparte.
- **`elegir`.** Aparece cuando falta la clienta, la profesional o el servicio. También cuando el nombre corresponde a varias clientas («Tengo 5 Martas…») o cuando dos intenciones quedan empatadas. Cada opción trae la `pregunta` que hay que volver a mandar a `responder()` al pulsarla, por ejemplo «¿Qué color le pusimos a Marta Ruiz?». Con `opciones: []` se pide escribir el nombre.
- **`no-se`.** El texto es «No lo sé seguro, pero quizá buscabas:» y lleva tres sugerencias.
- **`escalar`.** Se usa para dudas técnicas y funciones fuera de plan, y sigue el orden que pidió Tomás:
  1. `texto`: «Prueba esto:» o «Eso llega con el plan **Todo incluido**. Mientras tanto, puedes hacer esto:».
  2. `pasos`, en orden.
  3. `guia`, con número y título, por ejemplo «§9 Ajustes» o «§6 Equipo y §8 Mi página de reservas».
  4. `contacto`: primero el `cierre` («Si sigue sin ir, escríbenos a» o «Si quieres activarlo, escríbenos a»), luego el `correo` (`ejemplo@sishow.com`) y por último el `mensaje` tipo, con el nombre del salón.
- **Plan.** El plan del salón viene de `estado().plan`. Con el plan `reservas`, toda pregunta de negocio se escala a «añadir el asistente».
- **Datos de salud.** Una pregunta con alergias, embarazo o medicación recibe siempre «Eso no lo guarda siShow: son datos de salud y se preguntan en persona.»

## 3. Acciones

```ts
interface Accion {
  tipo: "ver-calendario" | "ver-hoja" | "abrir-ficha" | "abrir-cita" | "nueva-cita" | "ver-seccion"
      | "copiar" | "whatsapp" | "descargar" | "escribir-soporte";
  etiqueta: string;        // con verbo: «Ver calendario», «Abrir ficha», «Confirmar la primera»
  dia?: string;            // «AAAA-MM-DD» del salón
  clientaId?: string;
  citaId?: string;
  profesionalId?: string;
  destino?: string;        // sección («Marketing», «Ajustes › Señal»), texto a copiar o rango a descargar
}
```

La traducción a rutas del panel es de FRONTEND. `ver-seccion` nombra la pantalla tal como aparece en la guía de uso.

## 4. Qué hace cada pieza

| Fichero | Qué hace |
|---|---|
| `normalizar.ts` | Quita tildes y signos, expande abreviaturas («q», «mñn», «xq»), escribe los números en cifras y saca raíces ligeras |
| `parecido.ts` | Frases del salón y sinónimos. Parecido ponderado por lo raro que es cada palabra en el catálogo (IDF), tolerante a faltas |
| `entidades.ts` | Reconoce fechas y periodos, franja, hora, profesional, servicio y clienta. Una palabra del vocabulario nunca se toma por una clienta aunque se parezca («renta» no es «Renata») |
| `mascara.ts` | Cambia las entidades por marcas antes de comparar, igual en ejemplos y preguntas |
| `pistas.ts` | Reglas legibles que refuerzan una intención cuando aparece su expresión característica, incluidos los marcadores de plan |
| `anclas.ts` | Mínimo de vocabulario del salón: sin él solo caben la charla y la ayuda, y lo demás es «No lo sé seguro» |
| `especificacion.ts` | El catálogo de `preguntas-universo.md`, generado: 120 intenciones con sus ids exactos |
| `intenciones.ts` | Entidades que exige cada intención, plan mínimo, ejemplos extra, preguntas limpias y reencaminado por entidades |
| `resolutores/` | Un resolutor puro por cada una de las 84 intenciones de negocio |
| `responder.ts` | Todo junto: salud, contexto, clasificación, entidades que faltan, charla, plan y técnica |
| `guia.ts` | «Cómo usar el asistente» sin plan ni técnicas, y los títulos de los apartados de la guía |
| `fuentes.ts` / `fuentes-backend.ts` | La interfaz inyectada y el adaptador de esta rama |
| `reloj.ts` | Día y hora del salón con caché: la zona horaria sin coste por cita |

## 5. Pendiente de conectar (marcado CONECTAR)

- **`colores()` en `fuentes-backend.ts`** devuelve `null`. Los nombres de color en palabras están en la rama de FRONTEND.
- **`calendarioSuscrito()`** es `null` en un salón real, porque el token vive en el servidor. El asistente explica cómo activarlo.
- **El enlace de reservas** usa por defecto `/s/<slug>`. El panel le pasa el enlace completo.
