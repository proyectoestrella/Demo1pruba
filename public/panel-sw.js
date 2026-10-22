// PWA del panel: sin Cache Storage, datos ni sesión offline. Sin manejador
// `fetch` (auditoría D3, 22-oct): cada petición va directa a la red como en
// una web normal; Chrome ya no exige `fetch` para poder instalar.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
