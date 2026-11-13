import { describe, expect, it } from 'vitest';
import { montoEnPalabras, numeroEnPalabras, textoParaVoz } from '../src/index.js';

describe('voz', () => {
  it('números', () => {
    expect(numeroEnPalabras(0)).toBe('cero');
    expect(numeroEnPalabras(21)).toBe('veintiuno');
    expect(numeroEnPalabras(100)).toBe('cien');
    expect(numeroEnPalabras(101)).toBe('ciento uno');
    expect(numeroEnPalabras(2538)).toBe('dos mil quinientos treinta y ocho');
    expect(numeroEnPalabras(21_000)).toBe('veintiún mil');
    expect(numeroEnPalabras(1_000_000)).toBe('un millón');
    expect(numeroEnPalabras(3_001_001)).toBe('tres millones mil uno');
    expect(() => numeroEnPalabras(-1)).toThrow();
  });
  it('montos', () => {
    expect(montoEnPalabras(253_845)).toBe(
      'dos mil quinientos treinta y ocho pesos con cuarenta y cinco centavos',
    );
    expect(montoEnPalabras(72_000)).toBe('setecientos veinte pesos');
    expect(montoEnPalabras(101)).toBe('un peso con un centavo');
  });
  it('texto', () => {
    expect(textoParaVoz('Son $2,538.45 y te retienen 2.1% y 8%.\nVence el 17.')).toBe(
      'Son dos mil quinientos treinta y ocho pesos con cuarenta y cinco centavos y te retienen dos punto uno por ciento y ocho por ciento. Vence el 17.',
    );
  });
});
