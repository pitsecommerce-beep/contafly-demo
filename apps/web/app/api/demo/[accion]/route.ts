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
      headers: { 'content-type': 'application/json' },
      body: await req.text(),
      signal: AbortSignal.timeout(15_000),
    });
    const datos = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    return NextResponse.json({ ok: r.ok, simulado: false, ...datos }, { status: r.ok ? 200 : 502 });
  } catch {
    return NextResponse.json(
      { ok: false, simulado: false, mensaje: 'No se pudo contactar al servicio' },
      { status: 502 },
    );
  }
}
