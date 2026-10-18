# Bloqueo de plan en servidor: analítica y asistente

Este contrato aplica solo a un salón real: uno cuya fila existe en `salons` y
que se ha autenticado como miembro. Las demos son explícitas, viven en el
navegador y no consultan Supabase; siguen completas aunque su perfil de ejemplo
diga Básico.

| Función | Básico (`reservas`) | Estándar (`reservas-asistente`) | Embajador (`todo-incluido`) |
| --- | --- | --- | --- |
| Analítica avanzada | No recibe citas anteriores a la ventana operativa. Recibe desde el comienzo del mes actual —o las 24 h previas si son anteriores— y toda cita posterior. No hay series ni agregados de servidor: las gráficas y patrones se calculan en cliente con estas citas. | Recibe todo el histórico de citas tras el recorte de rol; por tanto puede calcular series, recurrencia, horas flojas y patrones. | Igual que Estándar. |
| Asistente | El servidor marca la función inactiva. No existe endpoint de preguntas ni datos exclusivos del asistente; no se fabrica un recorte adicional que pueda romper Hoy, Calendario o Clientas. | El servidor marca la función activa. El asistente determinista calcula sus respuestas con los datos del panel ya hidratados. | Igual que Estándar. |

`clients` y `waitlist` no se recortan por estas dos funciones. Siguen sujetos al
recorte previo de rol. En Básico se conserva además la agenda futura y las
fichas operativas, por lo que las pantallas básicas no pierden sus datos.

## Frontera de servidor

`listSalonData` lee el perfil desde Supabase y aplica
`recortarDatosPanelPorPlan` antes de responder. Además devuelve
`funcionesPlan` para `analitica-avanzada` y `asistente`; el panel usa esa
decisión de servidor para mantener inactiva la entrada del asistente en Básico.
No se crea una API de consultas del asistente: no la hay y el motor no manda
preguntas ni datos a un servidor.

Un plan ausente o desconocido se interpreta como Básico. Si falla la lectura
del perfil que contiene el plan, `listSalonData` falla antes de enviar la
respuesta de panel. Ambas alternativas niegan el histórico y las dos
funciones, en vez de elevar permisos por error.

Las campañas continúan con su contrato independiente: solo Embajador recibe
las campañas ampliadas. No forma parte del bloqueo del asistente.

## Pruebas

`src/lib/api/plan-bloqueo-servidor.test.ts` ejecuta `listSalonData` real con
dobles en memoria de Supabase. Comprueba llamadas directas para Básico,
Estándar, Embajador, plan desconocido, fallo de la segunda lectura del perfil y
demo sin Supabase. No usa SQL ni un proyecto de Supabase.
