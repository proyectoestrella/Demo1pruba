# Web oficial archivada (retirada el 27-09-2026)

Tomás decidió retirar de la vista pública la «web oficial» de siShow
(`/`, `/funcionalidades`, `/precios`, `/contacto` con listados de
funcionalidades, precios y capturas con datos de PeluChic). El motivo, en
sus palabras: «ni se pueden enseñar todas las funcionalidades de una app en
una web de proyecto ni se puede usar un caso de un cliente, como es
PeluChic, para publicitar todo». PeluChic no es cliente todavía y no ha
dado permiso para usar su nombre en marketing.

Nada de esto se ha borrado: está aquí, fuera de `src/routes` y
`src/components/web`, así que TanStack Start no lo enruta.

## Qué hay

- `routes/index.tsx` — el inicio original (Portada, Problemas, Módulos,
  Semana, Demo, Precios resumen, Preguntas, CTA).
- `routes/funcionalidades.tsx`, `routes/precios.tsx`, `routes/contacto.tsx`
  — las tres páginas retiradas (`contacto.tsx` menciona a PeluChic como
  demo).
- `components/` — `Portada`, `Problemas`, `Modulos`, `Secciones`, `Planes`,
  `Dispositivos`, `capturas.ts` (capturas con datos de PeluChic) y
  `BotonCopiar` (solo lo usaba `contacto.tsx`). `IntroPagina` NO está aquí:
  se quedó en `src/components/web/` porque también la usan las páginas
  legales, que siguen vivas.

Lo que se quedó en su sitio y sigue vivo: `src/routes/index.tsx` (portada
nueva, sobria), `src/routes/legal.*` (avisos legales, sin mención a
PeluChic), y en `src/components/web/`: `Marca.tsx`, `Cabecera.tsx`,
`Pie.tsx`, `EsqueletoWeb.tsx`, `Legal.tsx`, `IntroPagina.tsx`, `estilos.ts`,
`web.css` — los sigue usando la portada nueva y las páginas legales.

El `tsconfig.json` excluye `src/web-archivada/**/*` de la comprobación de
tipos (sus imports a componentes movidos no resuelven solos): quita esa
línea del `exclude` al reactivar.

## Cómo reactivarla

1. Devolver los ficheros a su carpeta original:
   `git mv src/web-archivada/routes/funcionalidades.tsx src/routes/`
   `git mv src/web-archivada/routes/precios.tsx src/routes/`
   `git mv src/web-archivada/routes/contacto.tsx src/routes/`
   `git mv src/web-archivada/components/*.tsx src/web-archivada/components/*.ts src/components/web/`
   y quita la línea `"exclude": ["src/web-archivada/**/*"]` de `tsconfig.json`.
2. `git mv src/web-archivada/routes/index.tsx src/routes/index.tsx` (sustituye
   a la portada sobria; revisar antes si algo cambió mientras tanto).
3. En `src/lib/sishow-web.ts`: devolver `NAV_WEB` a sus tres enlaces, y
   revisar `PAGINAS_WEB.inicio` (título y descripción) si se cambiaron para
   la portada sobria.
4. En `src/components/web/Cabecera.tsx` y `Pie.tsx`: deshacer los cambios
   que quitaron los enlaces a Funcionalidades, Precios y Contacto (ver el
   commit que archivó esta web para el diff exacto).
5. Antes de volver a publicar con el caso de PeluChic: conseguir su permiso
   por escrito, o sustituir sus datos por los de un caso real con permiso.
6. `node_modules/.bin/tsc --noEmit -p .` y `bun run build` para comprobar
   que no queda ningún enlace roto.
