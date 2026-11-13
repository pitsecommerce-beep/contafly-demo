import { describe, expect, it } from 'vitest';
import { centavos } from '../src/dinero.js';
import { PARAMETROS_2026 } from '../src/parametros/2026.js';
import { calcularTarifa, tarifaAcumulada } from '../src/tarifa.js';

const c = centavos;

// Tarifa mensual 2026 (art. 96 LISR, Anexo 8 RMF 2026, DOF 28/12/2025), tal como aparece en el brief.
const ENERO: Array<[string, string | null, string, number]> = [
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
];

// Octubre acumulado (enero a octubre): límite superior x10, límite inferior = superior anterior + 0.01, cuota x10.
const OCTUBRE: Array<[string, string | null, string, number]> = [
  ['0.01', '8445.90', '0.00', 192],
  ['8445.91', '71685.10', '162.20', 640],
  ['71685.11', '125980.20', '4209.50', 1088],
  ['125980.21', '146446.40', '10116.80', 1600],
  ['146446.41', '175336.40', '13391.40', 1792],
  ['175336.41', '353628.30', '18568.40', 2136],
  ['353628.31', '557366.80', '56651.60', 2352],
  ['557366.81', '1064105.00', '104570.90', 3000],
  ['1064105.01', '1418806.60', '256592.30', 3200],
  ['1418806.61', '4256419.90', '370096.90', 3400],
  ['4256419.91', null, '1334885.40', 3500],
];

function comparar(mes: number, esperada: typeof ENERO) {
  const tabla = tarifaAcumulada(PARAMETROS_2026, mes);
  expect(tabla).toHaveLength(esperada.length);
  esperada.forEach(([li, ls, cuota, tasa], i) => {
    const r = tabla[i];
    expect(r?.limiteInferiorCent).toBe(c(li));
    expect(r?.limiteSuperiorCent).toBe(ls === null ? null : c(ls));
    expect(r?.cuotaFijaCent).toBe(c(cuota));
    expect(r?.tasaExcedenteBp).toBe(tasa);
  });
}

describe('tarifa acumulada para pagos provisionales (art. 106 LISR)', () => {
  it('enero es igual a la tarifa mensual del Anexo 8', () => comparar(1, ENERO));
  it('octubre (enero a octubre) se construye multiplicando por 10', () => comparar(10, OCTUBRE));

  it('rechaza meses fuera de rango', () => {
    expect(() => tarifaAcumulada(PARAMETROS_2026, 0)).toThrow();
    expect(() => tarifaAcumulada(PARAMETROS_2026, 13)).toThrow();
  });

  it('calcula ISR con la mensual para la base de Luis ($20,500)', () => {
    const r = calcularTarifa(c('20500'), tarifaAcumulada(PARAMETROS_2026, 1));
    expect(r.isrCent).toBe(c('2490.45'));
    expect(r.renglon).toBe(6);
  });

  it('base cero o negativa no causa ISR', () => {
    expect(calcularTarifa(0, tarifaAcumulada(PARAMETROS_2026, 1)).isrCent).toBe(0);
    expect(calcularTarifa(-500, tarifaAcumulada(PARAMETROS_2026, 1)).isrCent).toBe(0);
  });

  it('usa el último renglón sin límite superior', () => {
    const r = calcularTarifa(c('500000'), tarifaAcumulada(PARAMETROS_2026, 1));
    expect(r.renglon).toBe(11);
    // 133,488.54 + 35% x (500,000 - 425,642.00) = 159,513.84
    expect(r.isrCent).toBe(c('159513.84'));
  });
});
