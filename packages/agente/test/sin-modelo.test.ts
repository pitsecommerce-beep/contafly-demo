import { describe, expect, it, vi } from 'vitest';
import { type ContextoAgente, detectarIntencion, responderSinModelo } from '../src/index.js';

const acciones = {
  enviarLineaCaptura: vi.fn(async () => ({ enviado: true, detalle: 'ok' })),
  agendarLlamada: vi.fn(async () => ({
    programada: false,
    detalle: 'Las llamadas todavía no están configuradas',
  })),
};
const luis: ContextoAgente = { persona: 'luis', hoy: '2026-11-13', acciones };
const mariana: ContextoAgente = { persona: 'mariana', hoy: '2026-11-13', acciones };

describe('respuestas sin modelo', () => {
  it('detecta intenciones', () => {
    expect(detectarIntencion('¿Cuánto pago este mes?')).toBe('consultar_mes');
    expect(detectarIntencion('¿por qué me retienen 2.1%?')).toBe('explicar_retenciones');
    expect(detectarIntencion('mándame mi línea de captura')).toBe('enviar_linea_captura');
    expect(detectarIntencion('márcame')).toBe('agendar_llamada');
    expect(detectarIntencion('¿tengo avisos en el buzón?')).toBe('estado_buzon');
    expect(detectarIntencion('Hola')).toBe('saludo');
    expect(detectarIntencion('¿y la declaración anual?')).toBe('otra');
  });

  it('¿cuánto pago? con cifras del motor', async () => {
    const r = await responderSinModelo('¿Cuánto pago este mes?', luis);
    expect(r.texto).toBe(
      'En octubre 2026 pagas $2,538.45: $1,818.45 de ISR y $720.00 de IVA, después de restar lo que te retuvieron las apps. Vence el martes 17 de noviembre. Faltan 4 días.',
    );
  });

  it('retenciones de Luis y de Mariana', async () => {
    expect((await responderSinModelo('¿por qué me retienen 2.1%?', luis)).texto).toMatch(
      /^Uber y DiDi te retienen 2\.1% de ISR/,
    );
    expect((await responderSinModelo('¿por qué me retienen?', mariana)).texto).toMatch(
      /^Mercado Libre y Amazon te retienen 2\.5%/,
    );
  });

  it('meses presentados, mes mencionado y con revisión', async () => {
    expect((await responderSinModelo('¿cuánto pagué en septiembre?', luis)).texto).toMatch(
      /ya está presentada/,
    );
    expect((await responderSinModelo('¿cuánto debo de octubre?', mariana)).texto).toMatch(
      /Amazon te retuvo 1%/,
    );
    expect((await responderSinModelo('¿cuánto pago en diciembre?', luis)).texto).toMatch(
      /No hay actividad/,
    );
  });

  it('acciones y temas fuera de alcance', async () => {
    expect((await responderSinModelo('mándame mi línea de captura', luis)).texto).toMatch(
      /por \$2,538\.45/,
    );
    expect(acciones.enviarLineaCaptura).toHaveBeenCalledWith(10);
    expect((await responderSinModelo('márcame', luis)).texto).toMatch(
      /^Por ahora no puedo llamarte: las llamadas/,
    );
    expect((await responderSinModelo('buzón', luis)).texto).toMatch(/sin avisos nuevos/);
    expect((await responderSinModelo('buzón', mariana)).texto).toMatch(/no está habilitado/);
    expect((await responderSinModelo('hola', luis)).texto).toMatch(/^Hola, Luis/);
    expect((await responderSinModelo('¿y la anual?', luis)).texto).toMatch(/contador humano/);
  });
});
