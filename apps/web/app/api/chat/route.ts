import {
  type AccionesCanal,
  type ContextoAgente,
  conversar,
  crearCliente,
  PROMPT_VOZ,
  responderSinModelo,
  type Turno,
  textoParaVoz,
} from '@contafly/agente';
import {
  DEMO_FECHA_POR_DEFECTO,
  PERSONAS,
  pendientes,
  type SlugPersona,
} from '@contafly/datos-demo';
import { formatoMxn, nombreMes, textoVencimiento } from '@contafly/motor-fiscal';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export type Efecto = { tipo: 'pdf'; mes: number; url: string } | { tipo: 'llamada' };

interface Cuerpo {
  persona?: unknown;
  mensaje?: unknown;
  historial?: unknown;
  canal?: unknown;
  inicioLlamada?: unknown;
}

// Límite simple por IP para no gastar de más la llave de Anthropic
const usos = new Map<string, { dia: string; n: number }>();
const MAX_POR_DIA = 150;

function dentroDelLimite(ip: string): boolean {
  const dia = new Date().toISOString().slice(0, 10);
  const u = usos.get(ip);
  if (!u || u.dia !== dia) {
    usos.set(ip, { dia, n: 1 });
    return true;
  }
  u.n++;
  return u.n <= MAX_POR_DIA;
}

function historialValido(h: unknown): Turno[] {
  if (!Array.isArray(h)) return [];
  return h
    .filter(
      (t): t is Turno =>
        typeof t === 'object' &&
        t !== null &&
        (t.rol === 'user' || t.rol === 'assistant') &&
        typeof t.texto === 'string',
    )
    .slice(-12)
    .map((t) => ({ rol: t.rol, texto: t.texto.slice(0, 1000) }));
}

function saludoLlamada(persona: SlugPersona, hoy: string): string {
  const p = PERSONAS[persona];
  const pend = pendientes(p, hoy);
  if (pend.length === 0)
    return `Hola, ${p.nombre}. Soy tu contador de Contafly. Estás al corriente, todo en orden. ¿Tienes alguna duda?`;
  if (pend.length === 1) {
    const m = pend[0];
    if (!m) return `Hola, ${p.nombre}. Soy tu contador de Contafly.`;
    const vence = textoVencimiento(hoy, m.venceEl)
      .replace(/^Vence/, 'vence')
      .replace(/\.$/, '');
    return `Hola, ${p.nombre}. Soy tu contador de Contafly. Tu declaración de ${nombreMes(m.mes)} está lista: son ${formatoMxn(m.resultado.totalCent)} y ${vence}. ¿Tienes alguna duda?`;
  }
  const total = pend.reduce((t, m) => t + m.resultado.totalCent, 0);
  const meses = pend.map((m) => nombreMes(m.mes));
  return `Hola, ${p.nombre}. Soy tu contador de Contafly. Tienes pendientes ${meses.slice(0, -1).join(', ')} y ${meses.at(-1)}: en total son ${formatoMxn(total)}, más recargos que se calculan al presentar. Te ayudo a ponerte al corriente. ¿Tienes alguna duda?`;
}

export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local';
  if (!dentroDelLimite(ip)) {
    return NextResponse.json({
      texto: 'Por hoy llegamos al límite de mensajes de la demo. Mañana seguimos.',
      voz: '',
      efectos: [],
    });
  }
  const b = (await req.json().catch(() => ({}))) as Cuerpo;
  const persona: SlugPersona = b.persona === 'mariana' ? 'mariana' : 'luis';
  const canal = b.canal === 'voz' ? 'voz' : 'whatsapp';
  const hoy = process.env.DEMO_FECHA ?? DEMO_FECHA_POR_DEFECTO;

  if (b.inicioLlamada === true) {
    const texto = saludoLlamada(persona, hoy);
    return NextResponse.json({ texto, voz: textoParaVoz(texto), efectos: [] });
  }

  const mensaje = typeof b.mensaje === 'string' ? b.mensaje.trim().slice(0, 500) : '';
  if (!mensaje) return NextResponse.json({ texto: '', voz: '', efectos: [] }, { status: 400 });

  const efectos: Efecto[] = [];
  const acciones: AccionesCanal = {
    enviarLineaCaptura: async (mes) => {
      efectos.push({ tipo: 'pdf', mes, url: `/api/acuse?persona=${persona}&mes=${mes}` });
      return { enviado: true, detalle: `PDF de ${nombreMes(mes)} enviado por WhatsApp` };
    },
    agendarLlamada: async () => {
      efectos.push({ tipo: 'llamada' });
      return { programada: true, detalle: 'Le llamamos en unos segundos' };
    },
  };
  const ctx: ContextoAgente = { persona, hoy, acciones };
  const llave = process.env.ANTHROPIC_API_KEY;

  try {
    const r = llave
      ? await conversar({
          cliente: crearCliente(llave),
          modelo: process.env.ANTHROPIC_MODEL || 'claude-opus-5-5',
          esfuerzo: 'low',
          ...(canal === 'voz' ? { prompt: PROMPT_VOZ } : {}),
          historial: historialValido(b.historial),
          mensaje,
          ctx,
        })
      : await responderSinModelo(mensaje, ctx);
    return NextResponse.json({
      texto: r.texto,
      voz: textoParaVoz(r.texto),
      efectos,
      modelo: Boolean(llave),
    });
  } catch {
    // Si falla la llamada al modelo, respondemos con las reglas para no dejar la demo colgada
    efectos.length = 0;
    const r = await responderSinModelo(mensaje, ctx);
    return NextResponse.json({
      texto: r.texto,
      voz: textoParaVoz(r.texto),
      efectos,
      modelo: false,
    });
  }
}
