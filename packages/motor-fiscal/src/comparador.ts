import { type Centavos, sumar } from './dinero.js';
import { retencionEsperada } from './retenciones.js';
import type { ParametrosFiscales, PeriodoEntrada, ResultadoMes } from './tipos.js';

/** Cuánto le habrían retenido sin RFC contra lo que aporta inscrito (retenciones y pago). */
export function compararSinRfc(
  periodo: PeriodoEntrada,
  resultado: ResultadoMes,
  params: ParametrosFiscales,
): { sinRfcCent: Centavos; inscritoCent: Centavos; ahorroCent: Centavos } {
  const sinRfcCent = sumar(
    ...periodo.ingresos.map((i) => {
      const r = retencionEsperada(i.subtotalCent, i.giro, false, params);
      return r.isrCent + r.ivaCent;
    }),
  );
  const inscritoCent = resultado.cargaTotalCent;
  return { sinRfcCent, inscritoCent, ahorroCent: sinRfcCent - inscritoCent };
}
