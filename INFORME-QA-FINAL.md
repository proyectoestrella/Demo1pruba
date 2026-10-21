# Informe QA final (21-oct-2026, rama codex/peluchic-feedback)

## Revisado
- Seguridad: grep de service_role, sb_secret y claves en .vercel/output/static (bundles cliente): sin coincidencias. dangerouslySetInnerHTML solo con CSS/scripts estáticos (Dosier, chart, tema); insertAdjacentHTML en app.demos con cadena fija. Email de recordatorio escapa HTML. console.* del servidor: solo mensajes de error de Supabase y nombres de columnas, sin nombre/teléfono/email. Los tres crons exigen CRON_SECRET con timingSafeEqual. lookupGoogleMaps solo expande acortadores de una lista permitida.
- Autorización: todas las server functions de salons, accesos, pagos, cambios y calendario-externo pasan por exigirPermiso/exigirMando; clients.functions valida con zod y solo escribe leads de demo.
- Usabilidad: flujo de reserva (envío con bloqueo doble, errores explicados, reintento), entrada con código (estado Comprobando…, maxLength 6, one-time-code), Accesos. Auditoría táctil en 390x844 del panel demo.

## Arreglado
- Accesos: si una acción confirmada fallaba, el diálogo se quedaba sin explicar nada; ahora muestra un aviso de error.
- Avatar con foto: loading=lazy y decoding=async.

## Rendimiento (gzip, chunks de .vercel/output/static/assets)
- Antes: index 325,6 KB; reserva 87,3 KB; AssistantPanel 72,9 KB (ya perezoso); settings 26,7 KB.
- Después: sin cambio en chunks (el cambio de imágenes no afecta). No se aplicó más lazy: ver decisiones.
- Origen del chunk inicial (fuentes): react-dom 545 KB, rutas 545 KB, @dicebear/notionists 394 KB (~118 KB gzip), router-core 165 KB.

## Decisiones para Tomás
1. DiceBear en el chunk inicial (~118 KB gzip, un tercio): placeholderAvatar lo usa de forma síncrona para fotos de equipo en la web pública. Sacarlo implica sustituirlo por avatares de iniciales (cambio visual: decisión de la diseñadora) o hacerlo asíncrono.
2. La reserva carga framer-motion (via FluidSteps) y libphonenumber (~87 KB gzip): también usados de forma síncrona; no se tocó por riesgo antes de mañana.
3. lookupGoogleMaps no exige sesión: cualquiera puede gastar cupo de la API de Maps. Valorar exigir sesión.
4. La URL de confirmación de reserva lleva el nombre de la clienta (name= en la query).
5. Tour guiado del panel (Atrás/Siguiente/Cerrar) y barras de la línea de Hoy miden menos de 44 px; son de diseño, no se cambiaron.

## Verificación
bun test: 2065 pass, 1 skip, 0 fail. npm run build: correcto.
