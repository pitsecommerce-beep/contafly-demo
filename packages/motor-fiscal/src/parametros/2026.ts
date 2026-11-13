import { centavos as c } from '../dinero.js';
import type { ParametrosFiscales, Tarifa } from '../tipos.js';

const FUENTE_RETENCIONES = 'Praxium, Retenciones de plataformas 2026 (art. 113-A LISR)';
const FUENTE_TARIFA = 'Art. 96 LISR, Anexo 8 RMF 2026, DOF 28/12/2025';

// Tarifa mensual 2026. Límite superior null = "en adelante".
const tarifaMensual: Tarifa = [
  ['0.01', '844.59', '0.00', 192],
  ['844.60', '7168.51', '16.22', 640],
  ['7168.52', '12598.02', '420.95', 1088],
  ['12598.03', '14644.64', '1011.68', 1600],
  ['14644.65', '17533.64', '1339.14', 1792],
  ['17533.65', '35362.83', '1856.84', 2136],
  ['35362.84', '55736.68', '5665.16', 2352],
  ['55736.69', '106410.50', '10457.09', 3000],
  ['106410.51', '141880.66', '25659.23', 3200],
  ['141880.67', '425641.99', '37009.69', 3400],
  ['425642.00', null, '133488.54', 3500],
].map(([li, ls, cuota, tasa]) => ({
  limiteInferiorCent: c(li as string),
  limiteSuperiorCent: ls === null ? null : c(ls as string),
  cuotaFijaCent: c(cuota as string),
  tasaExcedenteBp: tasa as number,
}));

export const PARAMETROS_2026: ParametrosFiscales = {
  version: 'MX-2026.1',
  anio: 2026,
  retencionIsrConRfc: {
    transporte: { valor: 210, fuente: FUENTE_RETENCIONES },
    hospedaje: { valor: 400, fuente: FUENTE_RETENCIONES },
    ventas: { valor: 250, fuente: `${FUENTE_RETENCIONES}; LIF 2026 art. 25 fr. VI (antes 1%)` },
  },
  retencionIsrSinRfc: { valor: 2000, fuente: 'Art. 113-C LISR' },
  tasaIva: { valor: 1600, fuente: 'Art. 1 LIVA' },
  retencionIvaConRfc: { valor: 800, fuente: 'Art. 18-J LIVA (50% del IVA)' },
  retencionIvaSinRfc: { valor: 1600, fuente: 'Art. 18-J LIVA (100% del IVA)' },
  topePagoDefinitivo: { valor: c('300000'), fuente: 'Art. 113-B LISR (ingresos del año anterior)' },
  tarifaMensual: { valor: tarifaMensual, fuente: FUENTE_TARIFA },
  multaBuzon: {
    valor: { minimaCent: c('3850'), maximaCent: c('11540'), desde: '2027-01-01' },
    fuente: 'SAT, Buzón Tributario',
  },
  diaVencimiento: {
    valor: 17,
    fuente: 'Art. 113-A LISR y 18-J LIVA; art. 12 CFF para días inhábiles',
  },
  // TODO: validar con contador. Tasa de recargos 2026 (LIF 2026, art. 8).
  tasaRecargosMensual: { valor: null, fuente: 'Pendiente: validar con contador' },
  // TODO: validar con contador. Factor de actualización con INPC (art. 17-A CFF).
  factorActualizacion: { valor: null, fuente: 'Pendiente: validar con contador' },
  // TODO: validar con contador. Multas por declaración omitida (art. 82 CFF).
  multaDeclaracionOmitida: { valor: null, fuente: 'Pendiente: validar con contador' },
};
