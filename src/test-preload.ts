// Fija la zona horaria del proceso de pruebas ANTES de que se evalúe ningún
// módulo: así `new Date("2026-09-26T10:00")` y `toLocaleTimeString` dan lo
// mismo en el portátil de Madrid y en una CI en UTC.
process.env.TZ = "Europe/Madrid";
