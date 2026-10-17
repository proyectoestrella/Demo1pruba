# Plan noche C2 — informe de casos límite y rendimiento

Fecha: 17 de octubre de 2026. Todos los datos usados en las pruebas son ficticios.

## Cobertura ejecutada

- Fianza: duración cero, fraccionaria, negativa y `NaN`; servicios combinados, desconocidos y «Otro»; tarifa de 0 € y decimal; redondeo de 0 a 240 minutos en todos los múltiplos de cinco; duración manual de una cita ya creada; y ausencia de los textos `NaN €` o importes negativos.
- Duración flexible: servicios de 15, 30, 60 y 120 minutos, combinación de servicios, extremo alto de reserva, cierre de martes-viernes a las 20:00 y sábado a las 14:00.
- Reservas: solapes y citas contiguas; bloqueo de comida del viernes; festivos de 12 de octubre y 2 de noviembre; turno particular de María; medianoche; reserva pasada; servicios exclusivos, «cualquiera disponible» y servicio sin nadie asignada; transiciones horarias de marzo y octubre en `Europe/Madrid`.
- Importación TPV 123: BOM, CSV con `,` y `;`, comillas y saltos de línea, cabeceras con tildes y mayúsculas, columnas extra, filas vacías, códigos duplicados dentro del archivo y contra la ficha, móviles/fijos con formatos distintos y longitudes inválidas, correo inválido, DNI/NIE/CIF, apóstrofos y ñ, fechas europeas, ISO, serie de Excel, fecha-hora, año de dos cifras, fechas imposibles, cumpleaños sin año y fila con solo código. La lectura de un `.xlsx` comprimido real ya está cubierta en `src/lib/importar-clientas.test.ts`.

La nueva batería agrupada está en `src/lib/__casos-limite__/plan-noche-c2.test.ts`.

## Fallos encontrados y corregidos

| Área | Entrada que lo provocaba | Resultado anterior | Corrección |
| --- | --- | --- | --- |
| Fianza | Regla fija o porcentual con `priceEur: NaN` | `importeSenal` devolvía `NaN`; podía acabar en un texto `NaN €`. | Se normalizan precio, porcentaje e importe fijo a números finitos no negativos; el formateo también queda blindado. |
| Importación | `05/11/85` o `05-11-26 13:40` | La fecha quedaba sin importar y generaba aviso. | Se admite año europeo de dos cifras con pivote 70: `00–69` → 2000–2069 y `70–99` → 1970–1999. |
| Reserva pública | Petición fabricada con `startISO` pasado o inválido | No había una guarda explícita antes de comprobar agenda y escribir. | El servidor rechaza `RESERVA_PASADA` antes de cualquier escritura; la web muestra «Esa hora ya ha pasado. Elige otra hora disponible». |

## Rendimiento

Medido dentro de la prueba con `performance.now()` durante la suite completa:

| Operación | Datos | Resultado | Objetivo |
| --- | ---: | ---: | ---: |
| `vistaPreviaClientas` | 1.500 filas + 600 clientas existentes | 29,55 ms | < 300 ms |
| `ordenarCitasProximasPrimero` | 3.300 citas | 1,56 ms | < 50 ms |
| `buscarClientas` | 1.500 fichas | 13,87 ms | < 30 ms |

No ha hecho falta optimizar: las tres medidas cumplen su objetivo conservando los resultados.

## No corregido

- El formato `.xls` antiguo sigue rechazándose con instrucciones para guardarlo como `.xlsx` o `.csv`: el lector soportado es deliberadamente solo para formatos sin macros y ya hay un mensaje específico.
- No se valida el dígito de control de DNI/NIE/CIF: el importador conserva el identificador y avisa de formatos desconocidos para no rechazar históricos legítimos de TPV 123 por una regla fiscal que no puede verificar de forma fiable aquí.
- En una primera ejecución completa apareció una vez un fallo temporal de orden en una prueba preexistente de reintentos de sincronización. Se repitió exactamente la verificación solicitada y pasó con 0 fallos; no se modificó esa parte ajena al alcance.

## Verificación

```text
$ bun test 2>&1 | tail -8
1849 pass
1 skip
0 fail
48540 expect() calls
Ran 1850 tests across 181 files. [28.76s]

$ bun run build 2>&1 | rg "built in|rror"
✓ built in 13.25s
✓ built in 6.47s
```

El segundo comando también muestra avisos conocidos de dependencias sobre la directiva `use client`; el proceso terminó correctamente.
