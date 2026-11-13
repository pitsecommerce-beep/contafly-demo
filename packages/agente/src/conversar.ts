import Anthropic from '@anthropic-ai/sdk';
import { PERSONAS } from '@contafly/datos-demo';
import { fechaLarga } from '@contafly/motor-fiscal';
import { type ContextoAgente, ejecutarHerramienta, HERRAMIENTAS } from './herramientas.js';
import { PROMPT_CONTADOR } from './prompt.js';

export interface Turno {
  rol: 'user' | 'assistant';
  texto: string;
}

export type Esfuerzo = 'low' | 'medium' | 'high';

export interface OpcionesConversacion {
  /** Cliente de Anthropic (o un doble de prueba con la misma forma) */
  cliente: Pick<Anthropic, 'messages'>;
  modelo: string;
  esfuerzo?: Esfuerzo;
  prompt?: string;
  historial: Turno[];
  mensaje: string;
  ctx: ContextoAgente;
  /** Límite de vueltas herramienta-respuesta para no gastar de más */
  maxVueltas?: number;
}

export interface ResultadoConversacion {
  texto: string;
  herramientas: string[];
  vueltas: number;
}

const RESPALDO = 'Perdón, no pude responder en este momento. ¿Me lo repites en un ratito?';

function contexto(ctx: ContextoAgente): string {
  const p = PERSONAS[ctx.persona];
  return `Contexto de la conversación (datos de ejemplo): hablas con ${p.nombre}, ${p.ocupacion.toLowerCase()}. Hoy es ${fechaLarga(ctx.hoy)} de ${ctx.hoy.slice(0, 4)}.`;
}

/** Une turnos consecutivos del mismo rol y garantiza que el primero sea del usuario. */
function aMensajes(historial: Turno[], mensaje: string): Anthropic.MessageParam[] {
  const turnos = [...historial, { rol: 'user' as const, texto: mensaje }];
  while (turnos[0] && turnos[0].rol !== 'user') turnos.shift();
  const salida: Anthropic.MessageParam[] = [];
  for (const t of turnos) {
    const ultimo = salida.at(-1);
    if (ultimo && ultimo.role === t.rol && typeof ultimo.content === 'string') {
      ultimo.content = `${ultimo.content}\n${t.texto}`;
    } else {
      salida.push({ role: t.rol, content: t.texto });
    }
  }
  return salida;
}

/** Bucle de herramientas: el modelo consulta al motor y responde con sus cifras. */
export async function conversar(op: OpcionesConversacion): Promise<ResultadoConversacion> {
  const messages = aMensajes(op.historial, op.mensaje);
  const herramientas: string[] = [];
  const max = op.maxVueltas ?? 5;

  for (let vuelta = 1; vuelta <= max; vuelta++) {
    const respuesta = await op.cliente.messages.create({
      model: op.modelo,
      max_tokens: 2048,
      system: [
        { type: 'text', text: op.prompt ?? PROMPT_CONTADOR, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: contexto(op.ctx) },
      ],
      tools: HERRAMIENTAS,
      tool_choice: { type: 'auto' },
      output_config: { effort: op.esfuerzo ?? 'low' },
      messages,
    });

    if (respuesta.stop_reason === 'refusal' || respuesta.stop_reason === 'max_tokens') {
      return { texto: RESPALDO, herramientas, vueltas: vuelta };
    }

    const usos = respuesta.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
    );
    if (respuesta.stop_reason !== 'tool_use' || usos.length === 0) {
      const texto = respuesta.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      return { texto: texto || RESPALDO, herramientas, vueltas: vuelta };
    }

    messages.push({ role: 'assistant', content: respuesta.content });
    const resultados: Anthropic.ToolResultBlockParam[] = [];
    for (const uso of usos) {
      herramientas.push(uso.name);
      const r = await ejecutarHerramienta(uso.name, uso.input, op.ctx);
      resultados.push({
        type: 'tool_result',
        tool_use_id: uso.id,
        content: r.texto,
        ...(r.error ? { is_error: true } : {}),
      });
    }
    // Todos los resultados en un solo mensaje para no desalentar llamadas en paralelo
    messages.push({ role: 'user', content: resultados });
  }
  return { texto: RESPALDO, herramientas, vueltas: max };
}

export function crearCliente(apiKey?: string): Anthropic {
  return apiKey
    ? new Anthropic({ apiKey, maxRetries: 2, timeout: 20_000 })
    : new Anthropic({ maxRetries: 2, timeout: 20_000 });
}
