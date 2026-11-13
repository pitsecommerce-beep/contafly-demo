import type { SlugPersona } from '@contafly/datos-demo';
import formbody from '@fastify/formbody';
import Fastify, { type FastifyInstance, type FastifyRequest } from 'fastify';
import twilio from 'twilio';
import type { Config } from './config.js';
import { deWhatsApp, enmascarar, esE164, normalizarMx } from './privacidad.js';
import { AlmacenMemoria } from './servicios/almacen.js';
import {
  Contador,
  type Dependencias,
  LimiteExcedido,
  type TipoRecordatorio,
} from './servicios/contador.js';

export interface OpcionesApp extends Dependencias {
  /** Token compartido con la web para las rutas /demo/*. Sin token, se aceptan (solo desarrollo). */
  tokenDemo: string | null;
  /** Ejecuta trabajo en segundo plano; las pruebas lo esperan. */
  segundoPlano?: (p: Promise<unknown>) => void;
}

const PERSONAS_VALIDAS = new Set<SlugPersona>(['luis', 'mariana']);
const TIPOS = new Set<TipoRecordatorio>(['dia10', 'dia15', 'dia17']);

function urlPublica(config: Config, req: FastifyRequest): string {
  const base = config.publicApiUrl ?? `${req.protocol}://${req.host}`;
  return `${base}${req.url}`;
}

export function crearApp(op: OpcionesApp): FastifyInstance {
  const app = Fastify({
    logger: {
      level: process.env.LOG_LEVEL ?? 'info',
      // Nunca registrar cuerpos ni números completos
      redact: [
        'req.body',
        'req.headers.authorization',
        'req.headers["x-demo-token"]',
        'req.headers["x-twilio-signature"]',
      ],
    },
    trustProxy: true,
  });
  const { config, repo } = op;
  const contador = new Contador(op);
  const fondo =
    op.segundoPlano ??
    ((p: Promise<unknown>) => {
      p.catch((e: unknown) =>
        app.log.error({ err: (e as Error).message }, 'error en segundo plano'),
      );
    });

  app.register(formbody);

  app.get('/salud', async () => ({
    ok: true,
    demoFecha: config.demoFecha,
    whatsapp: op.whatsapp.simulado ? 'simulado' : 'twilio',
    llamadas: op.llamador.disponible,
    contador: Boolean(op.anthropic),
  }));

  // Documentos firmados cuando no hay Supabase
  if (op.almacen instanceof AlmacenMemoria) {
    const almacen = op.almacen;
    app.get<{ Params: { id: string }; Querystring: { exp?: string; firma?: string } }>(
      '/documentos/:id',
      async (req, reply) => {
        const id = req.params.id.replace(/\.pdf$/, '');
        const bytes = almacen.leer(id, Number(req.query.exp), String(req.query.firma ?? ''));
        if (!bytes) return reply.code(404).send({ ok: false });
        return reply
          .header('content-type', 'application/pdf')
          .header('cache-control', 'no-store')
          .send(Buffer.from(bytes));
      },
    );
  }

  // Webhook entrante de WhatsApp ----------------------------------------------
  app.post('/twilio/whatsapp', async (req, reply) => {
    const token = config.twilioAuthToken;
    if (!token) return reply.code(503).send('Twilio no configurado');
    const firma = req.headers['x-twilio-signature'];
    const params = (req.body ?? {}) as Record<string, string>;
    if (
      typeof firma !== 'string' ||
      !twilio.validateRequest(token, firma, urlPublica(config, req), params)
    ) {
      req.log.warn('firma de Twilio inválida');
      return reply.code(403).send('Firma inválida');
    }
    const telefono = normalizarMx(deWhatsApp(params.From ?? ''));
    const texto = (params.Body ?? '').trim();
    if (esE164(telefono) && texto) {
      fondo(
        (async () => {
          const sesion =
            (await repo.sesionPorTelefono(telefono)) ??
            (await repo.crearOActualizarSesion(telefono, 'luis'));
          await contador.responder(sesion, texto);
        })(),
      );
    }
    // Respondemos de inmediato; la respuesta del contador sale por la API REST
    return reply.header('content-type', 'text/xml').send('<Response></Response>');
  });

  // Rutas de la web -------------------------------------------------------------
  app.register(async (demo) => {
    demo.addHook('onRequest', async (req, reply) => {
      if (op.tokenDemo && req.headers['x-demo-token'] !== op.tokenDemo) {
        return reply.code(401).send({ ok: false, mensaje: 'No autorizado' });
      }
    });

    const sesionDe = async (cuerpo: { telefono?: unknown }) => {
      if (!esE164(cuerpo.telefono)) return null;
      return repo.sesionPorTelefono(normalizarMx(cuerpo.telefono));
    };

    demo.post<{ Body: { telefono?: unknown; consentimiento?: unknown; persona?: unknown } }>(
      '/demo/conectar',
      async (req, reply) => {
        const b = req.body ?? {};
        if (!esE164(b.telefono))
          return reply.code(400).send({ ok: false, mensaje: 'Número inválido' });
        if (b.consentimiento !== true)
          return reply.code(400).send({ ok: false, mensaje: 'Falta el consentimiento' });
        const persona = PERSONAS_VALIDAS.has(b.persona as SlugPersona)
          ? (b.persona as SlugPersona)
          : 'luis';
        const s = await repo.crearOActualizarSesion(normalizarMx(b.telefono), persona);
        await repo.bitacora(s.id, 'conectar', { telefono: enmascarar(s.telefono) });
        return { ok: true, sesionId: s.id };
      },
    );

    demo.post<{ Body: { telefono?: unknown; persona?: unknown; mes?: unknown; meses?: unknown } }>(
      '/demo/presentar',
      async (req, reply) => {
        const b = req.body ?? {};
        const sesion = await sesionDe(b);
        if (!sesion)
          return reply.code(404).send({ ok: false, mensaje: 'Conecta tu WhatsApp primero' });
        const persona = PERSONAS_VALIDAS.has(b.persona as SlugPersona)
          ? (b.persona as SlugPersona)
          : sesion.persona;
        const meses = (Array.isArray(b.meses) ? b.meses : [b.mes ?? 10]).filter(
          (m): m is number => Number.isInteger(m) && (m as number) >= 1 && (m as number) <= 12,
        );
        if (meses.length === 0 || meses.length > 6)
          return reply.code(400).send({ ok: false, mensaje: 'Meses inválidos' });
        const s =
          persona === sesion.persona
            ? sesion
            : await repo.crearOActualizarSesion(sesion.telefono, persona);
        fondo(contador.presentar(s, meses));
        return { ok: true, simulado: op.whatsapp.simulado };
      },
    );

    demo.post<{ Body: { telefono?: unknown; tipo?: unknown } }>(
      '/demo/recordatorio',
      async (req, reply) => {
        const b = req.body ?? {};
        const sesion = await sesionDe(b);
        if (!sesion)
          return reply.code(404).send({ ok: false, mensaje: 'Conecta tu WhatsApp primero' });
        if (!TIPOS.has(b.tipo as TipoRecordatorio))
          return reply.code(400).send({ ok: false, mensaje: 'Tipo inválido' });
        try {
          await contador.recordatorio(sesion, b.tipo as TipoRecordatorio);
          return { ok: true, simulado: op.whatsapp.simulado };
        } catch (e) {
          if (e instanceof LimiteExcedido)
            return reply.code(429).send({ ok: false, mensaje: e.message });
          throw e;
        }
      },
    );

    demo.post<{ Body: { telefono?: unknown } }>('/demo/llamar', async (req, reply) => {
      const sesion = await sesionDe(req.body ?? {});
      if (!sesion)
        return reply.code(404).send({ ok: false, mensaje: 'Conecta tu WhatsApp primero' });
      if (!op.llamador.disponible)
        return reply
          .code(503)
          .send({ ok: false, mensaje: 'Las llamadas todavía no están configuradas' });
      try {
        await contador.llamar(sesion);
        return { ok: true };
      } catch (e) {
        if (e instanceof LimiteExcedido)
          return reply.code(429).send({ ok: false, mensaje: e.message });
        throw e;
      }
    });

    demo.post<{ Body: { telefono?: unknown } }>('/demo/borrar', async (req) => {
      const b = req.body ?? {};
      if (esE164(b.telefono)) {
        const tel = normalizarMx(b.telefono);
        await repo.borrarSesion(tel);
        await repo.bitacora(null, 'borrar', { telefono: enmascarar(tel) });
      }
      return { ok: true };
    });
  });

  return app;
}
