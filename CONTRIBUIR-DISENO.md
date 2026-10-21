# Trabajar a tres en PeluChic sin pisarnos (desde el 21-oct-2026)

Tres personas tocan esto a la vez: la diseñadora (aspecto), Tomás (pruebas, backend, decisiones) y la IA
(lógica, integración, tests). La regla que evita el caos es **una rama por persona y un dueño por carpeta**.

## Ramas

| Rama | Quién escribe | Para qué |
|---|---|---|
| `main` | solo Tomás (push = despliegue en Vercel) | lo que ve PeluChic en producción |
| `codex/peluchic-feedback` | la IA (integración) | lo que se prueba en el 8094 y se publicará; de aquí sale todo |
| `diseno/<nombre>` | la diseñadora | su trabajo, siempre partiendo de `codex/peluchic-feedback` |
| `codex/pc-*` | la IA | arreglos de lógica, uno por tema |

Nadie hace `push --force` ni toca la rama de otro. Lo de la diseñadora entra en `codex/peluchic-feedback`
por Pull Request o cuando ella diga «lista»: la IA lo fusiona, pasa `bun test` y `npm run build`, y Tomás
lo ve en el 8094 (Vite recarga solo) o en la vista previa de Vercel de la rama.

## Dueño por carpeta

| Carpeta o fichero | Dueño | Los demás |
|---|---|---|
| `src/styles.css`, `DESIGN.md`, `public/fonts`, `public/marca`, `src/components/ui/**` | diseñadora | no se toca sin avisar |
| `src/components/**` (pantallas: Hoy, Calendario, Clientas, Equipo, Citas, Ajustes, shell) | diseñadora en lo visual; IA en lo funcional | cambios pequeños y avisados; si hay conflicto, manda lo visual de ella y lo funcional de la IA |
| `src/routes/**`, `src/lib/**`, `supabase/**`, `api/**`, `tests/**` | IA | la diseñadora no los toca; si necesita datos de ejemplo, lo pide |
| Decisiones de producto (plan Básico, qué se oculta, textos legales, precios) | Tomás | se registran en `ambitos/starproyect` de Logibro |

## Flujo diario

1. La diseñadora empieza el día con `git pull` de `codex/peluchic-feedback` y lo mezcla en su rama
   (`git merge codex/peluchic-feedback`), así nunca se aleja.
2. Commits pequeños y frecuentes con mensaje claro («Calendario: cabecera translúcida»). `git push` a su rama.
3. Cuando quiera que Tomás lo vea: PR a `codex/peluchic-feedback` o aviso. La IA fusiona el mismo día.
4. Tomás prueba en `http://127.0.0.1:8094/demo/peluchic` (PC) o en la IP del PC desde el móvil, y en la
   vista previa de Vercel de la rama si está fuera de casa.
5. Publicar a `main` solo lo hace Tomás, con el SQL antes y la puerta de publicación de Logibro.

## Qué no hacer

- No trabajar sobre la copia suelta de `AlmacenExterno/peluchic/app-rediseno-2026-10`: ya está superada; todo va por git.
- No editar `routes`, `lib` o `supabase` desde la rama de diseño.
- No commitear `.env*`, claves ni capturas pesadas (van a AlmacenExterno).
- No subir `node_modules` ni `dist`.

## Arranque para la diseñadora (una vez)

```bash
git clone https://github.com/proyectoestrella/Demo1pruba.git peluchic && cd peluchic
git checkout codex/peluchic-feedback
git checkout -b diseno/<tu-nombre>
bun install && bun run dev          # abrir http://localhost:8080/demo/peluchic
```
