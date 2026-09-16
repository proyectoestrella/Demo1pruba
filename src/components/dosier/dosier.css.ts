/**
 * CSS del dosier comercial imprimible: puerto literal de `BASE_CSS` en el
 * generador Python de referencia (`gen2.py`, 16-sep-2026), más `.dosier-toolbar`
 * al final, que el script no necesita porque solo genera HTML para imprimir.
 *
 * Las reglas `.known` / `.compact` se portan tal cual aunque esta ruta nunca
 * las active (el bloque "Lo que nos contaste" no viaja a React, ver
 * `src/lib/dosier-content.ts`): mantiene el CSS fiel al original completo.
 */
export const DOSIER_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body { background: #ffffff; }
:root { --cream: #F4F1E6; --green: #1E4432; --green-tint: #E9F1EC; --red: #B23B3B; --red-tint: #F3E7E2;
  --ink: #1C1914; --ink-soft: #4B4A44; --hablamos-bg: #FBF9F1; --hablamos-border: #E4DCC6; --gold: #9A6F1F; --gold-tint: #F3EAD6; }
body { font-family: 'Karla', sans-serif; color: var(--ink); }
.page { width: 210mm; height: 297mm; position: relative; background: var(--cream); break-after: page; overflow: hidden; }
.page:last-child { break-after: auto; }
.topbar { position: absolute; top: 0; left: 0; right: 0; height: 2.2mm; background: var(--green); }
.content { position: absolute; top: 12mm; left: 18mm; right: 18mm; bottom: 15mm; }
.pfooter { position: absolute; left: 18mm; right: 18mm; bottom: 8mm; display: flex; justify-content: space-between; align-items: center;
  font-family: 'DM Mono', monospace; font-size: 7.3pt; color: var(--ink-soft); border-top: 0.5pt solid #D8D2BF; padding-top: 3mm; }
.headerrow { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 3mm; }
.logo { font-family: 'Big Shoulders Display', sans-serif; font-weight: 700; font-size: 23pt; color: var(--ink); letter-spacing: 0.5px; }
.eyebrow { font-family: 'DM Mono', monospace; font-size: 8pt; letter-spacing: 1px; color: var(--green); text-transform: uppercase; margin: 1mm 0 6mm 0; }
h1.headline { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; line-height: 0.98; margin: 0 0 5mm 0; color: var(--ink); }
.lead { font-size: 10.3pt; line-height: 1.55; color: var(--ink); max-width: 168mm; margin: 0 0 5mm 0; }
.callout { border-left: 2.4pt solid var(--red); background: #fff; padding: 4mm 6mm; margin: 0 0 6mm 0; font-size: 10.5pt; line-height: 1.5; }
.callout b { color: var(--red); font-weight: 700; }
.callout.green { border-left-color: var(--green); }
.callout.green b { color: var(--green); }
h2.section { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; font-size: 16pt; color: var(--green); margin: 0 0 2mm 0; }
ul.bullets { list-style: none; margin: 0 0 5mm 0; padding: 0; }
ul.bullets li { font-size: 10pt; line-height: 1.45; padding-left: 4mm; position: relative; margin-bottom: 1.6mm; }
ul.bullets li::before { content: '•'; color: var(--red); position: absolute; left: 0; font-weight: 700; }
ul.bullets.green li::before { color: var(--green); }
.booking { border: 0.6pt solid #C9C2AA; margin-top: 4mm; background: #fff; }
.booking-head { background: var(--green); color: #fff; display: flex; justify-content: space-between; align-items: center; padding: 3.2mm 5mm; }
.booking-head .bname { font-family: 'Karla', sans-serif; font-weight: 700; }
.booking-head .bsishow { font-family: 'DM Mono', monospace; font-size: 8pt; opacity: 0.85; }
.booking-row { display: flex; padding: 3mm 5mm; border-bottom: 0.5pt solid #E4DEC9; }
.booking-row .label { font-family: 'DM Mono', monospace; font-size: 7.6pt; color: var(--ink-soft); letter-spacing: 0.5px; width: 42mm; text-transform: uppercase; }
.booking-row .value { font-size: 10pt; font-weight: 700; }
.booking-foot { background: var(--green-tint); padding: 2.6mm 5mm; font-size: 9.3pt; font-weight: 700; color: var(--green); }
.booking-caption { text-align: center; font-family: 'DM Mono', monospace; font-size: 7.5pt; color: var(--ink-soft); margin-top: 3mm; }
h1.title2 { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; font-size: 26pt; color: var(--ink); margin: 0 0 2mm 0; }
.subtitle2 { font-size: 10pt; line-height: 1.5; color: var(--ink); max-width: 170mm; margin-bottom: 6mm; }
.steps { margin-bottom: 6mm; }
.step { display: flex; padding: 3mm 0; border-bottom: 0.5pt solid #DCD5BE; }
.step:last-child { border-bottom: none; }
.step .num { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; font-size: 22pt; color: var(--red); width: 14mm; flex: none; line-height: 1; }
.step .stext .stitle { font-size: 10.6pt; font-weight: 700; margin-bottom: 0.8mm; }
.step .stext .sbody { font-size: 9.3pt; line-height: 1.42; color: var(--ink-soft); max-width: 150mm; }
.pricebox { display: flex; border-radius: 1.5pt; overflow: hidden; }
.pricebox .left { background: var(--green); color: #fff; flex: 1.15; padding: 6mm; }
.pricebox .right { background: var(--green); color: #fff; flex: 1; padding: 6mm; border-left: 0.7pt solid rgba(255,255,255,0.25); }
.pricebox .left .ptitle { font-family: 'Big Shoulders Display', sans-serif; font-weight: 700; font-size: 15pt; line-height: 1.12; margin-bottom: 3mm; }
.pricebox .left .psub { font-size: 8.8pt; line-height: 1.5; opacity: 0.92; }
.pricebox .right .plabel { font-family: 'DM Mono', monospace; font-size: 7.6pt; letter-spacing: 0.6px; opacity: 0.85; margin-bottom: 2mm; }
.pricebox .right .pmain { font-family: 'Big Shoulders Display', sans-serif; font-weight: 700; font-size: 15pt; line-height: 1.25; }
.pricebox .right .pnote { font-family: 'DM Mono', monospace; font-size: 7.4pt; opacity: 0.85; margin-top: 2.5mm; line-height: 1.4; }
.pricecaption { text-align: center; font-size: 8.6pt; color: var(--ink-soft); margin-top: 5mm; }
h1.title3 { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; font-size: 26pt; color: var(--ink); margin: 0 0 2mm 0; }
.subtitle3 { font-size: 10pt; margin-bottom: 5mm; max-width: 165mm; line-height: 1.45; }
table.cmp { width: 100%; border-collapse: collapse; margin-bottom: 5mm; table-layout: fixed; }
table.cmp thead td { background: var(--ink); color: #fff; font-family: 'DM Mono', monospace; font-size: 7.6pt; letter-spacing: 0.6px; text-transform: uppercase; padding: 2.6mm 4mm; }
table.cmp tbody td { vertical-align: top; padding: 3mm 4mm; font-size: 8.9pt; line-height: 1.38; }
table.cmp tbody tr td.sit { background: var(--red-tint); }
table.cmp tbody tr td.con { background: var(--green-tint); }
table.cmp .rowtitle { font-weight: 700; margin-bottom: 1.2mm; display: block; }
table.cmp .rowtitle.con-t { color: var(--green); }
table.cmp ul { list-style: none; margin: 0; padding: 0; }
table.cmp li { position: relative; padding-left: 3.2mm; margin-bottom: 0.6mm; }
table.cmp li::before { content: '•'; color: var(--red); position: absolute; left: 0; }
table.cmp .con li::before { color: var(--green); }
.known { border: 0.8pt solid var(--gold); background: var(--gold-tint); padding: 4mm 6mm; margin: 0 0 5mm 0; }
.known h3 { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; font-size: 13pt; margin: 0 0 2mm 0; color: var(--gold); }
.known ul { list-style: none; margin: 0; padding: 0; }
.known li { font-size: 9.2pt; line-height: 1.42; padding-left: 4mm; position: relative; margin-bottom: 1.2mm; }
.known li::before { content: '•'; color: var(--gold); position: absolute; left: 0; font-weight: 700; }
.hablamos { border: 0.8pt solid var(--hablamos-border); background: var(--hablamos-bg); padding: 6mm 8mm; display: flex; justify-content: space-between; align-items: center; margin-top: 3mm; }
.hablamos .htext { max-width: 96mm; }
.hablamos h2 { font-family: 'Big Shoulders Display', sans-serif; font-weight: 800; font-size: 19pt; margin: 0 0 3mm 0; }
.hablamos p { font-size: 9.6pt; line-height: 1.5; margin: 0 0 4mm 0; }
.hablamos .contact { font-size: 9.6pt; }
.hablamos .contact .carlos { font-weight: 700; color: var(--green); }
.hablamos .contact .tel { font-weight: 700; color: var(--green); }
.hablamos .contact .mail { font-family: 'DM Mono', monospace; font-size: 8.3pt; color: var(--ink-soft); }
.qrbox { text-align: center; }
.qrbox img.qr { width: 48mm; height: 48mm; display: block; image-rendering: pixelated; }
.qrbox .qrcap { font-family: 'DM Mono', monospace; font-size: 7pt; color: var(--ink-soft); margin-top: 1.5mm; max-width: 48mm; line-height: 1.3; }
.blank4 .content { top: 0; bottom: 0; }
.compact table.cmp tbody td { padding: 2.2mm 3.5mm; font-size: 8.3pt; line-height: 1.32; }
.compact table.cmp { margin-bottom: 3.5mm; }
.compact .subtitle3 { margin-bottom: 3.5mm; }
.compact .known { padding: 3mm 5mm; margin-bottom: 3.5mm; }
.compact .known li { font-size: 8.6pt; line-height: 1.36; margin-bottom: 0.8mm; }
.compact .hablamos { padding: 4mm 6mm; margin-top: 2mm; }
.compact .hablamos h2 { font-size: 16pt; margin-bottom: 2mm; }
.compact .hablamos p { font-size: 9pt; margin-bottom: 3mm; }
.compact .qrbox img.qr { width: 42mm; height: 42mm; }

/* Barra de pantalla (fuera del spec de gen2.py): nunca sale en la impresión. */
@media print {
  .dosier-toolbar { display: none !important; }
}
`;
