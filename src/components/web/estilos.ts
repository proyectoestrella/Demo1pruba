import css from "./web.css?raw";

/**
 * Hoja de estilos de la web oficial, en línea en el `<head>` de cada página
 * (`head().styles`): son pocos KB, no bloquean con otra petición y no entran
 * en el CSS global del panel.
 */
export const ESTILOS_WEB = { children: css };
