import type { ParametrosFiscales } from '../tipos.js';
import { PARAMETROS_2026 } from './2026.js';

const PARAMETROS: Record<number, ParametrosFiscales> = { 2026: PARAMETROS_2026 };

export function parametrosDe(anio: number): ParametrosFiscales {
  const p = PARAMETROS[anio];
  if (!p) throw new RangeError(`No hay parámetros fiscales para ${anio}`);
  return p;
}

export { PARAMETROS_2026 };
