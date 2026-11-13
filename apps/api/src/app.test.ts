import { describe, expect, it } from 'vitest';
import { crearApp } from './app.js';

describe('api', () => {
  it('responde /salud', async () => {
    const app = crearApp();
    const res = await app.inject({ method: 'GET', url: '/salud' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ ok: true });
  });
});
