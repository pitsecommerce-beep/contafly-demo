import type Anthropic from '@anthropic-ai/sdk';
import twilio from 'twilio';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { crearApp } from '../src/app.js';
import { leerConfig } from '../src/config.js';
import { correrRecordatorios } from '../src/recordatorios.js';
import { AlmacenMemoria } from '../src/servicios/almacen.js';
import { Contador } from '../src/servicios/contador.js';
import { LlamadorNoDisponible } from '../src/servicios/llamadas.js';
import { RepositorioMemoria } from '../src/servicios/repositorio.js';
import { EnviadorSimulado } from '../src/servicios/whatsapp.js';

const TOKEN = 'token-de-prueba';
const BASE = 'https://api.demo.test';
const TEL = '+525512345678';

function preparar(
  opciones: {
    anthropic?: Pick<Anthropic, 'messages'> | null;
    tokenDemo?: string | null;
    limiteMensajes?: number;
  } = {},
) {
  const config = leerConfig({
    DEMO_FECHA: '2026-11-13',
    PUBLIC_API_URL: BASE,
    TWILIO_AUTH_TOKEN: TOKEN,
    ANTHROPIC_API_KEY: 'x',
    ANTHROPIC_MODEL: 'modelo-prueba',
    LIMITE_MENSAJES_DIA: String(opciones.limiteMensajes ?? 60),
  });
  const repo = new RepositorioMemoria();
  const almacen = new AlmacenMemoria(BASE, 'secreto');
  const whatsapp = new EnviadorSimulado();
  const tareas: Promise<unknown>[] = [];
  const deps = {
    config,
    repo,
    almacen,
    whatsapp,
    llamador: new LlamadorNoDisponible(),
    anthropic: opciones.anthropic === undefined ? null : opciones.anthropic,
    esperar: async () => {},
    log: { info: () => {}, error: () => {} },
  };
  const app = crearApp({
    ...deps,
    tokenDemo: opciones.tokenDemo ?? null,
    segundoPlano: (p) => tareas.push(p),
  });
  const esperarFondo = () => Promise.all(tareas);
  return { app, repo, almacen, whatsapp, esperarFondo, deps };
}

function firmar(url: string, params: Record<string, string>) {
  return twilio.getExpectedTwilioSignature(TOKEN, url, params);
}

const clienteQueResponde = (texto: string) =>
  ({
    messages: {
      create: vi.fn(async () => ({
        stop_reason: 'end_turn',
        content: [{ type: 'text', text: texto, citations: null }],
      })),
    },
  }) as unknown as Pick<Anthropic, 'messages'>;

describe('webhook de WhatsApp', () => {
  const params = {
    From: 'whatsapp:+5215512345678',
    Body: '¿Por qué me retienen 2.1%?',
    MessageSid: 'SM1',
  };

  it('rechaza firmas inválidas', async () => {
    const { app, whatsapp } = preparar();
    const r = await app.inject({
      method: 'POST',
      url: '/twilio/whatsapp',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': 'falsa',
      },
      payload: new URLSearchParams(params).toString(),
    });
    expect(r.statusCode).toBe(403);
    expect(whatsapp.enviados).toHaveLength(0);
  });

  it('acepta la firma válida, responde TwiML vacío y el contador contesta', async () => {
    const cliente = clienteQueResponde(
      'Uber y DiDi te retienen 2.1% de ISR porque así lo marca el art. 113-A.',
    );
    const { app, whatsapp, repo, esperarFondo } = preparar({ anthropic: cliente });
    const r = await app.inject({
      method: 'POST',
      url: '/twilio/whatsapp',
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
        'x-twilio-signature': firmar(`${BASE}/twilio/whatsapp`, params),
      },
      payload: new URLSearchParams(params).toString(),
    });
    expect(r.statusCode).toBe(200);
    expect(r.body).toBe('<Response></Response>');
    await esperarFondo();
    // El número de WhatsApp (+521...) se normaliza al de la web (+52...)
    expect(whatsapp.enviados).toEqual([
      {
        para: TEL,
        cuerpo: 'Uber y DiDi te retienen 2.1% de ISR porque así lo marca el art. 113-A.',
      },
    ]);
    const sesion = await repo.sesionPorTelefono(TEL);
    expect(await repo.historial(sesion?.id ?? '', 10)).toHaveLength(2);
  });

  it('sin token de Twilio responde 503', async () => {
    const { app, deps } = preparar();
    deps.config.twilioAuthToken = null;
    const app2 = crearApp({ ...deps, tokenDemo: null });
    const r = await app2.inject({ method: 'POST', url: '/twilio/whatsapp', payload: {} });
    expect(r.statusCode).toBe(503);
    await app.close();
  });
});

describe('rutas de la demo', () => {
  let ctx: ReturnType<typeof preparar>;
  beforeEach(async () => {
    ctx = preparar();
  });

  const post = (url: string, payload: object, headers: Record<string, string> = {}) =>
    ctx.app.inject({ method: 'POST', url, payload, headers });

  it('conectar valida número y consentimiento', async () => {
    expect(
      (await post('/demo/conectar', { telefono: '5512345678', consentimiento: true })).statusCode,
    ).toBe(400);
    expect((await post('/demo/conectar', { telefono: TEL })).statusCode).toBe(400);
    const r = await post('/demo/conectar', { telefono: TEL, consentimiento: true });
    expect(r.json()).toMatchObject({ ok: true, sesionId: expect.any(String) });
  });

  it('presentar manda primero el PDF y después el mensaje exacto', async () => {
    expect((await post('/demo/presentar', { telefono: TEL })).statusCode).toBe(404);
    await post('/demo/conectar', { telefono: TEL, consentimiento: true });
    const r = await post('/demo/presentar', { telefono: TEL, persona: 'luis', mes: 10 });
    expect(r.statusCode).toBe(200);
    await ctx.esperarFondo();
    const [pdf, texto] = ctx.whatsapp.enviados;
    expect(pdf?.mediaUrl).toMatch(
      /^https:\/\/api\.demo\.test\/documentos\/.+\.pdf\?exp=\d+&firma=[0-9a-f]+$/,
    );
    expect(texto?.cuerpo).toBe(
      'Listo, presentamos tu declaración de octubre. Aquí está tu línea de captura por $2,538.45. Págala en tu banco cuando quieras, antes del 17 de noviembre.',
    );
    // El PDF se puede descargar con la firma y no sin ella
    const ruta = (pdf?.mediaUrl ?? '').replace(BASE, '');
    const descarga = await ctx.app.inject({ method: 'GET', url: ruta });
    expect(descarga.statusCode).toBe(200);
    expect(descarga.headers['content-type']).toBe('application/pdf');
    expect(descarga.rawPayload.subarray(0, 4).toString()).toBe('%PDF');
    expect(
      (await ctx.app.inject({ method: 'GET', url: ruta.replace(/firma=[0-9a-f]+/, 'firma=00') }))
        .statusCode,
    ).toBe(404);
  });

  it('presentar varios meses de Mariana', async () => {
    await post('/demo/conectar', { telefono: TEL, consentimiento: true });
    await post('/demo/presentar', { telefono: TEL, persona: 'mariana', meses: [8, 9, 10] });
    await ctx.esperarFondo();
    expect(ctx.whatsapp.enviados.filter((e) => e.mediaUrl)).toHaveLength(3);
    expect(ctx.whatsapp.enviados.at(-1)?.cuerpo).toMatch(
      /^Listo, ya estás al corriente\. Te mandé 3 líneas de captura por \$9,132\.30/,
    );
    expect((await post('/demo/presentar', { telefono: TEL, meses: [] })).statusCode).toBe(400);
  });

  it('recordatorios y límite diario', async () => {
    const c = preparar({ limiteMensajes: 1 });
    await c.app.inject({
      method: 'POST',
      url: '/demo/conectar',
      payload: { telefono: TEL, consentimiento: true },
    });
    const ok = await c.app.inject({
      method: 'POST',
      url: '/demo/recordatorio',
      payload: { telefono: TEL, tipo: 'dia15' },
    });
    expect(ok.statusCode).toBe(200);
    expect(c.whatsapp.enviados[0]?.cuerpo).toBe(
      'Faltan 2 días para el 17 de noviembre. Tu declaración de octubre es de $2,538.45.',
    );
    const tope = await c.app.inject({
      method: 'POST',
      url: '/demo/recordatorio',
      payload: { telefono: TEL, tipo: 'dia17' },
    });
    expect(tope.statusCode).toBe(429);
    expect(
      (
        await c.app.inject({
          method: 'POST',
          url: '/demo/recordatorio',
          payload: { telefono: TEL, tipo: 'otro' },
        })
      ).statusCode,
    ).toBe(400);
  });

  it('llamar responde 503 mientras no haya voz', async () => {
    await post('/demo/conectar', { telefono: TEL, consentimiento: true });
    expect((await post('/demo/llamar', { telefono: TEL })).statusCode).toBe(503);
  });

  it('borrar mis datos', async () => {
    await post('/demo/conectar', { telefono: TEL, consentimiento: true });
    await post('/demo/borrar', { telefono: TEL });
    expect(await ctx.repo.sesionPorTelefono(TEL)).toBeNull();
  });

  it('con token, las rutas de la demo lo exigen', async () => {
    const c = preparar({ tokenDemo: 'secreto-web' });
    expect(
      (await c.app.inject({ method: 'POST', url: '/demo/conectar', payload: {} })).statusCode,
    ).toBe(401);
    const r = await c.app.inject({
      method: 'POST',
      url: '/demo/conectar',
      payload: { telefono: TEL, consentimiento: true },
      headers: { 'x-demo-token': 'secreto-web' },
    });
    expect(r.statusCode).toBe(200);
  });
});

describe('recordatorios programados', () => {
  it('manda el del día 15 una sola vez y nada en días sin recordatorio', async () => {
    const { repo, deps, whatsapp } = preparar();
    await repo.crearOActualizarSesion(TEL, 'luis');
    const contador = new Contador(deps);
    expect(await correrRecordatorios(repo, contador, '2026-11-14')).toBe(0);
    expect(await correrRecordatorios(repo, contador, '2026-11-15')).toBe(1);
    expect(await correrRecordatorios(repo, contador, '2026-11-15')).toBe(0);
    expect(whatsapp.enviados).toHaveLength(1);
  });
});

describe('almacén en memoria', () => {
  it('las URLs caducan', async () => {
    let ahora = 1_000_000_000_000;
    const a = new AlmacenMemoria(BASE, 's', () => ahora);
    const { url } = await a.guardarPdf('x.pdf', new Uint8Array([1]), 60);
    const u = new URL(url);
    const id = u.pathname.split('/').pop()?.replace('.pdf', '') ?? '';
    expect(
      a.leer(id, Number(u.searchParams.get('exp')), u.searchParams.get('firma') ?? ''),
    ).not.toBeNull();
    ahora += 61_000;
    expect(
      a.leer(id, Number(u.searchParams.get('exp')), u.searchParams.get('firma') ?? ''),
    ).toBeNull();
  });
});
