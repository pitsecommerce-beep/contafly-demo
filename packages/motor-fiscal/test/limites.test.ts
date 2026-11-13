import { describe, expect, it } from 'vitest';
import { calcularAcumulado } from '../src/calculo.js';
import { fechaLarga, fechaVencimiento, nombreMes } from '../src/calendario.js';
import { evaluarCompuertas } from '../src/compuertas.js';
import {
  aPesos,
  aplicarTasa,
  centavos as c,
  formatoMxn,
  multiplicar,
  sumar,
} from '../src/dinero.js';
import { PARAMETROS_2026, parametrosDe } from '../src/parametros/index.js';
import { recomendar } from '../src/recomendar.js';
import type { PeriodoEntrada } from '../src/tipos.js';

const vacio = (mes: number): PeriodoEntrada => ({ anio: 2026, mes, ingresos: [], gastos: [] });

describe('dinero, casos límite', () => {
  it('textos inválidos y negativos', () => {
    expect(() => c('abc')).toThrow();
    expect(() => c('9'.repeat(20))).toThrow();
    expect(c('-12.5')).toBe(-1250);
    expect(c('1,234.5')).toBe(123_450);
  });
  it('tasas sobre negativos redondean simétrico', () => {
    expect(aplicarTasa(-5, 1000)).toBe(-1);
    expect(aPesos(-105)).toBe('-1.05');
  });
  it('multiplicar y sumar validan enteros', () => {
    expect(multiplicar(100, 3)).toBe(300);
    expect(() => multiplicar(1, 0.5)).toThrow();
    expect(() => sumar(1, 0.5)).toThrow();
    expect(() => sumar(Number.MAX_SAFE_INTEGER, 1)).toThrow();
    expect(sumar()).toBe(0);
    expect(formatoMxn(123_456_789)).toBe('$1,234,567.89');
  });
});

describe('parámetros', () => {
  it('por año', () => {
    expect(parametrosDe(2026)).toBe(PARAMETROS_2026);
    expect(() => parametrosDe(2019)).toThrow();
  });
  it('pendientes sin inventar', () => {
    expect(PARAMETROS_2026.tasaRecargosMensual.valor).toBeNull();
    expect(PARAMETROS_2026.factorActualizacion.valor).toBeNull();
    expect(PARAMETROS_2026.multaDeclaracionOmitida.valor).toBeNull();
  });
});

describe('cálculo, validaciones', () => {
  it('necesita periodos del mismo año y en orden', () => {
    expect(() => calcularAcumulado([], PARAMETROS_2026)).toThrow();
    expect(() => calcularAcumulado([vacio(3), vacio(2)], PARAMETROS_2026)).toThrow();
    expect(() =>
      calcularAcumulado([vacio(1), { ...vacio(2), anio: 2025 }], PARAMETROS_2026),
    ).toThrow();
  });
  it('suma varias facturas de la misma app', () => {
    const p: PeriodoEntrada = {
      anio: 2026,
      mes: 1,
      ingresos: [
        {
          app: 'uber',
          giro: 'transporte',
          subtotalCent: c('100'),
          isrRetenidoCent: 210,
          ivaRetenidoCent: 800,
          conRfc: true,
        },
        {
          app: 'uber',
          giro: 'transporte',
          subtotalCent: c('200'),
          isrRetenidoCent: 420,
          ivaRetenidoCent: 1600,
          conRfc: true,
        },
      ],
      gastos: [],
    };
    expect(calcularAcumulado([p], PARAMETROS_2026).ingresosPorApp.uber).toBe(c('300'));
  });
  it('un mes sin ingresos no causa ISR', () => {
    const r = calcularAcumulado([vacio(1)], PARAMETROS_2026);
    expect(r.totalCent).toBe(0);
    expect(r.isr.causadoDelMesCent).toBe(0);
  });
});

describe('recomendación con gastos grandes', () => {
  it('recomienda declarar y deducir si el IVA a favor lo hace más barato', () => {
    const p: PeriodoEntrada = {
      anio: 2026,
      mes: 1,
      ingresos: [
        {
          app: 'uber',
          giro: 'transporte',
          subtotalCent: c('10000'),
          isrRetenidoCent: c('210'),
          ivaRetenidoCent: c('800'),
          conRfc: true,
        },
      ],
      gastos: [{ concepto: 'Auto', subtotalCent: c('50000'), ivaCent: c('8000') }],
    };
    const rec = recomendar([p], PARAMETROS_2026, { ingresosAnioAnteriorCent: 0 });
    expect(rec.recomendado).toBe('acumulado');
    expect(rec.explicacion).toMatch(/declarar y deducir/);
  });
  it('sin periodos falla', () => {
    expect(() => recomendar([], PARAMETROS_2026, { ingresosAnioAnteriorCent: 0 })).toThrow();
  });
});

describe('calendario, días inhábiles', () => {
  it('nombres y fechas', () => {
    expect(nombreMes(1)).toBe('enero');
    expect(() => nombreMes(13)).toThrow();
    expect(() => fechaLarga('2026-02-30')).toThrow();
    expect(() => fechaLarga('17/11/2026')).toThrow();
  });
  it('recorre feriados de la LFT', () => {
    // Tercer lunes de noviembre 2025 = 17 de noviembre
    expect(fechaVencimiento(2025, 10)).toBe('2025-11-18');
    // Tercer lunes de marzo 2025 = 17 de marzo
    expect(fechaVencimiento(2025, 2)).toBe('2025-03-18');
    // 17 de febrero no suele ser el primer lunes; probamos con el día del mes
    expect(fechaVencimiento(2026, 1, 2)).toBe('2026-02-03'); // 2 feb 2026 es el primer lunes
    expect(fechaVencimiento(2026, 12, 1)).toBe('2027-01-04'); // 1 ene feriado, luego fin de semana
    expect(fechaVencimiento(2026, 4, 1)).toBe('2026-05-04'); // 1 may viernes feriado
    expect(fechaVencimiento(2026, 8, 16)).toBe('2026-09-17'); // 16 sep feriado
    expect(fechaVencimiento(2026, 11, 25)).toBe('2026-12-28'); // 25 dic viernes feriado
    expect(fechaVencimiento(2030, 9, 1)).toBe('2030-10-02'); // 1 oct, cambio de poder ejecutivo
    expect(fechaVencimiento(2031, 9, 1)).toBe('2031-10-01');
  });
});

describe('compuertas, IVA', () => {
  it('ámbar si la tasa de IVA leída no coincide', () => {
    const p: PeriodoEntrada = {
      anio: 2026,
      mes: 10,
      ingresos: [
        {
          app: 'airbnb',
          giro: 'hospedaje',
          subtotalCent: c('1000'),
          isrRetenidoCent: c('40'),
          ivaRetenidoCent: c('160'),
          conRfc: true,
          tasaIvaLeidaBp: 1600,
        },
      ],
      gastos: [],
    };
    const g = evaluarCompuertas(p, PARAMETROS_2026, { hoy: '2026-11-13' });
    expect(g.estado).toBe('ambar');
    expect(g.motivos[0]).toMatch(/Airbnb te retuvo 16% de IVA/);
  });
  it('una app desconocida usa su clave', () => {
    const p = {
      anio: 2026,
      mes: 10,
      ingresos: [
        {
          app: 'otra',
          giro: 'ventas',
          subtotalCent: 100,
          isrRetenidoCent: 0,
          ivaRetenidoCent: 0,
          conRfc: true,
          tasaIsrLeidaBp: 1,
        },
      ],
      gastos: [],
    } as unknown as PeriodoEntrada;
    expect(evaluarCompuertas(p, PARAMETROS_2026, { hoy: '2026-11-13' }).motivos[0]).toMatch(
      /^otra/,
    );
  });
});
