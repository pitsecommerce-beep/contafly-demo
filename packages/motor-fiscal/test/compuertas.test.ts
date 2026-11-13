import { describe, expect, it } from 'vitest';
import { evaluarCompuertas } from '../src/compuertas.js';
import { centavos as c } from '../src/dinero.js';
import { PARAMETROS_2026 } from '../src/parametros/2026.js';
import type { Ingreso, PeriodoEntrada } from '../src/tipos.js';

const ingresoBase: Ingreso = {
  app: 'mercado_libre',
  giro: 'ventas',
  subtotalCent: c('20000'),
  isrRetenidoCent: c('500'),
  ivaRetenidoCent: c('1600'),
  conRfc: true,
  tasaIsrLeidaBp: 250,
  tasaIvaLeidaBp: 800,
};

const base: PeriodoEntrada = {
  anio: 2026,
  mes: 10,
  ingresos: [
    {
      app: 'mercado_libre',
      giro: 'ventas',
      subtotalCent: c('20000'),
      isrRetenidoCent: c('500'),
      ivaRetenidoCent: c('1600'),
      conRfc: true,
      tasaIsrLeidaBp: 250,
      tasaIvaLeidaBp: 800,
    },
  ],
  gastos: [],
};

describe('compuertas', () => {
  it('verde cuando todo coincide y está en tiempo', () => {
    const g = evaluarCompuertas(base, PARAMETROS_2026, { hoy: '2026-11-13' });
    expect(g.estado).toBe('verde');
    expect(g.puedePresentar).toBe(true);
  });

  it('ámbar si la tasa leída del CFDI no coincide con el parámetro', () => {
    const p: PeriodoEntrada = {
      ...base,
      ingresos: [{ ...ingresoBase, app: 'amazon', tasaIsrLeidaBp: 100 }],
    };
    const g = evaluarCompuertas(p, PARAMETROS_2026, { hoy: '2026-11-13' });
    expect(g.estado).toBe('ambar');
    expect(g.puedePresentar).toBe(false);
    expect(g.motivos[0]).toMatch(/amazon/i);
  });

  it('rojo si es extemporáneo', () => {
    const g = evaluarCompuertas({ ...base, mes: 8 }, PARAMETROS_2026, { hoy: '2026-11-13' });
    expect(g.estado).toBe('rojo');
    expect(g.puedePresentar).toBe(false);
    expect(g.motivos.join(' ')).toMatch(/venció/);
  });

  it('rojo si cambió el régimen, aunque también haya ámbar', () => {
    const p: PeriodoEntrada = {
      ...base,
      ingresos: [{ ...ingresoBase, tasaIsrLeidaBp: 100 }],
    };
    const g = evaluarCompuertas(p, PARAMETROS_2026, { hoy: '2026-11-13', cambioRegimen: true });
    expect(g.estado).toBe('rojo');
    expect(g.motivos).toHaveLength(2);
  });
});
