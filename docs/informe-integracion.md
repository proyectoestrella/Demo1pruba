# Informe de integración: qué falta para producción

> **Actualizado el 27/09.** Rama `codex/peluchic-backend`, `e1041be`: `main` (150d5fc), más la caja (lote 11), la señal (lote 12) y los calendarios (lote 13). `main` ya está fusionado y desplegado en producción; lo pendiente de este informe empieza en el paso 2.

Rama `codex/integracion`, que parte del ensayo de fusión 2 (`ae664ec`) y añade el lote 10. Aquí están los pasos para dejar siShow operativo en producción, **en orden**. Los secretos no se escriben en ningún sitio: se cargan del fichero protegido con `source` o se pegan a mano en el panel de Supabase o de Vercel.

## 0. Estado de la rama

- **Código:** tsc sin errores, `TZ=UTC bun test` 996 de 996, `bun test` en la zona local 996 de 996, `vite build` correcto.
- **Lote 10, un commit por punto:**
  - `b91481d`: Accesos contra la API asíncrona real, con las funciones nuevas vincular y reactivar.
  - `14c6f77`: Versiones e Historial leen del servidor.
  - `010eafd`: fuera las maquetas de señal, preguntas y solape.
  - `ee3536c`: defectos menores.
  - Punto 5: verificación, con el arreglo de las imágenes rotas en las demos.
- **Base de datos:** no hay nada aplicado. `supabase/pendiente.sql`, secciones 1 a 13, está validado con `begin … rollback`. El lote 10 no añade esquema, porque vincular y reactivar usan columnas de la sección 11.

## 0b. Verificado en el navegador

Demo PeluChic en :8085, con Node 22:

| Prueba | Resultado |
|---|---|
| Reserva pública con pregunta propia | OK: la respuesta queda en `bookingAnswers` con el id de la pregunta |
| Señal pedida → recibida por Bizum | OK: `recibida`, `bizum`, 20 €; registra `senal.pedir` y `senal.recibir` |
| «Ver como» Noelia | OK: 5 páginas, cifras suyas; entrar en Ajustes muestra «Esta parte la lleva María» |
| Rechazar y deshacer | OK: un solo cambio; el deshacer vuelve la cita a `pending` |
| Mi página › Versiones | OK: restaurar devuelve el eslogan; publicar sin tocar el logo no registra `logoUrl` |
| Asistente «kien viene mñn» | OK: «Mañana no tienes ninguna cita» (el domingo cierra) |
| Accesos | OK: invitar (Recepción queda `invitada`), cambiar rol, baja y deshacer; la última gerente no se puede dar de baja |
| Historial | OK: agrupado por día, con resumen, y deshacer con su motivo |
| Portada y galería | Arreglado: la imagen fallaba antes de hidratar y React no veía `onError`. Ahora `useImagenConRespaldo` y `useImagenesRotas` (`src/lib/imagen-rota.ts`) lo detectan al montar |

## 1. Fusionar

1. Revisar y fusionar `codex/integracion` en `main`. Lo hace Tomás, igual que el push.
2. Comprobar en local, con Node 22:
   ```sh
   bun install --frozen-lockfile
   node_modules/.bin/tsc --noEmit -p .
   TZ=UTC bun test
   node_modules/.bin/vite build
   ```

## 2. Supabase: aplicar `pendiente.sql` en firme, por secciones

El DDL solo se puede aplicar desde el **SQL Editor** del panel, porque la conexión directa es solo IPv6 y aquí no hay `psql`. Cada sección es idempotente.

1. **Validar sin aplicar**, justo antes. El volcado de esquema tiene que salir idéntico antes y después:
   ```sh
   set -a; source <fichero-de-credenciales>; set +a
   python3 scripts/validar-sql/validar-pendiente.py supabase/pendiente.sql scripts/validar-sql/comprobar-17.sql
   ```
2. **Aplicar en el SQL Editor, una sección cada vez y en este orden.** Tras cada una, mirar que no haya errores antes de pasar a la siguiente.

| Paso | Secciones del fichero | Qué es |
|---|---|---|
| 2.1 | 1 (lista de espera) y 1 (caja y fianza) | Hay dos cabeceras con el número «1»: pegar las dos |
| 2.2 | 2 a 5 | Color por visita, bloqueo por plantón, calendario, fichas sin teléfono |
| 2.3 | 6 | RLS y `salon_members` |
| 2.4 | 7 y 8 | Índices y leads de las demos |
| 2.5 | 9 | Columnas propias del lote 3 más el disparador de `updated_at` |
| 2.6 | 10 | Ciclo de vida de la señal, con migración de filas antiguas |
| 2.7 | 11 | Accesos y roles: columnas de `salon_members` y `salon_invitaciones` |
| 2.8 | 12 | `cambios` y `perfil_versiones`, con RLS y sin políticas |
| 2.9 | 13 | `appointments.ultimo_deshacer_en` |
| 2.10 | 14 a 16 | Caja: `payments`, `cash_closings` y `cambios.entidad` con `'pago'` |
| 2.11 | 17 a 19 | Calendarios: `calendario_conexiones`, `calendario_mapeo_eventos` y `calendario_bloqueos_externos` |

Validación del 27/09: las secciones 1 a 19 pasan en una sola transacción con rollback, con volcado idéntico (`60f6c04ca5691827`), y las comprobaciones 14, 15, 16 y 17 dan todo `SI`/`true` dentro de la transacción.

3. **Comprobar después.** Con el primer argumento `/dev/null` no se aplica nada: solo se ejecuta la comprobación, que termina en `COMPROBACION …` a propósito. Antes de aplicar dice, por ejemplo, `ultimo_deshacer_en=NO`; después tiene que decir `SI` en cada lote. En un salón real, Ajustes › Accesos, Historial y Versiones deben cargar sin el error «Reintentar»:
   ```sh
   for n in 11 12 13 14 15 16 17; do python3 scripts/validar-sql/validar-pendiente.py /dev/null scripts/validar-sql/comprobar-$n.sql; done
   ```
4. **Primera gerente.** Ejecutar `supabase/alta-primer-usuario.sql` en el SQL Editor con su correo, que inserta el rol `'gerente'`. El resto de accesos se invitan desde Ajustes › Accesos.
5. **Auth.** En Authentication › URL Configuration › Redirect URLs, añadir `https://<dominio>/aceptar`, porque la invitación (`auth.admin.inviteUserByEmail`) vuelve ahí. Revisar que la plantilla «Invite user» esté en español.

## 3. Vercel: variables

Las que tiene hoy el proyecto (solo nombres):
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, **solo en Production**.
- `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY`, en Production.
- `GOOGLE_MAPS_API_KEY`, en todos los entornos.

Qué hacer:
1. **`VITE_*` en Preview.** Añadir `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` también al entorno Preview, o las vistas previas no pueden iniciar sesión en el panel. Son públicas, no secretas.
   ```sh
   vercel env add VITE_SUPABASE_URL preview
   vercel env add VITE_SUPABASE_ANON_KEY preview
   ```
2. **`VITE_*` se leen en el build.** Tras cambiarlas hay que **redesplegar**; no basta con guardar.
3. **Node.** Settings › General › Node.js Version = 22.x.
4. **`CRON_SECRET`.** Ya hace falta: protege los tres crons. Sin ella, los tres responden 401 y no hacen nada. Es un valor al azar que se pone solo en Vercel (Production).
5. **Calendarios**, solo cuando se haga la prueba real (`docs/pruebas-calendario-para-tomas.md`). Sin estas variables el módulo no se activa, y además va detrás del flag por salón `calendariosExternosActivo`, apagado por defecto:
   - `GOOGLE_CALENDAR_CLIENT_ID` y `GOOGLE_CALENDAR_CLIENT_SECRET`, del proyecto de Google Cloud.
   - `GOOGLE_CALENDAR_REDIRECT_URI`: `https://<dominio>/api/calendario-externo/google/callback`.
   - `CALENDARIO_CLAVE_CIFRADO`: 32 bytes en base64, que cifra los tokens guardados. Si se pierde, hay que volver a conectar los calendarios.
   - `APPLE_CALDAV_BASE_URL`: opcional; por defecto, iCloud.
6. **Fuera de este ciclo:** `RESEND_API_KEY` y `REMINDER_FROM_EMAIL`, que son del recordatorio por email. Sin ellas, `/api/recordatorios` responde «sin-proveedor». Las invitaciones de Accesos no dependen de Resend: salen por el correo de Supabase Auth.

### Crons (`vercel.json`)

El proyecto está en el plan **Hobby**, comprobado por API el 27/09, y solo admite crons diarios. Un cron más frecuente hace fallar el despliegue.

| Ruta | Hora (UTC) | Qué hace |
|---|---|---|
| `/api/recordatorios` | 17:00 | Recordatorio por email del día siguiente (necesita Resend) |
| `/api/senales-vencidas` | 07:00 | Libera las señales vencidas de todos los salones. Con el panel abierto, se liberan además al refrescar |
| `/api/calendario-externo/cron` | 05:30 | Respaldo de la sincronización de calendarios. Google va por webhook y Apple, además, al abrir el panel (`sincronizarCalendarios`) |

Con el plan Pro se podrían bajar a `*/15` (señales) y `*/5` (calendarios) tocando solo `vercel.json`.

## 4. Redesplegar

```sh
vercel deploy --prod
```
O bien un push a `main` si el proyecto despliega desde Git. Después, comprobar que la función del servidor corre con Node 22 en el registro del despliegue.

## 5. Prueba en producción, con un salón real

1. Entrar como gerente e invitar a una estilista. La invitada aparece como pendiente.
2. Aceptar la invitación desde `/aceptar` con el mismo correo y vincularla a su profesional.
3. Comprobar que la estilista solo ve lo suyo: citas ajenas como «ocupado», sin clienta ni precio.
4. Cancelar una cita y deshacerla desde el aviso. En el Historial aparece con autora.
5. Publicar un cambio en Mi página y restaurar la versión anterior.
6. Dar de baja a la estilista y reactivarla. Intentar dar de baja a la única gerente, que debe impedirse.

## 6. Límites conocidos, no bloqueantes

- **Historial en un salón real.** «Deshacer» solo aparece en los cambios que ese navegador conoce, es decir, los hechos en él. Lo hecho en otro aparato se ve, pero sin botón. Para deshacerlo desde cualquier aparato habría que evaluar `puedeDeshacer` sobre el `Cambio` que llega del servidor.
- **Versiones en un salón real.** Sin comparación antes de restaurar, porque `listarVersiones` no devuelve el contenido. Hace falta un endpoint que devuelva una versión sin restaurarla.
- **Invitaciones anuladas.** Anular una invitación en un salón real no tiene deshacer: hay que invitar de nuevo.
- **Portada de las demos.** Si `/api/foto` falla, la portada, la miniatura de la reserva y la galería usan imágenes de ejemplo en lugar de salir rotas. El fallo puede ser 404 porque la foto se retiró, o 503 si falta `GOOGLE_MAPS_API_KEY`, como en local.
- **Accesos y el Historial.** Los cambios de Accesos (invitar, cambiar rol, dar de baja) no entran en el Historial de cambios. En la demo viven en `sishow-accesos-demo`; en un salón real, en `salon_members` y `salon_invitaciones`.
- **Demo por enlace.** Al recargar la página, las citas de la demo se regeneran a partir de la semilla, y una cita creada en la sesión desaparece. El perfil, las preguntas y el historial se conservan. Es como funcionan hoy las demos; en un salón real no pasa.
