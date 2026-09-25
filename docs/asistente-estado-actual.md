# El asistente del panel hoy: qué hace y dónde falla

Auditoría del 25/09/2026 sobre la rama `codex/peluchic-backend` @9cfe506, paso 0 del lote 7. Solo lectura. Las pruebas de la sonda se hicieron con los datos de ejemplo (`mock/seed`, unas 3.300 citas) el 25/09 a las 19:1x.

## Dónde vive

| Pieza | Fichero | Qué hace |
|---|---|---|
| Motor | `src/lib/assistant-answers.ts` (645 líneas) | `answerFor(pregunta, ctx) → string` y `clientasDePregunta` |
| Pantalla | `src/components/assistant/AssistantPanel.tsx` | Chat con `assistant-ui` y `useLocalRuntime`; sin backend ni clave de API. Pasa citas, clientas, lista de espera, servicios, equipo y nombre del salón |
| Sugerencias | `SUGGESTION_GROUPS`, en el mismo motor | Botones de ejemplo por tema |
| Otros usos | `app.insights.tsx`, `PanelV2Shell.tsx` | Abren el mismo panel |

No es un modelo de lenguaje, y la pantalla lo dice. Responde con los datos del salón usando `derive.ts` (KPI) y `ficha-clienta.ts`.

## Cómo casa las preguntas

1. Normaliza: minúsculas y sin tildes. Nada más: ni signos, ni abreviaturas, ni plurales, ni faltas.
2. Si la pregunta sigue una de tres fórmulas fijas de ficha («ficha de…», «qué color lleva…», «cuándo vino…»), busca a la clienta por las palabras de su nombre y responde con su ficha, o pide elegir si hay varias.
3. Si no, recorre **22 intenciones en orden** y gana la **primera** que contenga alguna de sus palabras clave **como subcadena**. El orden se cuida a mano: las específicas van antes que las genéricas.
4. Si no hay intención pero la pregunta nombra a una clienta, responde con su ficha.
5. Si nada casa: «No sé responder a eso — solo consulto los datos de tu propio salón, no invento», más la lista de temas.

**Temas que cubre** (22 intenciones): ingresos (total, por servicio, rentabilidad por hora, mes contra mes y por profesional), ocupación (global y por profesional), franjas fuertes y flojas, clientes (nuevos, nuevos contra recurrentes, inactivos, quién gasta más), cancelaciones y plantones (tasa y totales), agenda (hoy, próxima cita, próximos días), recomendación del día, lista de espera, servicio estrella y tarifas.

## Qué responde con la sonda (primera línea de cada respuesta)

| Pregunta | Respuesta | Juicio |
|---|---|---|
| cuantas citas tengo hoy | «Hoy tienes 15 citas…» | ✅ |
| **cuántas citas hay mañana** | «**Hoy** tienes 15 citas…» | ❌ **dato equivocado sin avisar** |
| **cuanto hemos facturado esta semana** | «**Hoy** llevas 292 €… últimos 30 días 4739 €» | ❌ periodo ignorado |
| **ingresos de septiembre** | igual que la anterior | ❌ periodo ignorado |
| tengo algún hueco libre esta tarde | ocupación de los últimos 7 días | ❌ no contesta a lo pedido |
| **espera un momento, ¿cuántas citas hay?** | «Hoy tienes 15 citas…» (ganó «cuantas citas») | ⚠️ acierta por suerte: «espera» casa con la lista de espera si va antes |
| como va mario | facturación de los tres profesionales | ⚠️ «mario» está escrito a mano como palabra clave |
| **como va sara** | «No sé responder a eso» | ❌ el equipo real de PeluChic no está en las palabras clave |
| q citas tengo mñn · quien viene el sabado · cuantas han faltado este mes · quien no ha venido · cuanto hace que no viene lucia · que tal vamos · hola · como pongo la señal · cuantas señales me faltan por cobrar · citas de la semana que viene | «No sé responder a eso…» | ❌ sin cobertura |
| cuanto cuesta un tinte | la carta entera | ⚠️ no busca el servicio |
| que servicio es el mas pedido · hay alguien en lista de espera | respuesta correcta | ✅ |

**Resultado:** 4 de 22 correctas, 4 a medias y 14 sin respuesta o con respuesta equivocada.

## Límites

1. **Sin fechas ni periodos.** «Mañana», «el sábado», «esta semana» o «septiembre» no se entienden, y la intención responde con hoy o con los últimos 30 días **sin decirlo**. Es el fallo más grave, porque da un dato que no es el pedido.
2. **Reloj real en varias respuestas.** Las que delegan en `derive.ts` (ingresos, ocupación, cancelaciones) usan `new Date()` aunque se pase `now`. No se pueden probar con una fecha fija.
3. **Subcadenas sin límites de palabra.** «espera», «caja», «lleno» o «profesional» casan dentro de otras frases. El resultado depende del orden de la lista.
4. **Nombres de ejemplo escritos a mano** («mario», «diego», «ruben»): con otro equipo no funciona.
5. **Sin tolerancia a faltas ni abreviaturas** («q», «mñn», «xq»), ni a plurales o derivados.
6. **Sin entidades** salvo la clienta, y solo con fórmulas fijas: ni profesional, ni servicio, ni hora.
7. **Sin contexto:** «¿y mañana?» no enlaza con la pregunta anterior.
8. **Sin charla ni carisma:** «hola» recibe «No sé responder a eso». La respuesta es texto plano, sin cifras estructuradas, sin acciones (abrir ficha, ir al calendario) y sin sugerencias parecidas.
9. **Sin plan contratado ni dudas técnicas:** «¿cómo pongo la señal?» no remite a la guía ni a soporte.
10. **Sin datos nuevos:** no conoce la señal (lote 5), la caja por método, las preguntas de reserva (lote 6), los servicios libres ni la hoja del día.

## Qué se conserva

- La búsqueda de clienta por palabras del nombre, nunca por nota ni teléfono (`clientasDePregunta`, que usa `buscar-clientas.ts`). Es la base de «nunca responder con datos de otra clienta».
- Los cálculos de `derive.ts`, `ficha-clienta.ts` y `caja.ts`, que se reutilizan pasándoles el instante de referencia.
- El principio: no es IA, se dice, y no se inventa nada.

El motor nuevo vivirá en `src/lib/asistente/`, en ficheros nuevos, sin tocar este. La pantalla lo conectará cuando FRONTEND lo traiga.
