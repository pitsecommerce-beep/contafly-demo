import { diasEntre, fechaLarga, fechaVencimiento } from './calendario.js';
import { tasaIsrEsperada, tasaIvaEsperada } from './retenciones.js';
import type { ParametrosFiscales, PeriodoEntrada } from './tipos.js';

export type EstadoCompuerta = 'verde' | 'ambar' | 'rojo';

export interface ResultadoCompuertas {
  estado: EstadoCompuerta;
  puedePresentar: boolean;
  motivos: string[];
  venceEl: string;
}

const NOMBRE_APP: Record<string, string> = {
  uber: 'Uber',
  didi: 'DiDi',
  rappi: 'Rappi',
  mercado_libre: 'Mercado Libre',
  amazon: 'Amazon',
  airbnb: 'Airbnb',
};

const pct = (bp: number) => `${(bp / 100).toString()}%`;

/**
 * Ámbar: una tasa leída de un CFDI no coincide con el parámetro vigente.
 * Rojo: cambió el régimen o el periodo es extemporáneo.
 * Con ámbar o rojo no se puede presentar: lo revisa un contador.
 */
export function evaluarCompuertas(
  periodo: PeriodoEntrada,
  params: ParametrosFiscales,
  ctx: { hoy: string; cambioRegimen?: boolean },
): ResultadoCompuertas {
  const motivos: string[] = [];
  let estado: EstadoCompuerta = 'verde';
  const venceEl = fechaVencimiento(periodo.anio, periodo.mes, params.diaVencimiento.valor);

  if (ctx.cambioRegimen) {
    estado = 'rojo';
    motivos.push('Cambió tu régimen en este periodo. Lo revisa un contador.');
  }
  if (diasEntre(ctx.hoy, venceEl) < 0) {
    estado = 'rojo';
    motivos.push(`Esta declaración venció el ${fechaLarga(venceEl)}. Lo revisa un contador.`);
  }
  for (const i of periodo.ingresos) {
    const app = NOMBRE_APP[i.app] ?? i.app;
    const isr = tasaIsrEsperada(i.giro, i.conRfc, params);
    if (i.tasaIsrLeidaBp !== undefined && i.tasaIsrLeidaBp !== isr) {
      if (estado === 'verde') estado = 'ambar';
      motivos.push(
        `${app} te retuvo ${pct(i.tasaIsrLeidaBp)} de ISR y la tasa vigente es ${pct(isr)}. Lo revisa un contador.`,
      );
    }
    const iva = tasaIvaEsperada(i.conRfc, params);
    if (i.tasaIvaLeidaBp !== undefined && i.tasaIvaLeidaBp !== iva) {
      if (estado === 'verde') estado = 'ambar';
      motivos.push(
        `${app} te retuvo ${pct(i.tasaIvaLeidaBp)} de IVA y la tasa vigente es ${pct(iva)}. Lo revisa un contador.`,
      );
    }
  }
  return { estado, puedePresentar: estado === 'verde', motivos, venceEl };
}
