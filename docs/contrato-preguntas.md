# Contrato de las preguntas de reserva para FRONTEND

Rama `codex/peluchic-backend`. Lógica en `src/lib/preguntas-reserva.ts`, funciones puras con pruebas en `preguntas-reserva.test.ts`.

Tomás, 25/09/2026: «que las preguntas que se hacen al formulario las pueda personalizar».

## 1. El tipo

```ts
type TipoPreguntaReserva = "texto" | "si_no" | "opcion" | "numero";

interface PreguntaReserva {
  id: string;            // estable: es la clave de la respuesta guardada. NO cambiar al editar el texto
  texto: string;
  tipo: TipoPreguntaReserva;
  opciones?: string[];   // con "opcion", en orden
  obligatoria: boolean;
  activa: boolean;       // desactivar en vez de borrar conserva el texto para leer respuestas antiguas
  servicios?: string[];  // ids de la carta; vacío o ausente = todos
  detalle?: { id: string; texto: string; obligatorio: boolean }; // con "si_no": se pide si responde «Sí»
}

SalonProfile.preguntasReserva?: PreguntaReserva[]; // en orden; máximo 12
```

Las respuestas se guardan en la cita como `bookingAnswers: { [id]: valor }`, en la columna `booking_answers` (jsonb). Si el esquema aún no tiene esa columna, van en la nota, como hasta ahora.

## 2. Compatibilidad

- **Sin `preguntasReserva`**, el salón ve las tres preguntas de siempre, con los mismos textos e ids (`preguntasPorDefecto`):
  - `hairLength`, de tipo opción: Corto, Medio, Largo o Muy largo;
  - `hasColor`, de tipo sí/no, con detalle `colorDetail`;
  - `recentChemical`, de tipo sí/no, con detalle `chemicalDetail`.
- **Los interruptores de siempre** (`bookingQuestionsEnabled` y `bookingQuestionsRequired`) solo cuentan mientras no haya lista.
- **Con lista**, manda la lista, aunque esté vacía: `[]` significa «sin preguntas».
- **Para empezar a editar**, FRONTEND parte de `preguntasDelSalon(perfil, tipo)`, que ya trae las de siempre, y guarda la lista entera.

## 3. Funciones

| Función | Para qué |
|---|---|
| `preguntasDelSalon(perfil, tipo)` | La lista efectiva del salón, la que se edita en Ajustes |
| `preguntasAplicables(lista, serviceIds)` | Las que se enseñan en una reserva: activas y que aplican a algún servicio elegido, en orden |
| `limpiarRespuestas(lista, respuestas)` | Valida por tipo (opción de la lista, sí/no, número, texto de 200 como máximo, detalle solo con «Sí») y descarta claves ajenas |
| `obligatoriasSinResponder(lista, respuestas)` | Ids que faltan, incluido el detalle obligatorio de un «Sí». Vacío = se puede confirmar |
| `respuestasLegibles(perfil, tipo, respuestas)` | `[{ id, pregunta, respuesta }]` con el texto de la pregunta, en el orden del formulario. El detalle va como «Sí · Castaño». Las respuestas a preguntas retiradas salen al final como «Pregunta retirada (id)» |
| `idPreguntaNueva(lista)` | Id nuevo que no choca con los existentes ni con sus detalles |

**Lectura en el panel:** `<BookingAnswersSummary answers={cita.bookingAnswers} />` ya usa `respuestasLegibles` con el perfil de la store. Se puede usar tal cual o pintar el resultado de `respuestasLegibles` a vuestro gusto.

**CSV:** `citasToCsv(..., { perfil, tipo })` añade la columna «Respuestas al reservar».

## 4. Cómo edita FRONTEND la lista

- Se guarda como cualquier campo del perfil: `useSalonStore.getState().updateSalonProfile({ preguntasReserva: listaNueva })`. En un salón real viaja como parche del perfil (`patchSalonProfile`); en una demo, se queda en local.
- **Reordenar:** cambiar el orden del array.
- **Quitar:** mejor `activa: false` que borrar, porque así las respuestas antiguas siguen leyéndose con su texto. Si se borra, se leen como «Pregunta retirada».
- **Cambiar el texto:** el `id` no cambia nunca.
- **Opciones:** si se quita una opción, las respuestas antiguas con ella se siguen leyendo, pero una reserva nueva ya no puede elegirla.
- **Aviso:** las respuestas son de la clienta y pueden ser sensibles. No conviene preguntar por salud: alergias, embarazo o medicación son categoría especial (ver `gestion-conectada-y-limites-legales` §5 del vault).

## 5. Servidor

La reserva pública manda `bookingAnswers`. El servidor acepta claves `[A-Za-z0-9_-]{1,60}`, valores de 300 caracteres como máximo y 40 claves como máximo. No las valida contra el formulario: esa validación la hace la reserva con `limpiarRespuestas` antes de enviar.
