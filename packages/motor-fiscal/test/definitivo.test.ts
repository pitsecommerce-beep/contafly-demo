import { describe, expect, it } from 'vitest';
import { calcularAcumulado, calcularPagoDefinitivo } from '../src/calculo.js';
import { centavos as c } from '../src/dinero.js';
import { PARAMETROS_2026 } from '../src/parametros/2026.js';
import { recomendar } from '../src/recomendar.js';
import { retencionEsperada } from '../src/retenciones.js';
import type { PeriodoEntrada } from '../src/tipos.js';

describe('retenciones de plataformas 2026', () => {
  it('sin RFC con $15,000 en transporte: $5,400', () => {
    const r = retencionEsperada(c('15000'), 'transporte', false, PARAMETROS_2026);
    expect(r.isrCent).toBe(c('3000'));
    expect(r.ivaCent).toBe(c('2400'));
    expect(r.isrCent + r.ivaCent).toBe(c('5400'));
  });

  it('inscrito con $15,000 en transporte: $1,515', () => {
    const r = retencionEsperada(c('15000'), 'transporte', true, PARAMETROS_2026);
    expect(r.isrCent).toBe(c('315'));
    expect(r.ivaCent).toBe(c('1200'));
    expect(r.isrCent + r.ivaCent).toBe(c('1515'));
  });

  it('tasas por giro con RFC', () => {
    expect(retencionEsperada(c('10000'), 'hospedaje', true, PARAMETROS_2026).isrCent).toBe(
      c('400'),
    );
    expect(retencionEsperada(c('10000'), 'ventas', true, PARAMETROS_2026).isrCent).toBe(c('250'));
  });
});

const mesTransporte15k: PeriodoEntrada = {
  anio: 2026,
  mes: 10,
  ingresos: [
    {
      app: 'uber',
      giro: 'transporte',
      subtotalCent: c('15000'),
      isrRetenidoCent: c('315'),
      ivaRetenidoCent: c('1200'),
      conRfc: true,
    },
  ],
  gastos: [{ concepto: 'Gasolina', subtotalCent: c('3000'), ivaCent: c('480') }],
};

describe('pago definitivo', () => {
  it('inscrito con pago definitivo: lo retenido es el pago, sin pago adicional', () => {
    const r = calcularPagoDefinitivo(mesTransporte15k, PARAMETROS_2026);
    expect(r.metodo).toBe('definitivo');
    expect(r.isr.retenidoDelMesCent).toBe(c('315'));
    expect(r.iva.retenidoCent).toBe(c('1200'));
    expect(r.totalCent).toBe(0);
    expect(r.cargaTotalCent).toBe(c('1515'));
  });
});

describe('recomendación', () => {
  it('recomienda pago definitivo cuando es más barato y no pasa del tope', () => {
    const rec = recomendar([mesTransporte15k], PARAMETROS_2026, {
      ingresosAnioAnteriorCent: c('180000'),
    });
    expect(rec.elegibleDefinitivo).toBe(true);
    expect(rec.recomendado).toBe('definitivo');
    expect(rec.definitivo?.cargaTotalCent).toBe(c('1515'));
    expect(rec.explicacion).toMatch(/pago definitivo/i);
  });

  it('sin opción de pago definitivo si el año anterior pasó de $300,000', () => {
    const rec = recomendar([mesTransporte15k], PARAMETROS_2026, {
      ingresosAnioAnteriorCent: c('420000'),
    });
    expect(rec.elegibleDefinitivo).toBe(false);
    expect(rec.definitivo).toBeNull();
    expect(rec.recomendado).toBe('acumulado');
  });

  it('IVA negativo queda como saldo a favor, nunca como pago negativo', () => {
    const conGastoGrande: PeriodoEntrada = {
      ...mesTransporte15k,
      gastos: [{ concepto: 'Llantas', subtotalCent: c('20000'), ivaCent: c('3200') }],
    };
    const r = calcularAcumulado([conGastoGrande], PARAMETROS_2026);
    expect(r.iva.aPagarCent).toBe(0);
    expect(r.iva.saldoAFavorCent).toBe(c('2000')); // 2,400 - 3,200 - 1,200
    expect(r.isr.aPagarCent).toBe(0);
    expect(r.totalCent).toBe(0);
  });
});
