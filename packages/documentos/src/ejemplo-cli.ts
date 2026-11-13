import { writeFileSync } from 'node:fs';
import { DEMO_FECHA_POR_DEFECTO, LUIS, resumenMeses } from '@contafly/datos-demo';
import { datosAcuseDesdeMotor, generarAcuse } from './index.js';

const hoy = process.env.DEMO_FECHA ?? DEMO_FECHA_POR_DEFECTO;
const octubre = resumenMeses(LUIS, hoy).find((m) => m.mes === 10);
if (!octubre) throw new Error('Sin octubre de Luis');
const datos = datosAcuseDesdeMotor(LUIS, octubre.resultado, {
  presentadoEn: `${hoy}T18:42`,
  folio: 'luis-2026-10',
});
const salida = process.argv[2] ?? 'acuse-demo.pdf';
writeFileSync(salida, await generarAcuse(datos));
console.log(`Acuse de ejemplo en ${salida}`);
