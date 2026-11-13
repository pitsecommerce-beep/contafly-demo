import { describe, expect, it } from 'vitest';
import { diasEntre, fechaVencimiento, textoVencimiento } from '../src/calendario.js';

describe('calendario', () => {
  it('octubre 2026 vence el martes 17 de noviembre', () => {
    expect(fechaVencimiento(2026, 10)).toBe('2026-11-17');
  });
  it('si el 17 cae en fin de semana se recorre al siguiente día hábil', () => {
    expect(fechaVencimiento(2026, 9)).toBe('2026-10-19'); // 17 oct 2026 es sábado
  });
  it('diciembre vence en enero del año siguiente', () => {
    expect(fechaVencimiento(2026, 12)).toBe('2027-01-18'); // 17 ene 2027 es domingo
  });
  it('días que faltan desde la fecha de la demo', () => {
    expect(diasEntre('2026-11-13', '2026-11-17')).toBe(4);
  });
  it('texto de vencimiento', () => {
    expect(textoVencimiento('2026-11-13', '2026-11-17')).toBe(
      'Vence el martes 17 de noviembre. Faltan 4 días.',
    );
    expect(textoVencimiento('2026-11-17', '2026-11-17')).toBe('Vence hoy, martes 17 de noviembre.');
    expect(textoVencimiento('2026-11-16', '2026-11-17')).toBe(
      'Vence el martes 17 de noviembre. Falta 1 día.',
    );
    expect(textoVencimiento('2026-11-20', '2026-11-17')).toBe('Venció el martes 17 de noviembre.');
  });
  it('rechaza fechas inválidas', () => {
    expect(() => diasEntre('2026-13-01', '2026-11-17')).toThrow();
  });
});
