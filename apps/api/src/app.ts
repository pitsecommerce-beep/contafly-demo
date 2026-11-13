import Fastify, { type FastifyInstance } from 'fastify';

export function crearApp(): FastifyInstance {
  const app = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });
  app.get('/salud', async () => ({ ok: true, demoFecha: process.env.DEMO_FECHA ?? null }));
  return app;
}
