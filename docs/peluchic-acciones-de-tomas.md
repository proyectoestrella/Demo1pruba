# Alta de PeluChic · guía para Tomás

Estos ficheros son preparación local. No se han ejecutado contra Supabase ni producción.

## 1. Comprobar antes de escribir

En el SQL Editor de Supabase, ejecutar solo esta lectura:

```sql
select slug, profile, updated_at
from salons
where slug = 'peluchic';
```

Si no devuelve fila, usar `supabase/seed-peluchic.sql`. Si devuelve una fila, **no usar seed**: copiar el JSON del resultado a un espacio privado y usar `supabase/update-peluchic.sql`. El update también emite el perfil anterior como `RAISE NOTICE`; copiarlo antes de confirmar que todo está correcto.

Los dos scripts son transaccionales y terminan con una consulta de comprobación. Revisar que muestra 57 servicios y `fianza_activa = false`. El rollback del update es `supabase/rollback-update-peluchic.sql`: pegar allí exactamente el JSON del aviso de backup. El rollback no toca clientas, citas, pagos ni miembros.

## 2. Orden de carga

1. Hacer backup restaurable del proyecto y guardar privadamente el JSON previo si existe.
2. Pegar el SQL elegido completo en SQL Editor y ejecutarlo una sola vez.
3. Revisar carta, equipo, horarios, festivos, preguntas y precios ocultos en el panel.
4. La hora de comer de los viernes **no está cargada**: María la crea desde `Bloquear tiempo › repetir cada semana` cuando decida hora y profesionales.
5. La fianza está configurada pero apagada. Cuando socios/adenda lo autoricen, cambiar `"depositEnabled": false` por `true` en el perfil; mantiene 5 €/hora, 4 h y liberación manual.

## 3. Alta de María

1. Configurar la URL de retorno autorizada y pedir el enlace mágico al correo que María confirme.
2. Esperar a que abra el enlace: primero debe existir en `auth.users`.
3. Sustituir el correo confirmado en `supabase/alta-primer-usuario-peluchic.sql` y pegarlo en SQL Editor.
4. Ejecutar su `SELECT` final: debe devolver una fila con rol `gerente`.

No inventar UUID ni usar el correo de privacidad como correo de acceso sin que María lo confirme.

## 4. Importar clientas

Desde el panel real, abrir el importador y cargar el `.xlsx` proporcionado por María. Usar primero la vista previa; confirmar duplicados y columnas; importar solo tras su visto bueno. No añadir el archivo, datos de clientas ni capturas a este repositorio.

## Datos aún pendientes

- Teléfono Bizum para la fianza (no se ha guardado); la fianza permanece desactivada.
- Correo de acceso de María para el enlace mágico y alta de gerente.
- Ortografía definitiva de «Anca».
- Hora y alcance de la comida de los viernes.
- Decisión de socios/adenda para activar la fianza.
- Días especiales de 2027 posteriores al 1 de enero.
- Confirmación de la asignación de servicios por profesional durante la formación.
