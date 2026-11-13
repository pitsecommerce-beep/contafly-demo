import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  type ContextoAgente,
  consultarMes,
  conversar,
  ejecutarHerramienta,
  estadoBuzon,
  explicarRetenciones,
} from '../src/index.js';

const acciones = {
  enviarLineaCaptura: vi.fn(async (mes: number) => ({
    enviado: true,
    detalle: `PDF de ${mes} enviado`,
  })),
  agendarLlamada: vi.fn(async () => ({
    programada: true,
    detalle: 'Te llamamos en unos segundos',
  })),
};
const luis: ContextoAgente = { persona: 'luis', hoy: '2026-11-13', acciones };
const mariana: ContextoAgente = { persona: 'mariana', hoy: '2026-11-13', acciones };

describe('herramientas', () => {
  it('consultar_mes de Luis trae los montos del motor', () => {
    const r = consultarMes(luis);
    expect(r).toMatchObject({
      periodo: 'octubre 2026',
      total_a_pagar: '$2,538.45',
      isr_a_pagar: '$1,818.45',
      iva_a_pagar: '$720.00',
      vencimiento: 'Vence el martes 17 de noviembre. Faltan 4 días.',
      estado: 'lista para presentar',
    });
  });
  it('consultar_mes de un mes presentado y de un mes sin datos', () => {
    expect(consultarMes(luis, 9)).toMatchObject({ estado: 'presentada' });
    expect(consultarMes(luis, 12)).toHaveProperty('error');
  });
  it('Mariana: octubre lo revisa un contador por la tasa de Amazon', () => {
    const r = consultarMes(mariana, 10);
    expect(r).toMatchObject({ estado: 'la revisa un contador antes de presentar' });
    expect(JSON.stringify(r)).toMatch(/Amazon te retuvo 1%/);
    expect(consultarMes(mariana, 8)).toMatchObject({ recargos: 'se calculan al presentar' });
  });
  it('explicar_retenciones: 2.1% con fuente y comparador', () => {
    const r = explicarRetenciones(luis);
    expect(r.tasas_con_rfc.isr_transporte_y_reparto).toMatch(/^2\.1% \(.*113-A/);
    expect(r).toMatchObject({
      sin_rfc_te_habrian_retenido: '$11,520.00',
      inscrito_entre_retenciones_y_pago: '$5,770.45',
    });
    expect(explicarRetenciones(luis, 12)).not.toHaveProperty('periodo');
  });
  it('estado_buzon', () => {
    expect(estadoBuzon(luis)).toMatchObject({ habilitado: true, avisos: 'Sin avisos nuevos' });
    expect(estadoBuzon(mariana)).toMatchObject({ habilitado: false });
  });
  it('acciones con efectos y errores', async () => {
    const r = await ejecutarHerramienta('enviar_linea_captura', {}, luis);
    expect(acciones.enviarLineaCaptura).toHaveBeenCalledWith(10);
    expect(JSON.parse(r.texto)).toMatchObject({ enviado: true, total: '$2,538.45' });
    expect(
      JSON.parse((await ejecutarHerramienta('agendar_llamada', {}, luis)).texto),
    ).toMatchObject({ programada: true });
    expect((await ejecutarHerramienta('inventada', {}, luis)).error).toBe(true);
    const falla = {
      ...luis,
      acciones: { ...acciones, agendarLlamada: async () => Promise.reject(new Error('sin saldo')) },
    };
    expect(await ejecutarHerramienta('agendar_llamada', {}, falla)).toEqual({
      texto: 'No se pudo completar: sin saldo',
      error: true,
    });
  });
});

/** Doble del cliente de Anthropic que devuelve respuestas en orden. */
function clienteFalso(respuestas: Array<Partial<Anthropic.Message>>) {
  const llamadas: Anthropic.MessageCreateParamsNonStreaming[] = [];
  const cliente = {
    messages: {
      create: vi.fn(async (params: Anthropic.MessageCreateParamsNonStreaming) => {
        llamadas.push(structuredClone(params));
        const r = respuestas.shift();
        if (!r) throw new Error('sin más respuestas');
        return r;
      }),
    },
  } as unknown as Pick<Anthropic, 'messages'>;
  return { cliente, llamadas };
}

const texto = (t: string): Partial<Anthropic.Message> => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text: t, citations: null }],
});
const herramienta = (name: string, input: unknown = {}): Partial<Anthropic.Message> => ({
  stop_reason: 'tool_use',
  content: [
    {
      type: 'tool_use',
      id: `t-${name}`,
      name,
      input,
      caller: { type: 'direct' },
    } as Anthropic.ToolUseBlock,
  ],
});

describe('conversar', () => {
  it('consulta el motor y responde con sus cifras', async () => {
    const { cliente, llamadas } = clienteFalso([
      herramienta('consultar_mes'),
      texto('Este mes pagas $2,538.45 y vence el martes 17.'),
    ]);
    const r = await conversar({
      cliente,
      modelo: 'modelo-prueba',
      historial: [],
      mensaje: '¿Cuánto pago este mes?',
      ctx: luis,
    });
    expect(r.texto).toBe('Este mes pagas $2,538.45 y vence el martes 17.');
    expect(r.herramientas).toEqual(['consultar_mes']);
    const segunda = llamadas[1];
    const resultado = (segunda?.messages.at(-1)?.content as Anthropic.ToolResultBlockParam[])[0];
    expect(resultado?.content).toContain('$2,538.45');
    expect(llamadas[0]?.model).toBe('modelo-prueba');
    expect(llamadas[0]?.output_config).toEqual({ effort: 'low' });
    expect(JSON.stringify(llamadas[0]?.system)).toContain('hablas con Luis');
  });

  it('une el historial y empieza con el usuario', async () => {
    const { cliente, llamadas } = clienteFalso([texto('Claro.')]);
    await conversar({
      cliente,
      modelo: 'm',
      historial: [
        { rol: 'assistant', texto: 'Hola' },
        { rol: 'user', texto: 'Hola' },
        { rol: 'user', texto: 'Una duda' },
      ],
      mensaje: '¿Me ayudas?',
      ctx: luis,
    });
    expect(llamadas[0]?.messages).toEqual([
      { role: 'user', content: 'Hola\nUna duda\n¿Me ayudas?' },
    ]);
  });

  it('responde con un respaldo ante rechazo, límite de vueltas o texto vacío', async () => {
    const r1 = await conversar({
      cliente: clienteFalso([{ stop_reason: 'refusal', content: [] }]).cliente,
      modelo: 'm',
      historial: [],
      mensaje: 'x',
      ctx: luis,
    });
    expect(r1.texto).toMatch(/no pude responder/);
    const r2 = await conversar({
      cliente: clienteFalso([herramienta('estado_buzon')]).cliente,
      modelo: 'm',
      historial: [],
      mensaje: 'x',
      ctx: luis,
      maxVueltas: 1,
    });
    expect(r2.texto).toMatch(/no pude responder/);
    const r3 = await conversar({
      cliente: clienteFalso([texto('  ')]).cliente,
      modelo: 'm',
      historial: [],
      mensaje: 'x',
      ctx: luis,
    });
    expect(r3.texto).toMatch(/no pude responder/);
  });

  it('marca errores de herramienta', async () => {
    const { cliente, llamadas } = clienteFalso([herramienta('no_existe'), texto('Listo')]);
    await conversar({ cliente, modelo: 'm', historial: [], mensaje: 'x', ctx: luis });
    const res = (llamadas[1]?.messages.at(-1)?.content as Anthropic.ToolResultBlockParam[])[0];
    expect(res?.is_error).toBe(true);
  });
});
