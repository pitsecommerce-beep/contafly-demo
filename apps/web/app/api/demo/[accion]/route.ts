import { NextResponse } from 'next/server';

const ACCIONES = new Set(['presentar', 'recordatorio', 'llamar', 'conectar', 'borrar']);

/**
 * Reenvía la acción a apps/api cuando PUBLIC_API_URL está configurada.
 * Sin api, responde que se simuló para que la demo funcione sin llaves.
 */
export async function POST(req: Request, { params }: { params: Promise<{ accion: string }> }) {
  const { accion } = await params;
  if (!ACCIONES.has(accion))
    return NextResponse.json({ ok: false, simulado: true }, { status: 404 });
  const api = process.env.PUBLIC_API_URL;
  if (!api) return NextResponse.json({ ok: true, simulado: true });
  try {
    const r = await fetch(`${api.replace(/\/$/, '')}/demo/${accion}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.DEMO_API_TOKEN ? { 'x-demo-token': process.env.DEMO_API_TOKEN } : {}),
      },
      body: await req.text(),
      signal: AbortSignal.timeout(15_000),
    });
    const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    // Se devuelve 200 para que la web muestre el mensaje del servicio
    return NextResponse.json({ ...datos, ok: r.ok, simulado: datos.simulado === true });
  } catch {
    return NextResponse.json(
      { ok: false, simulado: false, mensaje: 'No se pudo contactar al servicio' },
      { status: 502 },
    );
  }
}
