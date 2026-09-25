# Asistente del panel: informe final (lotes 7, 7b y 7c)

Rama `codex/peluchic-backend`, etiqueta `backend-lote-7c` (c21d481). Código en `src/lib/asistente/`. El contrato para la pantalla está en `docs/contrato-asistente.md`, y la auditoría del asistente anterior en `docs/asistente-estado-actual.md`.

## 1. Qué es

Un asistente que responde preguntas sobre los datos del salón **sin IA**. No usa modelo de lenguaje, ni red, ni clave. Todo son reglas legibles y comparación léxica. Nunca inventa: si no tiene el dato, lo dice; si duda, pregunta; si la pregunta no es del salón, contesta «No lo sé seguro».

## 2. Arquitectura: el recorrido de una pregunta

```
pregunta
  → normalizar     normalizar.ts   minúsculas, sin tildes, abreviaturas («q», «mñn»), números en cifras, raíz ligera
  → entidades      entidades.ts    fecha/periodo, franja, hora, profesional, servicio, clienta (una, varias o ninguna)
  → máscara        mascara.ts      cambia cada entidad por una marca (zzclienta, zzpro, zzservicio, zzdia…)
  → parecido       parecido.ts     frases del salón y sinónimos; parecido ponderado por IDF contra los ejemplos del catálogo
                   pistas.ts       reglas por intención que suman puntos cuando aparece su expresión característica
                   anclas.ts       sin un término fuerte del salón ni una entidad, solo caben la charla y la ayuda
  → intención      responder.ts    umbral; entidades exigidas; vecinas empatadas → «elegir»; reencaminado por entidades (intenciones.ts)
  → resolutor      resolutores/    una función pura por intención de negocio: texto, cifras, una acción como mucho, sugerencias
  → respuesta      responder.ts    respuesta | elegir | no-se | escalar; salud nunca; contexto («¿y mañana?»); aviso de plan (`tambien`)
```

Los datos llegan por una interfaz inyectada, `FuentesAsistente` en `fuentes.ts`. El motor no importa nada de la pantalla. BACKEND tiene su adaptador en `fuentes-backend.ts` y FRONTEND el suyo en `fuentes-panel.ts`. El catálogo son 120 intenciones: 84 de negocio, 10 de charla, 12 de plan y 14 técnicas. Se genera de la especificación (`especificacion.ts`) y se completa con ejemplos extra (`ejemplos-extra.ts`) y con las reglas de `intenciones.ts`.

## 3. Resultados

Las métricas son tres:
- **Acierto:** responde la intención esperada, o responde la de negocio y avisa de la de plan esperada.
- **Inofensivo:** no acierta, pero no da ningún dato. Pregunta cuál (`elegir`) o dice «no lo sé».
- **Dañino:** responde con otra intención, es decir, da un dato que no era el pedido. También cuenta como dañino responder con datos del salón a una pregunta ajena.

| Corpus | Tamaño | Quién lo escribió | ¿Ciego? | Acierto | Inofensivo | Dañino | Negocio |
|---|---|---|---|---|---|---|---|
| Desarrollo | 430 | BACKEND | No: se ajustó con él | 98,8 % | 0,9 % | 0,2 % | 98,6 % |
| Ciego 1 | 220 | agente aparte | Ya no: se ajustó con él tras medirlo | 95,9 % | 2,7 % | 1,4 % | 95,3 % |
| Ciego 2 | 250 | agente aparte | Ya no: se ajustó con él tras medirlo | 95,6 % | 2,8 % | 1,6 % | 95,2 % |
| Ciego 3 | 250 | agente nuevo | Ya no: se ajustó con él tras medirlo | 94,4 % | 3,2 % | 2,4 % | 95,2 % |
| **Ciego 4** | **250** | **agente nuevo** | **Sí: medido una vez, motor congelado** | **90,0 %** | **5,6 %** | **4,4 %** | **91,1 %** |

Cómo se midió:
- **Qué vieron los autores.** Los agentes de los corpus ciegos solo vieron el catálogo, con ids y qué responde cada intención, y la guía de uso. No vieron el código, los ejemplos ni los corpus anteriores.
- **Medición única.** Cada ciego se midió una sola vez, con el motor congelado. Solo después pasó a servir para ajustar.
- **Cifra honesta.** Es la del **ciego 4**, que ya se aceptó como techo en la 7c. Las de los otros corpus son optimistas por construcción.
- **Datos de otra clienta.** Cero en los cinco corpus. El test comprueba que ni el texto ni las acciones nombran a una clienta distinta de la preguntada.

Evolución del ciego medido una vez: 72,7 % (lote 7, primer ciego antes de ajustar), 91,2 % (lote 7), 90,8 % (7b) y 90,0 % con daño del 4,4 % (7c). En la 7c el objetivo pasó a ser el daño, y en los corpus ya vistos bajó del 4,8–5,6 % al 1,6–2,4 %.

Para reproducirlo:

```
TZ=UTC bun src/lib/asistente/evaluar.ts            # desarrollo
TZ=UTC bun src/lib/asistente/evaluar.ts --ciego4   # también --ciego, --ciego2, --ciego3
```

## 4. Los 11 dañinos del ciego 4

| Pregunta | Esperada | Respondida | Tipo |
|---|---|---|---|
| cuántas citas hemos tenido esta semana frente a la anterior | citas-periodo | comparar-periodos | Etiqueta discutible: también es una comparación |
| ábreme a Cristina Castillo, no me acuerdo del teléfono | buscar-clienta | datos-clienta | Etiqueta discutible: pide el teléfono |
| a quién de hoy le falta anotar el color | colores-hoy | color-pendiente | Etiqueta discutible: «le falta el color» es la otra |
| cuántas reservas nuevas están esperando que las confirme | solicitudes-pendientes | clientas-nuevas | Confusión: «nuevas» pesa más que «confirmar» |
| cuáles tengo sin poner vino o no vino | por-marcar | plantones | Confusión: «no vino» es la expresión de plantones |
| qué huecos flojos hay y a quién se los mando | huecos-flojos | huecos-hoy | Confusión entre vecinas, sin empate |
| puedo importar el excel del tpv cuando yo quiera o solo una vez | plan-importar-mensual | tec-importar-tpv | Confusión plan / técnica |
| dónde añado un servicio nuevo a la carta | tec-precios | carta | Confusión técnica / negocio: «carta» ancla la de negocio |
| no me están llegando reservas por la web, qué reviso | tec-no-llegan-reservas | tec-contrasena | Confusión entre técnicas |
| por qué no entra ninguna solicitud nueva desde ayer | tec-no-llegan-reservas | solicitudes-pendientes | Confusión: responde la lista (vacía), no el diagnóstico |
| cómo convierto libras a kilos | no-se | huecos-hoy | Fuera del dominio: «libras» casa con «libra» (librar) |

Ninguno inventa cifras. En todos, el dato mostrado es real, pero no es el que se pedía.

## 5. Límites

- **Sin IA.** Entiende por vocabulario, no por sentido. Una frase con palabras que no están en el catálogo ni en los sinónimos acaba en «no lo sé» o en una pregunta. Una palabra con dos sentidos puede engañarlo: «libras», «vino» o «renta».
- **Vocabulario cerrado.** Cubre la especificación, 960 ejemplos extra y el habla coloquial más común del salón. Cada palabra nueva se añade a mano (sección 6).
- **Aclaraciones.** Cuando dos intenciones vecinas quedan cerca, pregunta «¿Qué quieres saber?» con dos botones. Es a propósito, porque «sin inventarse nada» pesa más que el porcentaje. Pasa en un 1–6 % de las preguntas según el corpus.
- **Preguntas dobles.** «Cuántas le quedan a Noelia y cuál es la siguiente» se responde con una sola intención o con una aclaración, nunca con las dos cosas.
- **Contexto corto.** Solo recuerda la última pregunta («¿y mañana?», «¿y Noelia?»). La charla lo borra.
- **Datos de BACKEND.** En la semilla de esta rama no hay citas cobradas (`paidAt`), así que el cobrado sale 0 € y el asistente lo dice. Los colores del calendario quedan pendientes de conectar (`colores()` devuelve null).

## 6. Cómo añadir una intención nueva

1. **Especificación.** Añádela en `preguntas-universo.md` con el mismo formato: `### \`id\` · categoría`, «Así lo escribe María», «Responde», «Respuesta modelo». Regenera el catálogo (sección 7).
2. **Reglas en `intenciones.ts`:**
   - `REQUIERE` si necesita clienta, profesional o servicio.
   - `PREGUNTA`, la pregunta limpia y con tildes para botones y sugerencias.
   - `PLANTILLA` si lleva entidad («¿Cuándo viene {clienta}?»).
   - `reencaminar` si cambia según la fecha o la entidad.
3. **Ejemplos.** Al menos 8 más en `ejemplos-extra.ts`, variados y coloquiales.
4. **Pista en `pistas.ts`**, si tiene una expresión característica. Mejor por concepto que por frase.
5. **Vecinas.** Si se parece a otra, añádela a su grupo en `VECINAS` (`responder.ts`) para que pregunte en vez de adivinar.
6. **Anclas.** Si usa vocabulario que aún no ancla el dominio, añádelo en `anclas.ts`.
7. **Resolutor** (solo las de negocio). Una función pura en `resolutores/<categoría>.ts`, registrada en `resolutores/index.ts`. Si necesita un dato que las fuentes no dan, amplía `FuentesAsistente` con un campo opcional que devuelva `null` si no hay dato, e impleméntalo en los dos adaptadores.
8. **Tests.** Añade frases nuevas al corpus de desarrollo y ejecuta los tests y `evaluar.ts` en todos los corpus. No bajes las guardas de los ciegos.

## 7. Cómo se regenera la especificación

La fuente es `preguntas-universo.md`, en AlmacenExterno (`sishow-asistente/`). El generador está versionado:

```
python3 scripts/generar-especificacion-asistente.py <ruta a preguntas-universo.md> --ts > /dev/null
```

Reescribe `src/lib/asistente/especificacion.ts` y conserva su cabecera. `especificacion.ts` no se edita a mano. Después se ejecutan tsc y los tests.

## 8. Rendimiento

La demo PeluChic tiene unas 3.300 citas y 595 clientas. Tras `precalentar()`, la mediana es de 3–4 ms por pregunta y el máximo de 10–15 ms. El precalentado tarda unos 300 ms una vez. Sin él, la primera pregunta los paga, y la primera de marketing unos 100 ms más.

Las piezas que lo hacen posible:
- **Reloj con caché** por tramos de 15 minutos (`reloj.ts`), porque la zona horaria con Intl costaba 0,1 ms por cita.
- **Índices por día y por clienta.**
- **Índice invertido** de términos y faltas precalculadas en el comparador.
- **Marketing memorizado** por cuarto de hora.

## 9. Qué debe hacer FRONTEND en la fusión

1. Traer `src/lib/asistente/` completo **salvo** `fuentes-backend.ts`, que se sustituye por su `fuentes-panel.ts`, y `src/lib/zona-horaria.ts`. `fuentes.ts` debe coincidir byte a byte.
2. Llamar a `precalentar()` al montar el chat y volver a crear el asistente cuando cambien los datos.
3. Pintar las cuatro formas del contrato:
   - En `elegir`, cada botón manda su `pregunta` a `responder()`.
   - En `escalar`, el orden es pasos, guía y contacto.
   - El `texto` usa negrita Markdown.
4. Traducir las `acciones` semánticas (`ver-calendario`, `abrir-ficha`…) a rutas del panel.
5. Conectar `colores()` con los nombres de color en palabras de su rama.
6. Tests: `prueba-peluchic.ts` usa `fuentes-backend.ts` y la semilla de BACKEND. En la rama de FRONTEND hace falta una versión sobre sus fuentes para correr los corpus. FRONTEND ya lo hizo: 98,6 % en desarrollo y 93,8 % en los ciegos, a 7,4 ms por pregunta.
7. Tras la fusión: tsc, `TZ=UTC bun test` y `evaluar.ts --ciego4`, que debe dar el mismo resultado.
