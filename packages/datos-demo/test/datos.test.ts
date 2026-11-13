import { centavos as c } from '@contafly/motor-fiscal';
import { describe, expect, it } from 'vitest';
import {
  comparadorDelMes,
  generarSemillas,
  DEMO_FECHA_POR_DEFECTO as HOY,
  hallazgos,
  LUIS,
  MARIANA,
  pendientes,
  resumenMeses,
} from '../src/index.js';

describe('Luis', () => {
  const meses = resumenMeses(LUIS, HOY);
  const oct = meses.find((m) => m.mes === 10);

  it('octubre está listo y suma $2,538.45', () => {
    expect(oct?.estado).toBe('listo');
    expect(oct?.resultado.totalCent).toBe(c('2538.45'));
    expect(oct?.venceEl).toBe('2026-11-17');
  });
  it('enero a septiembre presentados', () => {
    expect(meses.filter((m) => m.presentado)).toHaveLength(9);
    expect(pendientes(LUIS, HOY).map((m) => m.mes)).toEqual([10]);
  });
  it('no puede usar pago definitivo', () => {
    expect(oct?.recomendacion.elegibleDefinitivo).toBe(false);
  });
  it('comparador', () => {
    expect(comparadorDelMes(LUIS, 10, HOY)).toEqual({
      sinRfcCent: c('11520'),
      inscritoCent: c('5770.45'),
      ahorroCent: c('5749.55'),
    });
    expect(() => comparadorDelMes(LUIS, 11, HOY)).toThrow();
  });
  it('sin hallazgos de buzón', () => {
    expect(hallazgos(LUIS, HOY).map((h) => h.clave)).toEqual(['regimen', 'declaraciones']);
  });
});

describe('Mariana', () => {
  const pend = pendientes(MARIANA, HOY);

  it('agosto, septiembre y octubre pendientes', () => {
    expect(pend.map((m) => m.mes)).toEqual([8, 9, 10]);
  });
  it('agosto y septiembre vencidos (rojo); octubre en ámbar por la tasa de Amazon', () => {
    expect(pend.map((m) => m.estado)).toEqual(['rojo', 'rojo', 'ambar']);
    expect(pend[2]?.compuertas.motivos[0]).toMatch(/Amazon te retuvo 1% de ISR/);
  });
  it('cada mes tiene algo a pagar', () => {
    for (const m of pend) expect(m.resultado.totalCent).toBeGreaterThan(0);
  });
  it('hallazgos: régimen, declaraciones y buzón', () => {
    const h = hallazgos(MARIANA, HOY);
    expect(h.map((x) => x.clave)).toEqual(['regimen', 'declaraciones', 'buzon']);
    expect(h[0]?.titulo).toBe('Régimen de plataformas activo desde julio de 2026');
    expect(h[1]?.titulo).toBe('Declaraciones de agosto, septiembre y octubre sin presentar');
    expect(h[1]?.consecuencia).toBe('Los recargos y la actualización se calculan al presentar.');
    expect(h[2]?.consecuencia).toMatch(/3,850 a \$11,540/);
  });
});

describe('semillas', () => {
  it('genera SQL con ambas personas', () => {
    const sql = generarSemillas(HOY);
    expect(sql).toContain("'luis'");
    expect(sql).toContain("'mariana'");
    expect(sql).toContain("'ambar'");
  });
});
