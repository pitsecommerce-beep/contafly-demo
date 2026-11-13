/** Convierte montos a palabras para que la voz los diga bien: "$2,538.45" -> "dos mil quinientos treinta y ocho pesos con cuarenta y cinco centavos". */

/** "veintiuno" -> "veintiún", "uno" -> "un" antes de sustantivo */
const apocopar = (t: string) => t.replace(/veintiuno$/, 'veintiún').replace(/uno$/, 'un');

const UNIDADES = [
  '',
  'uno',
  'dos',
  'tres',
  'cuatro',
  'cinco',
  'seis',
  'siete',
  'ocho',
  'nueve',
  'diez',
  'once',
  'doce',
  'trece',
  'catorce',
  'quince',
  'dieciséis',
  'diecisiete',
  'dieciocho',
  'diecinueve',
  'veinte',
  'veintiuno',
  'veintidós',
  'veintitrés',
  'veinticuatro',
  'veinticinco',
  'veintiséis',
  'veintisiete',
  'veintiocho',
  'veintinueve',
];
const DECENAS = [
  '',
  '',
  '',
  'treinta',
  'cuarenta',
  'cincuenta',
  'sesenta',
  'setenta',
  'ochenta',
  'noventa',
];
const CENTENAS = [
  '',
  'ciento',
  'doscientos',
  'trescientos',
  'cuatrocientos',
  'quinientos',
  'seiscientos',
  'setecientos',
  'ochocientos',
  'novecientos',
];

function menorQueMil(n: number): string {
  if (n === 0) return '';
  if (n === 100) return 'cien';
  const c = Math.floor(n / 100);
  const r = n % 100;
  const partes: string[] = [];
  if (c) partes.push(CENTENAS[c] ?? '');
  if (r < 30) {
    if (r) partes.push(UNIDADES[r] ?? '');
  } else {
    const d = Math.floor(r / 10);
    const u = r % 10;
    partes.push(u ? `${DECENAS[d]} y ${UNIDADES[u]}` : (DECENAS[d] ?? ''));
  }
  return partes.join(' ');
}

export function numeroEnPalabras(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new RangeError(`Número inválido: ${n}`);
  if (n === 0) return 'cero';
  const millones = Math.floor(n / 1_000_000);
  const miles = Math.floor((n % 1_000_000) / 1000);
  const resto = n % 1000;
  const partes: string[] = [];
  if (millones)
    partes.push(millones === 1 ? 'un millón' : `${apocopar(numeroEnPalabras(millones))} millones`);
  if (miles) partes.push(miles === 1 ? 'mil' : `${apocopar(menorQueMil(miles))} mil`);
  if (resto) partes.push(menorQueMil(resto));
  return partes.join(' ');
}

export function montoEnPalabras(cent: number): string {
  const pesos = Math.floor(cent / 100);
  const c = cent % 100;
  const p = `${apocopar(numeroEnPalabras(pesos))} ${pesos === 1 ? 'peso' : 'pesos'}`;
  return c ? `${p} con ${apocopar(numeroEnPalabras(c))} ${c === 1 ? 'centavo' : 'centavos'}` : p;
}

/** Reemplaza montos y porcentajes del texto por su forma hablada. */
export function textoParaVoz(texto: string): string {
  return texto
    .replace(/-?\$([\d,]+)(?:\.(\d{2}))?/g, (_, ent: string, dec?: string) =>
      montoEnPalabras(Number(ent.replaceAll(',', '')) * 100 + Number(dec ?? 0)),
    )
    .replace(
      /(\d+)\.(\d+)%/g,
      (_, a: string, b: string) =>
        `${numeroEnPalabras(Number(a))} punto ${numeroEnPalabras(Number(b))} por ciento`,
    )
    .replace(/(\d+)%/g, (_, a: string) => `${numeroEnPalabras(Number(a))} por ciento`)
    .replace(/\.?\n+/g, '. ');
}
