import { PERSONAS } from '@contafly/datos-demo';
import { nombreMes } from '@contafly/motor-fiscal';
import type { ResultadoConversacion } from './conversar.js';
import {
  type ContextoAgente,
  consultarMes,
  estadoBuzon,
  explicarRetenciones,
} from './herramientas.js';

/**
 * Respuestas sin modelo de lenguaje, para cuando no hay llave de Anthropic.
 * Detecta la intención con reglas simples y responde con las cifras de las herramientas.
 */
const INTENCIONES: Array<[RegExp, string]> = [
  [/m[aá]rcame|ll[aá]mame|llamada|marcar|ll[aá]mar/i, 'agendar_llamada'],
  [/l[ií]nea|captura|pdf|acuse|m[aá]ndame|env[ií]ame/i, 'enviar_linea_captura'],
  [/ret(e|i)en|retenci|2[.,]1|2[.,]5|por qu[eé] me quitan/i, 'explicar_retenciones'],
  [/buz[oó]n|avisos?/i, 'estado_buzon'],
  [/cu[aá]nto|pago|pagar|debo|total|vence|desglose|isr|iva/i, 'consultar_mes'],
  [/^(hola|buen[oa]s?|qu[eé] tal|hey)\b/i, 'saludo'],
];

export function detectarIntencion(mensaje: string): string {
  for (const [re, intencion] of INTENCIONES) if (re.test(mensaje.trim())) return intencion;
  return 'otra';
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function mesMencionado(mensaje: string): number | undefined {
  const i = MESES.findIndex((m) => mensaje.toLowerCase().includes(m));
  return i >= 0 ? i + 1 : undefined;
}

export async function responderSinModelo(
  mensaje: string,
  ctx: ContextoAgente,
): Promise<ResultadoConversacion> {
  const intencion = detectarIntencion(mensaje);
  const persona = PERSONAS[ctx.persona];
  const mes = mesMencionado(mensaje);
  const herramientas = intencion === 'saludo' || intencion === 'otra' ? [] : [intencion];
  const listo = (texto: string): ResultadoConversacion => ({ texto, herramientas, vueltas: 1 });

  switch (intencion) {
    case 'consultar_mes': {
      const r = consultarMes(ctx, mes);
      if ('error' in r) return listo(r.error ?? 'No tengo datos de ese mes.');
      const revision = r.motivos_revision.length ? `\n${r.motivos_revision[0]}` : '';
      if (r.estado === 'presentada')
        return listo(
          `Tu declaración de ${r.periodo} ya está presentada. Fueron ${r.total_a_pagar}.`,
        );
      return listo(
        `En ${r.periodo} pagas ${r.total_a_pagar}: ${r.isr_a_pagar} de ISR y ${r.iva_a_pagar} de IVA, después de restar lo que te retuvieron las apps. ${r.vencimiento}${revision}`,
      );
    }
    case 'explicar_retenciones': {
      const r = explicarRetenciones(ctx, mes);
      if (!('retenciones_del_mes' in r)) return listo(r.por_que);
      const apps = r.retenciones_del_mes.map((x) => x.app).join(' y ');
      const tasa = r.retenciones_del_mes[0]?.tasa_isr ?? '';
      const isr = r.retenciones_del_mes.map((x) => `${x.app} ${x.isr_retenido}`).join(', ');
      return listo(
        `${apps} te retienen ${tasa} de ISR y 8% de IVA porque tienen tu RFC; así lo marcan el art. 113-A de la LISR y el 18-J de la LIVA. En ${r.periodo} te retuvieron de ISR: ${isr}. Todo eso se resta de lo que pagas.\nSin RFC te habrían retenido ${r.sin_rfc_te_habrian_retenido}; inscrito, entre retenciones y pago, son ${r.inscrito_entre_retenciones_y_pago}.`,
      );
    }
    case 'estado_buzon': {
      const r = estadoBuzon(ctx);
      return listo(
        r.habilitado
          ? `Revisé tu buzón tributario: ${r.avisos.toLowerCase()}.`
          : `Tu buzón tributario no está habilitado. ${r.consecuencia} Lo podemos habilitar juntos en minutos.`,
      );
    }
    case 'enviar_linea_captura': {
      const r = consultarMes(ctx, mes);
      if ('error' in r) return listo(r.error ?? 'No tengo datos de ese mes.');
      const envio = await ctx.acciones.enviarLineaCaptura(
        Number(mes ?? MESES.indexOf(r.periodo.split(' ')[0] ?? '') + 1),
      );
      return listo(
        envio.enviado
          ? `Aquí está tu línea de captura de ${r.periodo} por ${r.total_a_pagar}. Es de demostración, no sirve para pagar.`
          : envio.detalle,
      );
    }
    case 'agendar_llamada': {
      const r = await ctx.acciones.agendarLlamada();
      return listo(
        r.programada
          ? 'Va, te marco en unos segundos.'
          : `Por ahora no puedo llamarte: ${r.detalle.charAt(0).toLowerCase()}${r.detalle.slice(1)}.`,
      );
    }
    case 'saludo':
      return listo(
        `Hola, ${persona.nombre}. Soy tu contador virtual. Puedo decirte cuánto pagas este mes, explicarte tus retenciones o mandarte tu línea de captura.`,
      );
    default:
      return listo(
        `Puedo decirte cuánto pagas en ${nombreMes(consultarMesSeguro(ctx))}, explicarte tus retenciones, mandarte tu línea de captura o revisar tu buzón. Si tu duda es de otro tema, un contador humano la revisa contigo.`,
      );
  }
}

function consultarMesSeguro(ctx: ContextoAgente): number {
  const r = consultarMes(ctx);
  return 'error' in r ? 10 : MESES.indexOf(r.periodo.split(' ')[0] ?? 'octubre') + 1;
}
