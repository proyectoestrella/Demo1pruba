# siShow · «Arena» — design brief

Panel de gestión para peluquerías y salones pequeños (PeluChic: tres profesionales, dueña que
lo mira entre clienta y clienta, a menudo desde un iPad o el móvil). Su trabajo es uno: que la
dueña vea de un vistazo qué le espera hoy y lo resuelva con un toque. La interfaz es un salón
luminoso y ordenado: blancos cálidos, marrones de arena y café, y un solo verde que siempre
significa «bien».

Fuente de verdad del diseño: el prototipo aprobado del 25-09-2026 (`prototipo-arena-2026-09-25/`,
`identidad.md` + `estilos.css`). Este brief lo traduce a reglas; si discrepan, manda el prototipo.

## Tres principios que la hacen reconocible

1. **Un solo color dice «bien».** El verde salvia/hoja se reserva a lo resuelto: vino,
   confirmada, libre, hecho, ahora. Nada más es verde. Lo pendiente de la dueña («te espera»)
   no se pinta de alarma: se marca con un **borde discontinuo moca** sobre blanco o nata.
   Los avisos (alergia, no vino, color pendiente) van en melocotón y siempre con icono de
   triángulo. Así el ojo aprende tres estados y no necesita leer.
2. **Los datos llenan la pantalla, no los márgenes.** Fondo blanco, contenido a todo el ancho
   con un gutter fijo de 28 px, y el último bloque de cada página crece hasta el borde inferior.
   Calendario y «Mi página» ocupan exactamente la altura útil con scroll interno. No hay
   banda vacía a la derecha ni zona muerta abajo en 1280, 1440 ni 1920. Los paneles laterales
   (asistente, ficha, detalle de cita) **empujan** el contenido 440 px; no lo tapan.
3. **La serif solo nombra personas.** Fraunces aparece únicamente en el saludo, en el nombre de
   la clienta y en el de la profesional. Todo lo demás es Manrope. Ese contraste, y las cifras
   siempre tabulares (horas, importes, contadores), es la firma tipográfica: cálida donde hay
   una persona, exacta donde hay un número.

## Paleta (roles)

Toda la app, salvo el calendario, vive en esta escala cálida. Contrastes medidos con WCAG 2.1.

| Rol | Nombre | Hex | Dónde |
|---|---|---|---|
| Fondo de la aplicación | Blanco | `#FFFFFF` | Fondo en PC y móvil; tarjetas y paneles |
| Superficie de cabecera | Perla | `#FCFAF7` | Cabeceras de tabla, fondo de la capa «Nueva cita», pie de panel |
| Superficie hundida | Nata | `#F6F1EA` | Menú lateral, píldoras, burbujas del asistente, segmentos |
| Hover / chip neutro | Arena | `#EADFD2` | Hover del menú, chips neutros, hoja del día, burbuja «yo» |
| Barra apagada | Taupe | `#D9C7B5` | Barras de progreso, interruptor apagado, hora ocupada |
| Borde | Lino | `#EAE1D8` | Bordes de tarjeta, separadores de lista |
| Borde de campo | Lino fuerte | `#DCCFC1` | Campos, botones secundarios, chips de opción |
| Texto principal | Tinta café | `#3B2F2A` | Todo el texto base (12,4:1 sobre perla) |
| Texto sobre pastel | Café medio | `#6B5B52` | Texto sobre arena y pasteles (4,7:1) |
| Texto secundario | Café suave | `#7A6A60` | Subtítulos, etiquetas, ayuda (5,0:1 perla · 4,6:1 nata) |
| Decorativo | Moca | `#A47B5C` | Bordes «te espera», marcas de tinte, barra de gráfica. **No para texto** (3,8:1) |
| Acción | Moca fuerte | `#8A6446` | Botón principal, apartado activo, icono activo, hover `#7A5840` (5,3:1 con blanco) |
| Éxito suave | Salvia clara | `#DDE8DD` | Fila «ahora», huecos libres, chips «vino», profesional Sara |
| Éxito medio | Salvia | `#9FB8A3` | Barras de ocupación, borde de hueco al pasar |
| Éxito fuerte | Hoja | `#4F6F58` | «Vino», confirmado, botón verde, línea de «ahora», toast |
| Éxito texto | Hoja tinta | `#45624E` | Texto sobre salvia clara (5,1:1) |
| Aviso | Melocotón · borde · tinta | `#F3DED1` · `#E6C6B2` · `#7E4F33` | Solo avisos: alergias, «no vino», color pendiente (4,9:1) |
| Profesionales | María · Sara · Noelia | `#EDE2D6` · `#DDE8DD` · `#F1E4CF` | Avatares e iniciales, siempre con texto café |

### Paleta del calendario (pasteles fríos, uno por servicio)

El calendario tiene paleta propia para leerse de un vistazo sobre blanco. **El color dice el
servicio**; la fila, columna o carril dice la profesional. Texto tinta azulada `#1F2633` (≥ 12:1
sobre cualquier pastel) y secundario `#4A5363` (≥ 6,5:1).

| Servicio | Fondo | Borde izquierdo 4 px |
|---|---|---|
| Corte y peinado | `#DDEBFB` | `#5B8FD6` |
| Tinte | `#EAE3FB` | `#8E76D8` |
| Mechas / balayage | `#D7F2E6` | `#3EA67C` |
| Peinado de novia | `#FCE4ED` | `#D9728F` |
| Recogido de evento | `#FEE8D8` | `#E08A50` |
| Tratamiento capilar | `#FBF2CB` | `#C8A21F` |

Estructura: líneas `#E8ECF2` (hora) y `#F2F4F8` (media hora), separador entre profesionales
`#D3DAE5` de 2 px, cabeceras `#F7F9FC`. «Ahora»: línea añil `#3B5BDB` de 2 px con píldora de la
hora. Por confirmar: blanco con borde discontinuo de 2 px. Libre: borde discontinuo gris que al
pasar se vuelve menta `#8CCFB2` sobre `#F1FAF6`. Comida: rayado gris muy claro. Ocupación por
profesional en la vista Mes: María `#6E8FD0`, Sara `#43A07C`, Noelia `#9A82DA`, siempre con la
inicial y la cifra al lado (el color nunca va solo). Los mismos colores de servicio sirven para la
leyenda de Hoy y para «Servicios y precios».

## Tipografía (roles)

| Rol | Fuente | Peso | Tamaño | Dónde |
|---|---|---|---|---|
| Display | Fraunces | 500 | 32 px (26 en móvil) | Solo el saludo de Hoy, el nombre de la clienta en su ficha y el de la profesional |
| Título de página | Manrope | 800 | 32 / 26 px | «Clientas», «Viernes, 25 de septiembre», «Nueva cita» (24) |
| Título de tarjeta | Manrope | 800 | 16 px | Cabecera de cada tarjeta |
| Cuerpo | Manrope | 400–600 | 14 px, interlínea 1,45 | Todo el texto |
| Secundario | Manrope | 400–600 | 12,5 px | Subtítulos, descripciones, chips |
| Etiqueta | Manrope | 700 | 11 px, mayúsculas, tracking 0,06 em | Cabeceras de tabla, títulos de bloque del menú, fecha del saludo. Es la única mayúscula permitida |
| Números | Manrope | 700–800 | según contexto | Horas, importes, contadores, siempre con `tabular-nums` |
| Cifra grande | Manrope | 800 | 26 px (22 móvil) | Los cuatro indicadores de Hoy, el total de «Nueva cita» (28) |

Escala completa: 11 · 12,5 · 14 (base) · 16 · 20 · 26 · 32 px. Manrope se carga en 400–800 y
Fraunces en 400–500 desde Google Fonts; sin conexión, sans del sistema y Georgia.

## Espaciado, radios, sombras

- **Espacios base 4:** 4 · 8 · 12 · 16 · 20 · 24 · 32 px. Gutter del contenido 28 px (16 en
  móvil). Separación entre tarjetas 16 px; entre indicadores 12 px. Padding de tarjeta 16 × 20.
  Filas de lista 11 × 20. Menú lateral 244 px con padding 20 × 12.
- **Radios:** 8 (elementos pequeños) · 12 (campos, citas del calendario, enlaces del menú) ·
  16 (cajas de aviso, bloque de primeros pasos) · 20 (tarjetas e indicadores) · 999 (botones,
  píldoras, chips). El radio dice la jerarquía: cuanto más contenedor, más radio.
- **Sombras:** tarjeta `0 1px 2px rgba(59,47,42,.05)`, apenas visible; sugerencias del buscador
  `0 12px 32px rgba(59,47,42,.12)`; panel lateral `-12px 0 40px rgba(59,47,42,.10)`; popup
  `0 24px 60px rgba(59,47,42,.25)`. La sombra siempre lleva el tono café, nunca negro.
- **Alturas de control:** botón y campo 42 px; botón pequeño 34; chip 24; objetivo táctil ≥ 44 px
  en móvil. Iconos SVG propios de 24 × 24, trazo 1,6, puntas redondas, sin relleno,
  `currentColor`; 18 px en menú y botones, 15 en texto.

## Código de estado

- **Te espera** (pendiente de la dueña): borde discontinuo moca de 1,5 px sobre blanco o nata.
- **Hecho / vino / libre / ahora:** salvia y hoja.
- **Aviso:** melocotón con icono de triángulo.
- **Pausa / comida:** rayado nata. **Hueco libre:** borde discontinuo lino que pasa a salvia.

## Movimiento

Solo en respuesta a una acción: el panel lateral entra en 220 ms, el toast sube desde abajo, el
interruptor se desliza en 150 ms, el botón «+» de móvil se aparta cuando taparía un botón. Nada
se anima al cargar la página ni al hacer scroll.

## Voz

Frases cortas en segunda persona, verbos activos y sentence case. Cada botón dice lo que pasa:
«Confirmar», «Enviar 3», «Guardar cita», «Salir sin guardar». El estado vacío invita a actuar
(«Nada te espera. Cuando entre una solicitud nueva aparecerá aquí»). Nunca jerga del sistema.

## Prohibiciones explícitas

- **Nunca negro puro** ni casi negro (`#000`, `#0B0B0B`, `#111`): el texto más oscuro es
  tinta café `#3B2F2A`.
- **Nunca dorado, latón ni ámbar.** El acento es moca fuerte `#8A6446`.
- **Nunca naranja ni rojo saturado.** Los avisos son melocotón `#F3DED1` con tinta `#7E4F33`.
- **Nunca degradados**, ni en fondos, ni en botones, ni en gráficas, ni como decoración.
- **Nunca fondo oscuro.** No hay modo oscuro: la app es blanca en PC y en móvil.
- **Nunca sombras genéricas** (`rgba(0,0,0,.1)` bajo cada tarjeta). Solo las cuatro de arriba,
  en tono café, y las tarjetas casi sin sombra.
- **Nunca tarjetas vacías** ni bloques de relleno: si una tarjeta no tiene datos, enseña un
  estado vacío con una acción, o no existe.
- **Nunca márgenes muertos:** ni `max-width` que deje bandas a los lados, ni hueco al final de
  la página. El último bloque crece.
- **Nunca Inter, Inter Tight ni la sans del sistema como fuente de diseño.** Manrope para todo
  y Fraunces solo donde hay una persona.
- **Nunca color solo** para decir algo: cada color va con texto, icono o inicial.
- **Nunca mayúsculas** fuera de la etiqueta de 11 px.
- **Nunca un aviso de alarma** para lo que solo está pendiente de la dueña.

## Cómo verlo en local desde un worktree

El checkout principal sirve la demo en su puerto de siempre; cada rama de diseño se mira desde
su propio worktree, en otro puerto (la rama «Arena» usa el 8082). Tres cosas que costaron una
tarde y que no son evidentes:

1. **`node_modules` va copiado con enlaces duros, no enlazado con symlink.** Con symlink, Vite
   resuelve la ruta real y comparte la caché `.vite` del checkout principal: el HTML se sirve
   pero el entry de cliente devuelve 404 y nada hidrata. Desde el worktree:
   `rm -rf node_modules && cp -al ../../Trimly/node_modules node_modules && rm -rf node_modules/.vite`
   (medio segundo, sin ocupar espacio).
2. **Vite tiene que correr con Node 22 o superior.** Con Node 20, Supabase falla al arrancar con
   «native WebSocket not found» y el panel se queda en «Comprobando tu acceso…». Comprueba
   `node -v` antes de arrancar y, si hace falta, invoca el binario de Node 22 directamente:
   `node node_modules/.bin/vite dev --port 8082`.
3. **El `.env.local` no viaja con el worktree** (está en `.gitignore`): enlázalo desde el
   checkout principal.

Para ver la demo de PeluChic: abre primero `/s/peluchic?d=<perfil>` en ese puerto, espera tres
segundos y ve a `/app`. Las capturas de verificación se hacen a 1280, 1440, 1920 y 390 px de
ancho, midiendo la banda derecha (28 px de gutter más la barra de scroll), la zona muerta
inferior y el desborde horizontal.
