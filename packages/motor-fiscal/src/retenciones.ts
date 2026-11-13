import { aplicarTasa, type Centavos } from './dinero.js';
import type { Giro, ParametrosFiscales } from './tipos.js';

export function tasaIsrEsperada(giro: Giro, conRfc: boolean, p: ParametrosFiscales): number {
  return conRfc ? p.retencionIsrConRfc[giro].valor : p.retencionIsrSinRfc.valor;
}

export function tasaIvaEsperada(conRfc: boolean, p: ParametrosFiscales): number {
  return conRfc ? p.retencionIvaConRfc.valor : p.retencionIvaSinRfc.valor;
}

/** Lo que una plataforma debe retener sobre un ingreso antes de IVA. */
export function retencionEsperada(
  subtotalCent: Centavos,
  giro: Giro,
  conRfc: boolean,
  p: ParametrosFiscales,
): { isrCent: Centavos; ivaCent: Centavos; tasaIsrBp: number; tasaIvaBp: number } {
  const tasaIsrBp = tasaIsrEsperada(giro, conRfc, p);
  const tasaIvaBp = tasaIvaEsperada(conRfc, p);
  return {
    isrCent: aplicarTasa(subtotalCent, tasaIsrBp),
    ivaCent: aplicarTasa(subtotalCent, tasaIvaBp),
    tasaIsrBp,
    tasaIvaBp,
  };
}
