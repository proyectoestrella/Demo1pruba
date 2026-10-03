# Capturas locales de PeluChic

## Estado de esta revisión

Las cuatro capturas solicitadas no se generaron en este entorno. `bun run dev -- --host 127.0.0.1` falla con `listen EPERM` tanto en el puerto 8080 como en 4173; el sandbox no permite abrir el servidor local. El ejecutable disponible es Node 20.20.1, mientras `package.json` declara Node 22 o superior. No se usó la web de producción ni se simularon capturas.

Cuando Tomás ejecute la rama en una máquina con Node 22+ y navegador local, guardar aquí:

- `web-publica-390.png`
- `web-publica-1440.png`
- `panel-390.png`
- `panel-1440.png`

## Generación local para Tomás

Desde la raíz del repo, con Bun y Node 22+ instalados. La demo contiene datos ficticios: no sembrar ni exportar el perfil a producción.

~~~sh
bun -e 'import { encodeDemoProfile } from "./src/lib/demo-profile.ts"; import { PELUCHIC } from "./src/lib/demos/peluchic.ts"; process.stdout.write(encodeDemoProfile(PELUCHIC, { cartaCompleta: true }));' > /tmp/peluchic-demo-token
bun run dev -- --host 127.0.0.1
~~~

En otra terminal, usar Chromium o Chrome local. El servidor Vite suele escuchar en 8080 en este repo; confirmar el URL que imprima Vite:

~~~sh
DEMO=$(cat /tmp/peluchic-demo-token)
google-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --virtual-time-budget=8000 --window-size=390,844 --screenshot=docs/peluchic/capturas/web-publica-390.png "http://127.0.0.1:8080/s/peluchic?d=$DEMO&v=2"
google-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --virtual-time-budget=8000 --window-size=1440,1000 --screenshot=docs/peluchic/capturas/web-publica-1440.png "http://127.0.0.1:8080/s/peluchic?d=$DEMO&v=2"
google-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --virtual-time-budget=8000 --window-size=390,844 --screenshot=docs/peluchic/capturas/panel-390.png "http://127.0.0.1:8080/app?d=$DEMO"
google-chrome --headless --no-sandbox --disable-gpu --disable-dev-shm-usage --hide-scrollbars --virtual-time-budget=8000 --window-size=1440,1000 --screenshot=docs/peluchic/capturas/panel-1440.png "http://127.0.0.1:8080/app?d=$DEMO"
~~~

Revisar que la página ya hidrató antes de aceptar la captura. Identificar las cuatro imágenes como **demo con datos sintéticos** y no enviarlas como evidencia de configuración real de PeluChic.
