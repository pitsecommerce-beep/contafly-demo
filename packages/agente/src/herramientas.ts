import type Anthropic from '@anthropic-ai/sdk';
import { comparadorDelMes, PERSONAS, resumenMeses, type SlugPersona } from '@contafly/datos-demo';
import { formatoMxn, nombreMes, PARAMETROS_2026, textoVencimiento } from '@contafly/motor-fiscal';

/** Acciones con efectos que provee el canal (WhatsApp o voz). */
export interface AccionesCanal {
  enviarLineaCaptura(mes: number): Promise<{ enviado: boolean; detalle: string }>;
  agendarLlamada(): Promise<{ programada: boolean; detalle: string }>;
}

export interface ContextoAgente {
  persona: SlugPersona;
  /** Fecha de la demo, AAAA-MM-DD */
  hoy: string;
  acciones: AccionesCanal;
}

const NOMBRE_APP: Record<string, string> = {
  uber: 'Uber',
  didi: 'DiDi',
  rappi: 'Rappi',
  mercado_libre: 'Mercado Libre',
  amazon: 'Amazon',
  airbnb: 'Airbnb',
};

const pct = (bp: number) => `${bp / 100}%`;

export const HERRAMIENTAS: Anthropic.Tool[] = [
  {
    name: 'consultar_mes',
    description:
      'Devuelve el cálculo del motor fiscal para un mes: ingresos por app, gastos con factura, retenciones, ISR, IVA, total a pagar, fecha de vencimiento y si ya se presentó. Sin mes, usa el mes pendiente más reciente.',
    input_schema: {
      type: 'object',
      properties: {
        mes: { type: 'integer', minimum: 1, maximum: 12, description: 'Mes de 2026, de 1 a 12' },
      },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'explicar_retenciones',
    description:
      'Explica por qué las apps retienen ISR e IVA, con las tasas vigentes y sus fuentes, cuánto le retuvieron en el mes y cuánto le habrían retenido sin RFC.',
    input_schema: {
      type: 'object',
      properties: { mes: { type: 'integer', minimum: 1, maximum: 12 } },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'estado_buzon',
    description: 'Indica si el buzón tributario está habilitado y si hay avisos nuevos.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
  {
    name: 'enviar_linea_captura',
    description:
      'Envía por WhatsApp el PDF de demostración con la línea de captura del mes. Sin mes, usa el mes pendiente más reciente.',
    input_schema: {
      type: 'object',
      properties: { mes: { type: 'integer', minimum: 1, maximum: 12 } },
      additionalProperties: false,
    },
    strict: true,
  },
  {
    name: 'agendar_llamada',
    description: 'Pide que el contador virtual le llame por teléfono en este momento.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false },
    strict: true,
  },
];

function mesObjetivo(ctx: ContextoAgente, mes: unknown): number {
  if (typeof mes === 'number' && Number.isInteger(mes)) return mes;
  const meses = resumenMeses(PERSONAS[ctx.persona], ctx.hoy);
  const pendiente = meses.filter((m) => !m.presentado).at(-1) ?? meses.at(-1);
  if (!pendiente) throw new Error('La persona no tiene meses con actividad');
  return pendiente.mes;
}

function leerMes(input: unknown): unknown {
  return typeof input === 'object' && input !== null ? (input as { mes?: unknown }).mes : undefined;
}

export function consultarMes(ctx: ContextoAgente, mesEntrada?: unknown) {
  const persona = PERSONAS[ctx.persona];
  const mes = mesObjetivo(ctx, mesEntrada);
  const m = resumenMeses(persona, ctx.hoy).find((x) => x.mes === mes);
  if (!m) return { error: `No hay actividad registrada en ${nombreMes(mes)} de 2026.` };
  const r = m.resultado;
  return {
    persona: persona.nombre,
    periodo: `${nombreMes(mes)} 2026`,
    estado: m.presentado
      ? 'presentada'
      : m.compuertas.puedePresentar
        ? 'lista para presentar'
        : 'la revisa un contador antes de presentar',
    motivos_revision: m.compuertas.motivos,
    vencimiento: textoVencimiento(ctx.hoy, m.venceEl),
    ingresos_por_app: Object.fromEntries(
      Object.entries(r.ingresosPorApp).map(([k, v]) => [NOMBRE_APP[k] ?? k, formatoMxn(v ?? 0)]),
    ),
    ingresos_total: formatoMxn(r.ingresosCent),
    gastos_con_factura: formatoMxn(r.gastosCent),
    isr_del_mes: formatoMxn(r.isr.causadoDelMesCent),
    isr_retenido_por_apps: formatoMxn(r.isr.retenidoDelMesCent),
    isr_a_pagar: formatoMxn(r.isr.aPagarCent),
    iva_cobrado: formatoMxn(r.iva.trasladadoCent),
    iva_de_gastos: formatoMxn(r.iva.acreditableCent),
    iva_retenido_por_apps: formatoMxn(r.iva.retenidoCent),
    iva_a_pagar: formatoMxn(r.iva.aPagarCent),
    total_a_pagar: formatoMxn(r.totalCent),
    recargos: m.compuertas.estado === 'rojo' ? 'se calculan al presentar' : 'no aplican',
    version_motor: `${r.versionMotor} / ${r.versionParametros}`,
  };
}

export function explicarRetenciones(ctx: ContextoAgente, mesEntrada?: unknown) {
  const persona = PERSONAS[ctx.persona];
  const mes = mesObjetivo(ctx, mesEntrada);
  const periodo = persona.periodos.find((p) => p.mes === mes);
  const p = PARAMETROS_2026;
  const base = {
    por_que:
      'Las plataformas retienen ISR e IVA cada mes y se los entregan al SAT a tu nombre. Lo retenido se resta de lo que pagas al declarar.',
    tasas_con_rfc: {
      isr_transporte_y_reparto: `${pct(p.retencionIsrConRfc.transporte.valor)} (${p.retencionIsrConRfc.transporte.fuente})`,
      isr_hospedaje: `${pct(p.retencionIsrConRfc.hospedaje.valor)} (${p.retencionIsrConRfc.hospedaje.fuente})`,
      isr_ventas_y_servicios: `${pct(p.retencionIsrConRfc.ventas.valor)} (${p.retencionIsrConRfc.ventas.fuente})`,
      iva: `${pct(p.retencionIvaConRfc.valor)} sobre tus ingresos, la mitad del IVA (${p.retencionIvaConRfc.fuente})`,
    },
    tasas_sin_rfc: {
      isr: `${pct(p.retencionIsrSinRfc.valor)} (${p.retencionIsrSinRfc.fuente})`,
      iva: `${pct(p.retencionIvaSinRfc.valor)}, todo el IVA (${p.retencionIvaSinRfc.fuente})`,
    },
  };
  if (!periodo || periodo.ingresos.length === 0) return base;
  const comp = comparadorDelMes(persona, mes, ctx.hoy);
  return {
    ...base,
    periodo: `${nombreMes(mes)} 2026`,
    retenciones_del_mes: periodo.ingresos.map((i) => ({
      app: NOMBRE_APP[i.app] ?? i.app,
      ingreso: formatoMxn(i.subtotalCent),
      isr_retenido: formatoMxn(i.isrRetenidoCent),
      tasa_isr: i.tasaIsrLeidaBp === undefined ? null : pct(i.tasaIsrLeidaBp),
      iva_retenido: formatoMxn(i.ivaRetenidoCent),
    })),
    sin_rfc_te_habrian_retenido: formatoMxn(comp.sinRfcCent),
    inscrito_entre_retenciones_y_pago: formatoMxn(comp.inscritoCent),
  };
}

export function estadoBuzon(ctx: ContextoAgente) {
  const persona = PERSONAS[ctx.persona];
  const multa = PARAMETROS_2026.multaBuzon.valor;
  return persona.buzonHabilitado
    ? { habilitado: true, avisos: 'Sin avisos nuevos', revisado: ctx.hoy }
    : {
        habilitado: false,
        avisos: 'No se pueden revisar porque el buzón no está habilitado',
        consecuencia: `Desde el 1 de enero de 2027 la multa va de ${formatoMxn(multa.minimaCent)} a ${formatoMxn(multa.maximaCent)} (${PARAMETROS_2026.multaBuzon.fuente}).`,
      };
}

/** Ejecuta una herramienta y devuelve el texto del tool_result. Nunca lanza: los errores vuelven como texto. */
export async function ejecutarHerramienta(
  nombre: string,
  input: unknown,
  ctx: ContextoAgente,
): Promise<{ texto: string; error: boolean }> {
  try {
    let salida: unknown;
    switch (nombre) {
      case 'consultar_mes':
        salida = consultarMes(ctx, leerMes(input));
        break;
      case 'explicar_retenciones':
        salida = explicarRetenciones(ctx, leerMes(input));
        break;
      case 'estado_buzon':
        salida = estadoBuzon(ctx);
        break;
      case 'enviar_linea_captura': {
        const mes = mesObjetivo(ctx, leerMes(input));
        const total = consultarMes(ctx, mes);
        const r = await ctx.acciones.enviarLineaCaptura(mes);
        salida = { ...r, total: 'total_a_pagar' in total ? total.total_a_pagar : null };
        break;
      }
      case 'agendar_llamada':
        salida = await ctx.acciones.agendarLlamada();
        break;
      default:
        return { texto: `Herramienta desconocida: ${nombre}`, error: true };
    }
    return { texto: JSON.stringify(salida), error: false };
  } catch (e) {
    return { texto: `No se pudo completar: ${(e as Error).message}`, error: true };
  }
}
