import { describe, expect, it } from 'vitest';
import { aPesos, aplicarTasa, centavos, formatoMxn } from '../src/dinero.js';

describe('redondeo a centavos', () => {
  it('convierte pesos a centavos enteros sin errores de flotante', () => {
    expect(centavos('19000')).toBe(1_900_000);
    expect(centavos('0.01')).toBe(1);
    expect(centavos('17533.65')).toBe(1_753_365);
    expect(centavos('1.005')).toBe(101); // medio centavo hacia arriba
  });

  it('aplica tasas en puntos base con redondeo half-up', () => {
    expect(aplicarTasa(1_900_000, 210)).toBe(39_900); // 2.1% de 19,000 = 399.00
    expect(aplicarTasa(296_635, 2136)).toBe(63_361); // 633.6123 -> 633.61
    expect(aplicarTasa(5, 1000)).toBe(1); // 0.005 -> 0.01
    expect(aplicarTasa(4, 1000)).toBe(0); // 0.004 -> 0.00
    expect(aplicarTasa(25, 2000)).toBe(5); // exacto
  });

  it('rechaza montos que no son enteros seguros', () => {
    expect(() => aplicarTasa(1.5, 100)).toThrow();
    expect(() => aplicarTasa(Number.MAX_SAFE_INTEGER, 10_000)).toThrow();
  });

  it('formatea en pesos mexicanos', () => {
    expect(formatoMxn(253_845)).toBe('$2,538.45');
    expect(aPesos(253_845)).toBe('2538.45');
    expect(formatoMxn(-72_000)).toBe('-$720.00');
  });
});
