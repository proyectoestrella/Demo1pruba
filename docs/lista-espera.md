# Lista de espera: qué hay y qué falta

## Hoy (rama codex/peluchic-noche-23)

1. **La clienta se apunta sola.** En el paso «Fecha y hora» de la reserva pública, un bloque «¿No encuentras el hueco que buscas? Avísame si se libera uno» (solo en salones reales). Pide nombre, teléfono, cuándo le vendría bien y el aviso de privacidad. Llama a `apuntarseListaEsperaPublica` (`src/lib/api/salons.functions.ts`): solo inserta; valida teléfono (E.164), exige servicio de la carta, límite por IP, tope de 150 por salón, no duplica por teléfono + servicio, y el id lo pone el servidor (`web-<uuid>`). No requiere DDL: usa la tabla `waitlist` existente.
2. **La gerente ve la lista priorizada.** En Lista de espera, cuando se libera un hueco, aparecen las cuatro primeras por este orden: primero las que de verdad caben (servicio que cabe en la duración libre y profesional preferida, o cualquiera, libre a esa hora), por antigüedad; después las que no caben. Cada una con «Copiar mensaje» y «Avisar» (abre WhatsApp con el texto escrito; lo envía la gerente). `priorizarEsperaParaHueco` en `src/lib/lista-espera-panel.ts`.
3. **Convertir en cita** y **quitar** ya existían.

## Recordatorio por correo (pendiente, sin servicios de pago)

El SMTP de Vercel ya está (`src/lib/email.server.ts`). Falta el dato: `waitlist` no guarda correo, y solo 15 de las 1336 clientas importadas de TPV 123 tienen uno. Propuesta: columna `email text` en `waitlist` (DDL que aplica Tomás en el SQL Editor), campo opcional «Correo» en el bloque público, y una función `avisarEsperaPorCorreo` (solo gerente) que reutilice `proveedorDeCorreo()`. No se ha implementado porque necesita ese DDL y probar SMTP real.

## Web Push (diseñado, sin implementar)

- Service worker en `public/` + suscripción con claves VAPID (generadas una vez con `web-push generate-vapid-keys`; la privada, solo en variables de entorno de Vercel).
- Tabla `push_subscriptions (salon_slug, phone_key, endpoint, p256dh, auth, created_at)` con RLS cerrada; se rellena al apuntarse a la lista, si la clienta acepta notificaciones.
- Al liberarse un hueco, una función de servidor envía a las suscripciones compatibles con `web-push` (gratuito).
- iPhone solo recibe Web Push con la web instalada en pantalla de inicio (iOS 16.4+): hay que explicarlo en la propia pantalla.
