# Acceso profesional y app de PeluChic

Preparado el 21 de octubre de 2026 para la instalación del **22 de octubre a las 14:00 (Europe/Madrid)**. Rama `codex/peluchic-feedback`. Sin push ni despliegue.

## Estado y condición de puesta en marcha

El código y los recursos de instalación quedan preparados. **Antes de desplegar, Tomás debe aplicar `supabase/acceso-app.sql` y comprobar Auth y SMTP** según los pasos siguientes. Sin esas funciones SQL, la nueva comprobación de sesión rechaza el acceso por seguridad. No se ha modificado el proyecto remoto de Supabase ni se han enviado correos reales desde este encargo.

La persistencia es renovable y no tiene un vencimiento impuesto por la aplicación. No se puede certificar una duración literalmente indefinida: depende de la configuración de Auth, de que el sistema conserve el almacenamiento y de que la persona no cierre sesión, borre datos o desinstale la app. El ensayo físico de iPhone, iPad y ordenador queda en la lista de instalación.

## Qué había

- `login.tsx`: correo y enlace mágico, sin entrada de código. La vuelta al panel podía perder `?s=` y una sesión sin pertenencia podía rebotar entre entrada y panel.
- `sesion.ts` y `supabase-browser.ts`: cliente único de Supabase, `persistSession: true`, `autoRefreshToken: true`, detección del enlace y clave de almacenamiento `sishow-sesion`. El SDK utiliza localStorage cuando está disponible. Cerrar sesión ya usaba `scope: "local"` y limpiaba los datos del salón de este dispositivo.
- `api/accesos*`: invitaciones por correo, aceptación, cambio de rol, bajas y reactivación. Solo gerente puede administrar accesos. Se impedía eliminar a la última gerente, pero una gerente sí podía quitarse su rol cuando había otra. Las bajas desaparecían del listado; faltaba el cierre remoto.
- `permisos*`, `autorizacion*`, `guardas`, `recorte`: permisos por acción, pertenencia por pareja usuario/salón y recorte de datos en servidor. Las operaciones de citas, fichas, caja, historial y calendarios ya tenían guardas. Las rutas del panel utilizaban además protección visual y caché de pertenencia.
- `__root.tsx` y manifests: identidad siShow/rutero, manifiesto de panel genérico con scope `/app`, orientación libre e iconos genéricos. Faltaban instrucciones de instalación y marca PeluChic.

## Qué cambia

### Entrada y sesiones

- Dos pasos: correo → «Enviar código» → campo de seis cifras grande, teclado numérico, `autocomplete="one-time-code"`, pegado completo y verificación automática. También hay botón Entrar para reintentar.
- `signInWithOtp` y `verifyOtp({ type: "email" })`, sin contraseñas. El correo no invitado no crea una cuenta automáticamente. Los errores de envío/red y código se explican en español; «Enviar otro» permite renovar el código.
- Supabase puede devolver `otp_expired` tanto para un código inválido como para uno caducado; el texto lo dice sin inventar una distinción que el proveedor no proporciona.
- Después de identificar el correo se aceptan sus invitaciones pendientes válidas del salón solicitado. La comprobación usa el usuario del token y su correo de Auth, nunca un correo enviado como autoridad por el navegador.
- Si no pertenece al salón se queda en la entrada con «Pide a María que te dé acceso» y la opción de usar otro correo. Se conserva el salón en los retornos; en `peluchic.sishow.es` se resuelve PeluChic también con almacenamiento nuevo.
- Se conserva la persistencia y renovación del SDK, sin cookies de duración corta ni límites por dispositivo introducidos por la aplicación. El cierre local no afecta a otros dispositivos.
- Plantilla lista para pegar: `supabase/plantillas-correo/acceso-peluchic.html`, con `{{ .Token }}` y botón `{{ .ConfirmationURL }}`.

### Autorización y control de María

- La entrada a las rutas solicita al servidor el permiso de su página, además de sesión y pertenencia. El HTML inicial del panel muestra una puerta de carga; no contiene los datos privados. Las funciones que entregan o modifican datos siguen autorizando por su cuenta, aunque se llamen directamente sin la interfaz.
- Las consultas privadas se mantienen delimitadas por salón; una sesión del salón B no concede acceso al A. Los endpoints públicos de reservas, perfil y disponibilidad siguen siendo públicos: no son acceso a fichas ni a ingresos.
- Accesos muestra invitadas, activas y dadas de baja, rol y última entrada disponible en Auth. Esta fecha es `last_sign_in_at` de la cuenta, **no** la última actividad ni una fecha específica de PeluChic.
- Cambios con confirmación dentro de la página; invitación con correo/rol en la hoja existente, bajas, reactivación y cierre de todos los dispositivos. Se mantiene el diseño existente.
- María no puede degradarse ni darse de baja a sí misma, aunque exista otra gerente. Comprobado también en servidor.
- Cierre remoto: RPC exclusivamente para service role que elimina refresh tokens y sesiones del destinatario. `auth.admin.signOut` necesita el JWT de esa persona, no su UUID; no se guardan JWT ajenos para simularlo. La RPC resuelve la alternativa de invalidación solicitada.
- Tras validar el JWT con Auth, cada petición autenticada comprueba su `session_id` contra la sesión vigente. Así el cierre remoto funciona también antes de que caduque el JWT. El cierre afecta a esa cuenta en todos los dispositivos y salones del proyecto; la confirmación lo advierte.
- La baja se comprueba leyendo la membresía en cada petición. El refresco del panel revisa acceso/rol y limpia la sesión local al detectar revocación; el servidor bloquea inmediatamente la siguiente operación protegida. Una pantalla sin red no puede recibir una orden remota hasta reconectar.

### Agujeros encontrados y cerrados

1. Rol desconocido o ficha que desaparecía entre lecturas podían acabar con permisos de gerente. Ahora se rechazan las fichas no verificables y roles desconocidos; solo se conservan los alias históricos explícitos `dueno` y `encargado`.
2. «Ver agenda completa» entregaba también a una estilista los importes y señales de citas ajenas. El recorte conserva esa agenda autorizada, pero elimina sus datos de cobro.
3. La guarda de alcance propio descartaba destinos nulos y pasaba a una comprobación genérica. Ahora un destino nulo/ausente explícito no autoriza a la estilista. Afectaba, por ejemplo, a conexiones de calendario del salón. El listado de conexiones externas se recorta igualmente al alcance permitido.
4. La puerta visual dejaba pasar si fallaba la comprobación, con riesgo de mostrar la copia local previa. Ahora falla cerrada.
5. Faltaban invalidación remota de sesiones, protección contra la autodegradación con varias gerentes y comprobación de página en servidor durante la navegación.

### Instalación

- Manifest específico `public/manifest-peluchic.webmanifest`: PeluChic, inicio relativo `/app?s=peluchic`, `display: standalone`, orientación vertical y scope `/` para incluir entrada y aceptación de invitaciones.
- Iconos 192, 512, maskable 512 y apple-touch-icon 180, derivados del logotipo transparente existente en `public/demo`, con fondo sólido y margen de seguridad. No se modifica `public/marca`.
- Metadatos iOS, título e icono PeluChic en su dominio. Se elimina el acceso flotante al rutero comercial del panel instalado.
- Aviso «Instalar en este dispositivo» en el panel: instrucciones iPhone/iPad, botón del evento `beforeinstallprompt` cuando Chrome lo ofrece y alternativa del menú/icono en ordenador. Se oculta en modo standalone y tras instalar.
- `public/panel-sw.js` es exclusivamente de red, para compatibilidad de instalación. No usa Cache Storage ni guarda datos, sesiones o respuestas del servidor; no ofrece funcionamiento sin conexión.
- Navegación interna con el router y URLs del mismo origen. Los retornos de correo usan el origen actual; no se fija ningún dominio `vercel.app`.
- No se han tocado `src/styles.css` ni `src/components/ui`.

## Pasos de Tomás en Supabase y despliegue

1. Confirmar que existe `salons.slug = 'peluchic'` y que María tiene en `salon_members` su UUID correcto, `salon_slug = 'peluchic'`, rol `gerente` y estado `activa`. Vincular cada estilista a su `employee_id` correcto del equipo de PeluChic.
2. Comprobar las migraciones anteriores de `supabase/pendiente.sql` para `salon_members`, `salon_invitaciones` y permisos extra. No ejecutar ciegamente todo el histórico si ya está aplicado. Mantener RLS y sin lectura directa de datos privados desde la clave pública.
3. Ejecutar **`supabase/acceso-app.sql` como postgres en SQL Editor antes de desplegar**. Las dos funciones revocan acceso a `public`, `anon` y `authenticated` y solo conceden ejecución a `service_role`. La invalidación toca tablas de Auth: ensayar primero con una cuenta de prueba en este proyecto y repetir la comprobación si cambia su esquema administrado.
4. Variables: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en la compilación; `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` solo en servidor. Nunca poner la service role en una variable `VITE_`.
5. Authentication › Email Templates › **Magic Link**: asunto «Tu código para entrar a PeluChic»; pegar `supabase/plantillas-correo/acceso-peluchic.html`. La invitación administrativa inicial sigue usando la plantilla **Invite user** de Supabase; traducirla y conservar su botón `{{ .ConfirmationURL }}`. Para entrar por código desde la app recién instalada, pedir «Enviar código»: ese correo usa Magic Link y lleva ambos métodos. Mantener activo el proveedor Email y configurar OTP de **6 cifras**. Caducidad sugerida: 1 hora; comprobar límites de reenvío.
6. Authentication › URL Configuration: autorizar los retornos `https://peluchic.sishow.es/app**` y `https://peluchic.sishow.es/aceptar**` (o las URLs exactas usadas con sus parámetros). Verificar en un envío real que Supabase no sustituye el retorno por Site URL. Si el proyecto es exclusivo de PeluChic, Site URL puede ser `https://peluchic.sishow.es/app?s=peluchic`; si es compartido, conservar el Site URL general de siShow y añadir los retornos de PeluChic.
7. Authentication › Sessions: desactivar sesión única por usuario; dejar sin límite la duración máxima y la caducidad por inactividad. Mantener la rotación normal de refresh tokens y una duración normal del JWT. No hace falta un JWT de meses: la sesión se renueva.
8. Configurar SMTP propio: host, puerto, credenciales y remitente verificado. Verificar SPF/DKIM y entrega a los proveedores del equipo. El SMTP de prueba de Supabase tiene restricciones y no debe ser la dependencia de la instalación. Desactivar reescritura/seguimiento de enlaces que consuma o altere enlaces de un solo uso.
9. Publicar estos commits mediante el procedimiento de Tomás, con HTTPS y el dominio `peluchic.sishow.es` activo. Este encargo no hace push, merge a main ni despliegue.
10. Probar una cuenta de estilista, otra de otro salón y el cierre remoto con cuentas de ensayo antes de hacerlo con María. Verificar que el token antiguo queda rechazado, que no se renueva y que un código nuevo permite entrar otra vez sin quitar la membresía.

Referencias comprobadas: [sesiones y límites](https://supabase.com/docs/guides/auth/sessions), [correo sin contraseña](https://supabase.com/docs/guides/auth/auth-email-passwordless), [SMTP](https://supabase.com/docs/guides/auth/auth-smtp) y [firma de admin.signOut](https://supabase.com/docs/reference/javascript/auth-admin-signout).

## Comprobación del 22-oct, 14:00

Usar `https://peluchic.sishow.es/app?s=peluchic` en cada dispositivo, en navegación normal.

### iPhone

- [ ] Abrir en Safari → Compartir → Añadir a pantalla de inicio; comprobar nombre e icono PeluChic.
- [ ] Abrir desde el icono. Si pide acceso, pedir el código desde ESA ventana; el correo puede leerse en otra app. Safari y la app instalada pueden tener almacenes distintos.
- [ ] Pegar seis cifras y comprobar entrada automática y rol correcto. Ensayar código erróneo y reenvío.
- [ ] Navegar por Inicio/Calendario/Citas: sin saltar a Safari y sin barras de navegador.
- [ ] Cerrar la app, abrirla otra vez y reiniciar el móvil: sigue dentro. Reabrir después del vencimiento del JWT con conexión para comprobar renovación.

### iPad del salón

- [ ] Instalar con Compartir → Añadir a pantalla de inicio y entrar desde el icono con su propio código.
- [ ] Comprobar icono, nombre, ausencia de barras y del botón del rutero, y navegación interna.
- [ ] Cerrar/reabrir, reiniciar y comprobar renovación tras el vencimiento del JWT.
- [ ] Mantener a María conectada simultáneamente en móvil, iPad y ordenador; entrar en uno no expulsa los otros.

### Android / Chrome

- [ ] Abrir el panel, desplegar «Instalar en este dispositivo» y pulsar Instalar si aparece. Si no, menú de Chrome → Instalar/Añadir a pantalla de inicio.
- [ ] Abrir el icono y comprobar standalone, login por código, retorno al panel y ocultación del aviso de instalación.
- [ ] Cerrar/reabrir y comprobar renovación de sesión.

### Ordenador / Chrome o Edge

- [ ] Instalar desde el icono de la barra de direcciones o el menú; abrir la ventana de la app.
- [ ] Entrar por código; en un envío independiente probar también el botón del correo. Código y enlace son alternativas de un solo uso, no se espera reutilizar ambos.
- [ ] Cerrar todas las ventanas, reabrir y comprobar que conserva sesión.
- [ ] Cerrar sesión localmente aquí y confirmar que el móvil/iPad siguen dentro.

### María y separación de accesos

- [ ] Invitar correo de ensayo como estilista y vincular profesional. Comprobar estado Invitada; entrar y verificar Activa y última entrada.
- [ ] Confirmar/cancelar cambio de rol y baja desde la página. Confirmar que María no puede quitarse su rol ni darse de baja.
- [ ] Como estilista, abrir directamente Ajustes/Accesos/Caja/Analítica: denegadas salvo las excepciones expresamente configuradas. Sus APIs tampoco deben dar datos por llamada directa.
- [ ] Verificar citas/clientas propias; «agenda completa» no debe mostrar cobros ajenos.
- [ ] Con cuenta de otro salón, pedir el panel de PeluChic: sin datos privados y con mensaje de pedir acceso.
- [ ] Dar de baja la cuenta de ensayo mientras tiene la app abierta: siguiente operación protegida rechazada, salida al comprobar acceso/refrescar.
- [ ] Reactivar y abrir dos dispositivos de ensayo. «Cerrar sesión en todos sus dispositivos»: ambos fuera en la siguiente comprobación; un código nuevo permite volver a entrar.
- [ ] Dejar las cuentas reales con sus roles definitivos y retirar o dar de baja las de ensayo.

## Validación local

Se ejecutan pruebas completas con `bun test` y compilación con `npm run build`. Las nuevas pruebas ejecutan también funciones de servidor reales con dobles de Supabase: denegación de rutas/acciones, aislamiento entre salones, ingresos propios, baja inmediata y dos sesiones que se invalidan juntas. No son un ensayo contra el Supabase remoto.

El `node_modules` inicial era un enlace a otra copia de trabajo de solo lectura. Para compilar se sustituyó localmente por una copia de las mismas dependencias; no se cambió package.json ni el lockfile y no se versionan las dependencias.

Comprobación adicional `tsc --noEmit`: el repositorio mantiene errores ajenos a este encargo en imports de tests con sufijos `?doble`, avatar-dicebear, lista-citas y un test de configuración PeluChic. No se presenta como una comprobación en verde; las dos comprobaciones solicitadas se registran debajo con su resultado final.

Resultados finales:

- `bun test`: **2.056 correctos, 0 fallidos, 1 omitido** (2.057 pruebas, 209 archivos).
- `npm run build`: **correcto**, salida de producción Vercel generada. Permanecen avisos del repositorio sobre `inputValidator` obsoleto y tamaños de bundles.
- `git diff --check`: correcto.
- No se pudo abrir una vista local para ensayo manual: el entorno rechazó escuchar en `127.0.0.1:8096` con `EPERM`. No se afirma haber comprobado visualmente el flujo completo ni la instalación física. Se inspeccionaron los recursos y las dimensiones de los iconos, y se comprobó el flujo de autorización mediante tests.

## Entrega de commits: limitación del entorno

El intento de `git add`/`git commit` en esta copia falló al crear `/home/tomi/Documents/starcarpet/Trimly/.git/worktrees/pc-feedback/index.lock`: **Read-only file system**. No se ha avanzado la rama original. Todos los cambios permanecen en el árbol de trabajo.

Como entrega recuperable, se han creado commits reales en un repositorio temporal autorizado, partiendo exactamente de `6f442fcab8c32077d009c5e119d2c7a5b7fc49e5`, y se han exportado a **`entrega-acceso-app/commits.bundle`**. Sus mensajes e identificadores están en `entrega-acceso-app/COMMITS.txt`. No se ha hecho push.

Desde un entorno con escritura en Git, importar primero en una rama nueva, sin modificar los cambios locales actuales:

```sh
git fetch ./entrega-acceso-app/commits.bundle codex/peluchic-feedback:refs/heads/codex/peluchic-acceso-app
```

Esto deja los commits disponibles para revisar e integrar. No aplicar los parches otra vez sobre esta copia sucia: los mismos cambios ya están presentes. Se puede abrir un worktree limpio de `codex/peluchic-acceso-app` y continuar el procedimiento habitual de integración de Tomás.
