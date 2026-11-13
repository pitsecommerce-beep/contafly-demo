'use client';

export type Accion = 'presentar' | 'recordatorio' | 'llamar' | 'conectar' | 'borrar';

export interface RespuestaDemo {
  ok: boolean;
  /** true si no hay api configurada y solo se simuló en pantalla */
  simulado: boolean;
  mensaje?: string;
  sesionId?: string;
}

/** Llama a las rutas de la web, que reenvían a apps/api o simulan si no hay llaves. */
export async function accionDemo(
  accion: Accion,
  cuerpo: Record<string, unknown>,
): Promise<RespuestaDemo> {
  try {
    const r = await fetch(`/api/demo/${accion}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(cuerpo),
    });
    return (await r.json()) as RespuestaDemo;
  } catch {
    return { ok: false, simulado: true, mensaje: 'Sin conexión' };
  }
}
