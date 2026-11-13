import { describe, expect, it } from 'vitest';
import { calcularAcumulado, calcularMes } from '../src/calculo.js';
import { compararSinRfc } from '../src/comparador.js';
import { centavos as c } from '../src/dinero.js';
import { PARAMETROS_2026 } from '../src/parametros/2026.js';
import type { PeriodoEntrada } from '../src/tipos.js';

// Caso B del brief: Luis, conductor de Uber y DiDi, octubre 2026.
function mesLuis(mes: number): PeriodoEntrada {
  return {
    anio: 2026,
    mes,
    ingresos: [
      {
        app: 'uber',
        giro: 'transporte',
        subtotalCent: c('19000'),
        isrRetenidoCent: c('399'),
        ivaRetenidoCent: c('1520'),
        conRfc: true,
      },
      {
        app: 'didi',
        giro: 'transporte',
        subtotalCent: c('13000'),
        isrRetenidoCent: c('273'),
        ivaRetenidoCent: c('1040'),
        conRfc: true,
      },
    ],
    gastos: [
      { concepto: 'Gasolina', subtotalCent: c('9000'), ivaCent: c('1440') },
      { concepto: 'Mantenimiento', subtotalCent: c('2000'), ivaCent: c('320') },
      { concepto: 'Celular', subtotalCent: c('500'), ivaCent: c('80') },
    ],
  };
}

const anioLuis = Array.from({ length: 10 }, (_, i) => mesLuis(i + 1));

describe('caso Luis, octubre 2026', () => {
  const r = calcularAcumulado(anioLuis, PARAMETROS_2026);

  it('ISR del mes $2,490.45', () => expect(r.isr.causadoDelMesCent).toBe(c('2490.45')));
  it('retenciones de ISR $672', () => expect(r.isr.retenidoDelMesCent).toBe(c('672')));
  it('ISR a pagar $1,818.45', () => expect(r.isr.aPagarCent).toBe(c('1818.45')));
  it('IVA a pagar $720.00', () => {
    expect(r.iva.trasladadoCent).toBe(c('5120'));
    expect(r.iva.acreditableCent).toBe(c('1840'));
    expect(r.iva.retenidoCent).toBe(c('2560'));
    expect(r.iva.aPagarCent).toBe(c('720'));
    expect(r.iva.saldoAFavorCent).toBe(0);
  });
  it('total a pagar $2,538.45', () => expect(r.totalCent).toBe(c('2538.45')));

  it('trae desglose línea por línea y versión de parámetros', () => {
    expect(r.metodo).toBe('acumulado');
    expect(r.versionParametros).toBe(PARAMETROS_2026.version);
    expect(r.lineas.length).toBeGreaterThan(8);
    expect(r.lineas.at(-1)).toMatchObject({ clave: 'total', montoCent: c('2538.45') });
  });

  it('el cálculo mensual de un solo mes da lo mismo que el acumulado de octubre', () => {
    const solo = calcularMes(mesLuis(10), PARAMETROS_2026);
    expect(solo.isr.aPagarCent).toBe(r.isr.aPagarCent);
    expect(solo.totalCent).toBe(r.totalCent);
  });

  it('con meses iguales, cada mes de enero a octubre difiere a lo más un centavo del mensual', () => {
    for (let n = 1; n <= 10; n++) {
      const rn = calcularAcumulado(anioLuis.slice(0, n), PARAMETROS_2026);
      expect(Math.abs(rn.isr.causadoDelMesCent - c('2490.45'))).toBeLessThanOrEqual(1);
    }
  });

  it('comparador: sin RFC $11,520; inscrito $5,770.45', () => {
    const comp = compararSinRfc(mesLuis(10), r, PARAMETROS_2026);
    expect(comp.sinRfcCent).toBe(c('11520'));
    expect(comp.inscritoCent).toBe(c('5770.45'));
    expect(comp.ahorroCent).toBe(c('5749.55'));
  });
});
