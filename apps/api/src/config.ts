import { randomBytes } from 'node:crypto';
import { DEMO_FECHA_POR_DEFECTO } from '@contafly/datos-demo';

export interface Config {
  demoFecha: string;
  publicApiUrl: string | null;
  publicWebUrl: string | null;
  twilio: {
    accountSid: string;
    authToken: string;
    whatsappFrom: string;
    voiceFrom: string | null;
  } | null;
  /** Token para validar firmas aunque no haya cuenta completa (pruebas) */
  twilioAuthToken: string | null;
  /** Supabase con la llave anon: la api usa solo funciones RPC */
  supabase: { url: string; anonKey: string } | null;
  anthropic: { apiKey: string; modelo: string } | null;
  deepgramApiKey: string | null;
  limites: { mensajesPorDia: number; llamadasPorDia: number; documentosPorDia: number };
  /** Secreto para firmar las URLs de los PDFs */
  secretoUrls: string;
}

const v = (e: NodeJS.ProcessEnv, k: string) => {
  const x = e[k]?.trim();
  return x ? x : null;
};

export function leerConfig(e: NodeJS.ProcessEnv = process.env): Config {
  const sid = v(e, 'TWILIO_ACCOUNT_SID');
  const token = v(e, 'TWILIO_AUTH_TOKEN');
  const from = v(e, 'TWILIO_WHATSAPP_FROM');
  const supaUrl = v(e, 'NEXT_PUBLIC_SUPABASE_URL') ?? v(e, 'SUPABASE_URL');
  const supaKey = v(e, 'NEXT_PUBLIC_SUPABASE_ANON_KEY') ?? v(e, 'SUPABASE_ANON_KEY');
  const anthKey = v(e, 'ANTHROPIC_API_KEY');
  return {
    demoFecha: v(e, 'DEMO_FECHA') ?? DEMO_FECHA_POR_DEFECTO,
    publicApiUrl: v(e, 'PUBLIC_API_URL')?.replace(/\/$/, '') ?? null,
    publicWebUrl: v(e, 'PUBLIC_WEB_URL')?.replace(/\/$/, '') ?? null,
    twilio:
      sid && token && from
        ? {
            accountSid: sid,
            authToken: token,
            whatsappFrom: from.startsWith('whatsapp:') ? from : `whatsapp:${from}`,
            voiceFrom: v(e, 'TWILIO_VOICE_FROM'),
          }
        : null,
    twilioAuthToken: token,
    supabase: supaUrl && supaKey ? { url: supaUrl, anonKey: supaKey } : null,
    anthropic: anthKey
      ? { apiKey: anthKey, modelo: v(e, 'ANTHROPIC_MODEL') ?? 'claude-opus-5-5' }
      : null,
    deepgramApiKey: v(e, 'DEEPGRAM_API_KEY'),
    limites: {
      mensajesPorDia: Number(v(e, 'LIMITE_MENSAJES_DIA') ?? 60),
      llamadasPorDia: Number(v(e, 'LIMITE_LLAMADAS_DIA') ?? 3),
      documentosPorDia: Number(v(e, 'LIMITE_DOCUMENTOS_DIA') ?? 10),
    },
    secretoUrls: v(e, 'SECRETO_URLS') ?? token ?? randomBytes(32).toString('hex'),
  };
}
