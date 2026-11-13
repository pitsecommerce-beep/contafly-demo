/**
 * Dinero en centavos enteros. Nunca usamos flotantes para montos.
 * Las tasas van en puntos base: 1 bp = 0.01%, así 2.1% = 210 y 21.36% = 2136.
 */

export type Centavos = number;
export type PuntosBase = number;

function verificarEntero(n: number, nombre: string): void {
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`${nombre} debe ser un entero seguro, recibí ${n}`);
  }
}

/** Convierte un texto en pesos ("17533.65") a centavos, redondeando medio centavo hacia arriba. */
export function centavos(pesos: string): Centavos {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(pesos.trim().replaceAll(',', ''));
  if (!m) throw new RangeError(`Monto inválido: ${pesos}`);
  const [, signo, enteros = '0', decimales = ''] = m;
  const dec = `${decimales}000`.slice(0, 3);
  let cent = Number(enteros) * 100 + Number(dec.slice(0, 2));
  if (Number(dec[2]) >= 5) cent += 1;
  verificarEntero(cent, 'monto');
  return signo ? -cent : cent;
}

/**
 * Multiplica un monto por una tasa en puntos base con redondeo half-up a centavos.
 * Para montos negativos el redondeo es simétrico (half away from zero).
 */
export function aplicarTasa(montoCent: Centavos, tasaBp: PuntosBase): Centavos {
  verificarEntero(montoCent, 'montoCent');
  verificarEntero(tasaBp, 'tasaBp');
  const producto = Math.abs(montoCent) * tasaBp;
  verificarEntero(producto, 'producto');
  const r = Math.floor((producto + 5_000) / 10_000);
  return montoCent < 0 ? -r : r;
}

/** Multiplica un monto por un entero (para construir tarifas acumuladas). */
export function multiplicar(montoCent: Centavos, factor: number): Centavos {
  const r = montoCent * factor;
  verificarEntero(r, 'producto');
  return r;
}

export function sumar(...montos: Centavos[]): Centavos {
  let t = 0;
  for (const m of montos) {
    verificarEntero(m, 'monto');
    t += m;
  }
  verificarEntero(t, 'suma');
  return t;
}

/** "2538.45" */
export function aPesos(cent: Centavos): string {
  const signo = cent < 0 ? '-' : '';
  const a = Math.abs(cent);
  return `${signo}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`;
}

/** "$2,538.45" */
export function formatoMxn(cent: Centavos): string {
  const signo = cent < 0 ? '-' : '';
  const a = Math.abs(cent);
  const enteros = Math.floor(a / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${signo}$${enteros}.${String(a % 100).padStart(2, '0')}`;
}
