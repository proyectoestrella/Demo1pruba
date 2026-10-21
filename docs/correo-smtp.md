# Correo de recordatorio por SMTP (sin Resend)

El cron `/api/recordatorios` (vercel.json, `0 17 * * *` UTC = 18:00/19:00 en Madrid)
manda a cada clienta con correo un recordatorio de su cita confirmada de mañana.
Lo envía `src/lib/smtp.server.ts` (cliente SMTP propio, sin dependencias, TLS implícito).

## Variables que hay que crear en Vercel (Production)

| Variable | Valor |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | `acceso@sishow.es` |
| `SMTP_PASSWORD` | la contraseña del buzón (la pone Tomás; no va en ningún archivo) |
| `REMINDER_FROM_EMAIL` | `PeluChic <acceso@sishow.es>` |
| `CRON_SECRET` | ya debe existir; sin él la ruta responde 401 |

Prioridad: si están `SMTP_HOST`, `SMTP_USER` y `SMTP_PASSWORD` se usa SMTP; si no,
Resend (`RESEND_API_KEY`); si no, no se envía nada y la respuesta dice `sin-proveedor`.
Tras crear las variables hay que redesplegar.

## Prueba

`GET /api/recordatorios?dry=1` con `Authorization: Bearer <CRON_SECRET>` simula sin enviar;
`?cita=<id>` limita a una cita. Cada cita enviada queda marcada con `reminder_sent_at`
y no se vuelve a enviar.

## Notas

- El remitente debe ser el mismo buzón que `SMTP_USER` (Hostinger rechaza otro From).
- Conviene que `sishow.es` tenga SPF/DKIM de Hostinger para no caer en spam.
- El nombre visible «PeluChic» es fijo para todos los salones mientras solo haya uno.
