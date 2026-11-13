import { calcularAcumulado, calcularPagoDefinitivo } from './calculo.js';
import { type Centavos, formatoMxn } from './dinero.js';
import type { Metodo, ParametrosFiscales, PeriodoEntrada, ResultadoMes } from './tipos.js';

export interface Recomendacion {
  elegibleDefinitivo: boolean;
  acumulado: ResultadoMes;
  definitivo: ResultadoMes | null;
  recomendado: Metodo;
  explicacion: string;
}

/** Calcula ambos caminos cuando aplica y recomienda el más barato para el último mes. */
export function recomendar(
  periodos: PeriodoEntrada[],
  params: ParametrosFiscales,
  ctx: { ingresosAnioAnteriorCent: Centavos },
): Recomendacion {
  const ultimo = periodos.at(-1);
  if (!ultimo) throw new RangeError('Se necesita al menos un periodo');
  const acumulado = calcularAcumulado(periodos, params);
  const tope = params.topePagoDefinitivo.valor;
  const elegibleDefinitivo = ctx.ingresosAnioAnteriorCent <= tope;

  if (!elegibleDefinitivo) {
    return {
      elegibleDefinitivo,
      acumulado,
      definitivo: null,
      recomendado: 'acumulado',
      explicacion: `El año pasado tus ingresos pasaron de ${formatoMxn(tope)}, así que no puedes usar el pago definitivo. Declaras tus ingresos, restas tus gastos con factura y lo que te retuvieron las apps.`,
    };
  }
  const definitivo = calcularPagoDefinitivo(ultimo, params);
  const recomendado: Metodo =
    definitivo.cargaTotalCent <= acumulado.cargaTotalCent ? 'definitivo' : 'acumulado';
  const diferencia = Math.abs(acumulado.cargaTotalCent - definitivo.cargaTotalCent);
  const explicacion =
    recomendado === 'definitivo'
      ? `Te conviene el pago definitivo: lo que te retienen las apps es tu impuesto y no pagas nada más. Te ahorra ${formatoMxn(diferencia)} este mes frente a declarar y deducir.`
      : `Te conviene declarar y deducir: tus gastos con factura bajan tu impuesto y pagas ${formatoMxn(diferencia)} menos que con el pago definitivo.`;
  return { elegibleDefinitivo, acumulado, definitivo, recomendado, explicacion };
}
