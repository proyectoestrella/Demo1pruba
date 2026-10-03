# Acciones de Tomás para activar PeluChic

Todas las acciones en Supabase, Vercel, DNS, Auth y correo son manuales de Tomás. Codex preparó archivos locales, no se conectó a producción, no leyó secretos y no ejecutó estos pasos.

## Puertas de entrada

Antes de escribir en producción:

- Contrastar copia bilateral, pago y fecha efectiva. El resumen indica firma el 28-sep; copia/hora no verificadas aquí.
- Resolver por escrito activación antes del **15-oct-2026** (Anexo I) frente al **20-oct-2026** (cláusula 2.3). Si se acuerda, firmar adenda.
- Obtener aprobación de María para carta/duraciones/precios, horarios, hasta tres profesionales, textos, datos públicos, logo, enlaces y preguntas.
- Aprobar aviso/URL de privacidad y quién autoriza el texto. La casilla acredita lectura, no consentimiento por sí sola.
- Confirmar correo de acceso, ventana de cambio, backup y rollback. No ejecutar seed si queda un marcador __PENDIENTE_*.

Si la firma fue el 28-sep, las 72 h internas vencieron el 1-oct. Si se reinician tras la reunión del 7-oct a las 16:30, vencerían el 10-oct a las 16:30. Es una meta de trabajo, no término contractual.

## 1. Revisar código y preparar liberación

En el clon autorizado, comprobar rama/commit y ejecutar con Node 22 o superior, declarado en package.json:

~~~sh
node --version
bun test
bunx tsc --noEmit
bun run lint
bun run build
~~~

Revisar el commit con el flujo normal antes de desplegar. Confirmar que SUPABASE_SERVICE_ROLE_KEY solo está en entorno servidor; las variables VITE_* son públicas. No imprimir valores ni copiarlos a notas. Codex no hace push ni despliegue.

## 2. Inspección previa y backup Supabase

En SQL Editor, ejecutar primero estas lecturas:

~~~sql
select slug, profile, updated_at
from salons
where slug = 'peluchic';

select column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name = 'appointments'
  and column_name = 'privacy_notice_acknowledged_at';

select salon_slug, rol, count(*)
from salon_members
where salon_slug = 'peluchic'
group by salon_slug, rol;
~~~

El perfil puede contener información comercial confidencial: guardarlo en espacio privado de Tomás, nunca en esta carpeta o acta. Si existe la fila del salón, **no ejecutar la semilla de inserción**. Verificar el plan guardado; Básico se representa como plan: reservas. No cambiar un plan explícito por suposición.

Antes de tocar datos, descargar backup restaurable de Supabase y guardar JSON previo de salons.slug=peluchic si hay fila. Registrar fecha, proyecto, tablas y ubicación privada del backup. No guardar credenciales aquí.

## 3. Aplicar DDL aditivo del aviso

Revisar supabase/pendiente.sql o supabase/schema.sql; aplicar desde SQL Editor:

~~~sql
alter table appointments
  add column if not exists privacy_notice_acknowledged_at timestamptz;
~~~

Comprobar:

~~~sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name = 'appointments'
  and column_name = 'privacy_notice_acknowledged_at';
~~~

Esperado: una fila, timestamp with time zone, nullable; las citas existentes siguen siendo válidas. No abrir reservas hasta que el aviso aprobado tenga URL y la columna exista. La reserva pública pasa por función servidor; no añadir una política RLS permisiva.

## 4. Cargar perfil si aún no existe

1. Completar copia de supabase/seed-peluchic.sql solo con datos aprobados. Mantener slug peluchic, plan reservas, 1–3 profesionales, horario de siete días, servicios reales y URL HTTPS de reseñas. Vacíos confirmados se escriben como cadena vacía; ningún campo inventado.
2. No trasladar fianza, multas, preguntas de demo, métricas/reseñas ficticias, precios no aprobados ni nombres de prueba.
3. Buscar __PENDIENTE_ en la copia: cero resultados. Revisar carta, horarios y enlaces contra aprobación de María.
4. Volver a comprobar que salons.slug=peluchic no existe. Guardar evidencia del SELECT vacío.
5. Ejecutar SQL revisado en Supabase SQL Editor. Falla si quedan marcadores, plan no es Básico, hay más de tres profesionales o ya hay fila. No cambiarlo a UPDATE para forzarlo.
6. Ejecutar consulta final del seed. Comparar plan, equipo, servicios y horarios con lo aprobado.

Si ya existe la fila, preparar cambio separado con diff antes/después, respaldo y aprobación. No modificarla con la plantilla de inserción.

## 5. Enlace mágico y alta de María

### Configuración de Auth

En variables Production revisar nombres y ámbitos, sin revelar valores:

- Navegador: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
- Servidor: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
- RESEND_API_KEY y REMINDER_FROM_EMAIL son para recordatorios Resend, no OTP de Supabase Auth.

En Supabase Authentication → URL Configuration configurar Site URL del dominio que se usará y añadir la URL exacta:

~~~text
https://peluchic.sishow.es/app?s=peluchic
~~~

Permitir otros destinos solo si hacen falta; preferir rutas exactas. Comprobar que el SMTP de Auth puede enviar a un correo de prueba permitido.

### Recorrido extremo a extremo

1. Tomás abre https://peluchic.sishow.es/login?s=peluchic; con María presente o autorizándolo, pide enlace a su correo confirmado.
2. Abrir el correo/enlace en el dispositivo habitual. Debe volver a https://peluchic.sishow.es/app?s=peluchic con sesión.
3. Un usuario no miembro debe ser rechazado por el servidor. Si no hay cuenta QA controlada, probar en staging; no crear accesos arbitrarios en producción.
4. Solo después de que la cuenta aparezca en auth.users, sustituir marcador en supabase/alta-primer-usuario-peluchic.sql por el correo aprobado y ejecutar en SQL Editor.
5. La consulta final debe devolver una fila con salon_slug=peluchic, correo de María y rol=gerente. Cero filas: parar y revisar OTP/correo; no inventar UUID.
6. Cerrar sesión y volver a entrar. src/lib/sesion-auth.test.ts usa cliente simulado; no acredita correo real.

Para retirar solo la membresía, inspeccionar correo y UUID y luego, si procede:

~~~sql
delete from salon_members
where salon_slug = 'peluchic'
  and user_id = '<UUID_VERIFICADO_DE_MARIA>';
~~~

Sustituir por UUID copiado de la fila verificada. Esto no borra la cuenta Auth.

## 6. Importación TPV 123

1. Recibir CSV/XLSX por canal aprobado con acceso restringido; no adjuntarlo al repo, tickets o conversación compartida.
2. Abrir importador del panel real. La vista previa/dry-run no escribe; revisar columnas, filas inválidas y duplicados.
3. Confirmar criterio con María. Importar nombre, móvil, correo y código de clienta de TPV 123 (necesario para reconocer una reimportación). Excluir segundo teléfono, observaciones, historial, cumpleaños, dirección, DNI y salud.
4. Importar tras el visto bueno. Guardar recuentos agregados, nunca filas personales. Retener/eliminar el archivo según política acordada.
5. No importar historial TPV en Básico ni confundir con importación de ventas/caja.

Los tests de src/lib/importar-clientas.test.ts usan datos sintéticos; no se procesó exportación de PeluChic.

## 7. Prueba de aceptación

- Solicitud pública sintética: servicio, casilla de privacidad separada de cancelación, rechazo si no se marca lectura, solicitud pendiente, ajuste de duración y aparición en panel. Usar correo/alias QA controlado; no clientas reales.
- Buscar/editar ficha sintética, imprimir hoy/mañana y exportar CSV sintético.
- Comprobar panel en PC y móvil/tablet. Esperar refresco y regreso de foco; sincronización actual cada 60 s, no instantánea. No afirmar operación concurrente probada.
- Abrir Google Reviews confirmado en dispositivo de María sin enviar campaña.
- Revisar dominio/TLS, versión, acceso gerente y errores críticos; Tomás añade enlace en WordPress/redes según aprobación.
- Dar formación y completar aceptación, incidencias, responsables y fecha de soporte.

RLS está habilitada sin políticas según el estado técnico disponible; las funciones servidor usan service role y validan sesión/pertenencia. No añadir políticas permisivas. Revisar informe de seguridad vigente antes de abrir acceso real.

## 8. Variables, dominio y despliegue

Orden recomendado:

1. Adenda/versión aprobadas; backup Supabase y perfil previo.
2. DDL nullable aplicado y verificado.
3. Revisar variables Production en Vercel: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Nunca colocar service role en VITE_*.
4. Desplegar commit revisado; si falla, conservar despliegue anterior y resolver antes de cargar datos.
5. Ejecutar seed solo si no hay fila previa; verificar; después dar de alta a María.
6. Configurar allowlist y probar OTP. Confirmar DNS/asignación de peluchic.sishow.es y TLS; no cambiar DNS si funciona.
7. Humo público/privado, importación, formación, enlace WordPress y acta.

No habilitar Resend para reparar OTP; recordatorios por correo son aparte y no constan entre las ocho prestaciones Básicas del Anexo I.

## 9. Rollback

- Si seed falla antes de insertar, leer error, corregir en copia y validar; no hacer escrituras parciales manuales.
- Si había perfil anterior, supabase/rollback-peluchic.sql restaura el JSON guardado. Usarlo solo si el SELECT previo confirmó fila y hay backup íntegro. No borra clientas, citas, miembros ni historial.
- Si fue fila nueva con relaciones/datos, no borrarla. Antes de retirar un alta previa a activación, revisar relaciones existentes (salon_members, clients, appointments, waitlist, pagos/cierres/invitaciones) y preparar DELETE puntual con doble revisión solo si no hay ninguna. No usar cascada ni borrar salón activo.
- Si falla deploy, mantener versión anterior. Si falla OTP, retirar temporalmente enlace público y corregir allowlist/SMTP; nunca crear bypass.
- La columna nullable es aditiva: no hacer DROP COLUMN al revertir código. Para perfil incorrecto, restaurar backup con salón sin uso activo y alcance revisado.
- Registrar operador, hora, resultado y efecto.

## Evidencia de cierre

Archivar privadamente: fecha/adenda, versión desplegada, URL revisada, estado OTP/membresía, permiso de privacidad, recuentos agregados, aceptación/formación y respaldo/rollback. No archivar datos personales de clientas en este repo.
