# Lote 16 · BACKEND · 26-09-2026

Rama `codex/peluchic-backend`, avanzada por fast-forward a `5f09b90` (main).

## 16.1 · `api/foto` con ancho (`&w=`)

- `src/lib/api/foto.ts`: `anchoPedido(w)` acota a 320-1600; sin `w` o con basura, 1600 (lo de antes: los enlaces viejos no cambian). Se pide a Google `maxWidthPx=<w>`. Respuesta `Cache-Control: public, max-age=31536000, immutable` (cada `place+i+w` es una URL distinta).
- `src/lib/demo-photos.ts`, para FRONTEND:
  - `urlFoto(placeId, i, w)` → `/api/foto?place=…&i=…&w=…`.
  - `conAncho(url, w)` → añade o cambia `&w=` en una URL del proxy ya guardada (p. ej. `profile.heroImage`); una URL que no es del proxy se devuelve tal cual.
  - Uso: `<img src={conAncho(hero, 800)} srcSet={`${conAncho(hero, 800)} 800w, ${conAncho(hero, 1600)} 1600w`} sizes="(max-width: 768px) 100vw, 1600px">`.
- Tests: `foto.test.ts` (ancho pedido y cabecera), `demo-photos.test.ts`.

## 16.2 · «Lo antes posible» ofrecía horas pasadas

**Causa raíz**: en el paso 3 de `src/routes/s.$salonSlug.book.tsx` ni `isDayDisabled` ni el `useMemo` de `slots` comparaban el hueco con «ahora»: para HOY se listaban todas las horas del horario, también las pasadas. Un sábado a las 19:05 quedaban libres huecos de la mañana, así que el día no se descartaba, se autoseleccionaba y `firstAvailable` (primer slot libre del día) era las 12:30.

**Arreglo**:
- `src/lib/primer-hueco.ts` (nuevo, puro): `huecoAunReservable(fecha, hora, zona, ahora, antelación)` compara instantes (hora de agenda en la zona del salón → ISO), así que el cambio de hora y un navegador en otra zona no lo engañan; `primerHuecoReservable(...)` recorre días hasta encontrar uno; `antelacionMinima()` con 30 min por defecto.
- Perfil: campo opcional `antelacionMinimaMin` (`src/lib/mock/types.ts`); ausente = 30.
- Pantalla: los dos bucles (día deshabilitado y lista de horas) descartan los huecos no reservables. Así, si hoy ya no queda nada, el día se deshabilita, se autoselecciona el siguiente con hueco y «Lo antes posible» sale de ahí. Domingos y días sin horario ya estaban deshabilitados.
- Tests (`primer-hueco.test.ts`): sábado a las 19:05 → lunes 09:00; jueves a las 13:59 → 14:00 con 0 min de margen y 14:30 con 30; a las 19:50 con cierre a las 20:00 → mañana; domingo y día libre de la profesional; cambio de hora de octubre.

Pendiente fuera de este lote: `formatSlotLabel` y `today` del paso 3 usan la zona del navegador (etiqueta «hoy/mañana»). Es un defecto menor, que solo aparece si quien reserva está en otra zona.

## Verificación

`tsc` limpio · `TZ=UTC bun test`: 1414 pass, 1 skip, 0 fail (main `5f09b90`: 1406 + 1 skip; +8 tests) · `bun run build` sale con 0.
