---
resumen: Auditoría visual de la web pública de PeluChic (portada y flujo de reserva hasta la confirmación) a 1440, 1024 y 390 px, antes del lote 17.
fecha: 2026-09-26
base: rama codex/arena-frontend, 5f09b90 (igual que main en producción)
---

# Auditoría visual · web pública de PeluChic (lote 17)

Vistas revisadas con el enlace de demo `?d=` de PeluChic: `/s/peluchic` completa y el flujo
`/s/peluchic/book` → paso 1 (servicio) → paso 2 (estilista) → paso 3 (fecha y hora) → paso 4
(tus datos) → `/confirmation`. Anchos 1440, 1024 y 390 (Chrome sin cabeza; a 390 el
navegador reserva 15 px de barra de desplazamiento, por eso las capturas miden 375).

Cómo se midió: capturas de página completa (`antes-landing-*.png`, `antes-reserva-*.png`,
`antes-confirmacion-*.png`) y recortes por fallo (`antes-NN-*.png`); contraste WCAG 2.1
calculado sobre el color computado y, en la portada, sobre los píxeles reales de la foto;
objetivos táctiles, desbordes e imágenes con un script en el navegador; Lighthouse 12.8.2
sobre build de producción servida en local.

## Fallos

| # | Qué está mal | Dónde | Medida | Captura |
|---|---|---|---|---|
| 1 | **Secciones a opacidad 0.** `Reveal` pinta todo con `opacity-0` desde el servidor y solo lo enseña al cruzar el 15 % del elemento: sin JS, al saltar por un ancla, en la vista previa de WhatsApp o en una captura completa, media página sale en blanco (servicios, carta, galería, equipo, reseñas, FAQ, ubicación, CTA). | Portada, todos los anchos | 8 de 10 secciones invisibles sin recorrer | `antes-01-secciones-invisibles-1440.png` |
| 2 | **Especialidad ilegible en la portada.** «Especialistas en *eventos*»: la palabra va en moca fuerte sobre el velo café de la foto. | Portada | **1,15:1** (mínimo AA 3:1 en grande) | `antes-02-portada-1440.png`, `antes-02-portada-390.png` |
| 3 | **Icono de la dirección invisible** (moca sobre velo café) y bloque de la dirección con sangría distinta al resto. | Portada | icono ≈ 1,2:1 | `antes-02-portada-390.png` |
| 4 | **Animaciones que no terminan:** brillo infinito en «Cerrado hoy», en «Reservas en menos de un minuto» y en los dos botones `ShimmerButton`; palabra que rota cada 2,2 s; nombre que entra con desenfoque y rebote (spring, 1,4 s). DESIGN.md prohíbe rebotes y más de 600 ms. | Portada, CTA final | 4 animaciones en bucle | `antes-02-portada-1440.png` |
| 5 | **Nota con punto inglés:** «4.5» en vez de «4,5». | Portada, reseñas | — | `antes-02-portada-390.png` |
| 6 | **Cinta que se mueve con el scroll** (`ScrollVelocity`): prohibido por DESIGN.md («animar al hacer scroll») y con texto a **3,16:1** (Lighthouse). La barra de info de debajo repite dirección y teléfono que ya están en la portada; a 390 ocupa 158 px. | Bajo la portada | 3,16:1 | `antes-05-cinta-1440.png`, `antes-05-cinta-390.png` |
| 7 | **Servicios destacados con hueco muerto:** icono de tijeras (de barbería), descripción vacía que estira la tarjeta, haz de luz (`BorderBeam`) y foco que sigue al ratón. En 390 cada tarjeta mide 200 px para decir nombre, precio y minutos. | Servicios | — | `antes-07-destacados-1440.png`, `antes-07-destacados-390.png` |
| 8 | **Carta completa:** contador «6» pegado a la flecha del acordeón; flecha de cada fila solo visible al pasar el ratón (en móvil nunca). | Carta | — | `antes-08-carta-1440.png` |
| 9 | **Galería descompensada:** 6 fotos en rejilla de 4 columnas, la segunda fila queda con dos huecos. Imágenes sin `width`/`height` ni `loading="lazy"`. | Galería | 6 imágenes sin tamaño | `antes-09-galeria-1440.png` |
| 10 | **Tipografía inconsistente:** títulos de sección en Fraunces (DESIGN.md: la serif solo nombra personas), eyebrow en moca con tracking 0,25 em; tamaños de título 30/36 frente a escala 26/32. | Todas las secciones | — | `antes-landing-1440.png` |
| 11 | **Reseñas:** marquesina infinita en dos filas, tarjetas cortadas por la máscara, etiqueta «Ejemplo» montada sobre la cita, y un aviso **dirigido a la dueña** («sustitúyelas por las reseñas reales de tu salón») visible para las clientas. `aria-label` en `span` sin rol (fallo de Lighthouse). | Reseñas | 12 fallos aria | `antes-11-resenas-1440.png`, `antes-11-resenas-390.png` |
| 12 | **Mapa en blanco:** el iframe de Google Maps se pinta como un rectángulo vacío hasta que carga (y en capturas y conexiones lentas no carga); además pesa y resta rendimiento. Instagram aparece como icono sin texto. | Ubicación | — | `antes-12-ubicacion-mapa-1440.png`, `antes-12-ubicacion-mapa-390.png` |
| 13 | **Pie:** icono de Instagram suelto sin cuenta; «Términos · Política de cancelación» parecen enlaces y no lo son; enlace «Privacidad» de 17 px de alto. | Pie | 57 × 17 px | `antes-13-pie-390.png` |
| 14 | **CTA final:** círculos con iniciales que no dicen nada, brillo infinito en el botón, y un espaciador fijo de 80 px en móvil. | CTA final | — | `antes-14-cta-final-1440.png` |
| 15 | **Banda vacía bajo el pie** en el flujo de reserva: el hueco de la barra fija se aplica también al pie. | Reserva, 1440 | 24 px | `antes-15-hueco-bajo-pie-1440.png` |
| 16 | **Objetivos táctiles < 44 px en móvil:** «Reservar» de la cabecera 86 × 34, logo 113 × 36, teléfonos 20 px de alto, «Otro calendario (.ics)» 16 px, «Atrás» 20 px, selects del paso 4 40 px. | 390 | 7 elementos | `antes-16-cabecera-movil-390.png` |
| 17 | **Imágenes sin tamaño fijo ni carga diferida:** 13 `<img>` sin `width`/`height` o sin `loading="lazy"` (logos, galería, avatares). | Portada | 13 | — |
| 18 | **Reserva desalineada con la cabecera:** la cabecera usa `max-w-7xl` y el flujo `max-w-6xl`; a 1440 el título empieza 58 px más a la derecha que el logo, y los puntos del paso no se alinean con el título (158 frente a 164 px). | Reserva | 58 px | `antes-18-reserva-alineacion-1440.png` |
| 19 | **Calendario sin centrar:** en 390 ocupa 250 de 350 px de su tarjeta y deja una banda vacía a la derecha; la hora queda debajo de la barra fija. Rótulos del calendario en inglés para lectores de pantalla («Go to the Previous Month», «Today»). | Paso 3 | — | `antes-19-calendario-390.png` |
| 20 | **Barra fija que corta el texto:** en el paso 4 dice «Corte y pein… 25,00 € a…» porque el botón «Confirmar reserva — 25,00 €» se come el ancho. | Paso 4, 390 | — | `antes-20-barra-y-senal-390.png` |
| 21 | **Mensaje de la señal repetido:** en el paso 4 sale en el resumen («Señal de 20,00 €, se descuenta del precio»), en la caja de abajo (texto largo) y en el resumen lateral; en la confirmación otra vez. | Paso 4, confirmación | 3 veces | `antes-20-barra-y-senal-390.png` |
| 22 | **Botón «Continuar» desactivado ilegible:** blanco sobre moca al 50 %. | Pasos 1–3 | ≈ 2,1:1 | `antes-reserva-paso1-390.png` |
| 23 | **Confirmación:** caja de la señal en miel/ámbar (DESIGN.md: nunca ámbar), confeti decorativo, aviso emergente casi negro que tapa la tarjeta y enseña la fecha en formato máquina («2026-09-26 a las 12:30»). | Confirmación | — | `antes-23-confirmacion-390.png` |
| 24 | **Anglicismo en el menú:** «FAQ». | Cabecera | — | `antes-landing-1440.png` |
| 25 | **Rendimiento móvil:** Lighthouse móvil **48** (LCP 5,4 s, TBT 990 ms); la portada de respaldo pesa 335 KB y cinco librerías de animación (motion, marquesinas, brillos) cargan en la primera vista. | Portada, build de producción | perf 48 · a11y 93 | — |

## Medidas de partida (build de producción, local)

| Lighthouse | Rendimiento | Accesibilidad | LCP | CLS | TBT |
|---|---|---|---|---|---|
| Móvil | 48 | 93 | 5,4 s | 0 | 990 ms |
| Escritorio | 81 | 96 | 1,9 s | 0 | 250 ms |

Fallos de accesibilidad: `aria-prohibited-attr` (estrellas de las reseñas) y `color-contrast`
(cinta, 3,16:1).

## Observaciones fuera del alcance visual

- En el paso 3, a las 19:05 del sábado 26, se ofreció «Lo antes posible: hoy a las 12:30»
  (el sábado cierra a las 14:00). Es lógica de huecos, no de presentación: se anota para
  BACKEND/lógica y no se toca en este lote.
- La confirmación lleva `employeeId=mario` en la URL aunque la estilista sea María: es el id
  interno del catálogo de ejemplo, no se enseña a la clienta.
