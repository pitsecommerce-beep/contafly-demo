import twilio from 'twilio';
import { enmascarar } from '../privacidad.js';

export interface EnvioWhatsApp {
  para: string;
  cuerpo: string;
  mediaUrl?: string;
}

export interface EnviadorWhatsApp {
  readonly simulado: boolean;
  enviar(m: EnvioWhatsApp): Promise<{ sid: string | null }>;
}

export class EnviadorTwilio implements EnviadorWhatsApp {
  readonly simulado = false;
  private cliente: ReturnType<typeof twilio>;
  constructor(
    accountSid: string,
    authToken: string,
    private from: string,
  ) {
    this.cliente = twilio(accountSid, authToken);
  }
  async enviar(m: EnvioWhatsApp) {
    const r = await this.cliente.messages.create({
      from: this.from,
      to: `whatsapp:${m.para}`,
      body: m.cuerpo,
      ...(m.mediaUrl ? { mediaUrl: [m.mediaUrl] } : {}),
    });
    return { sid: r.sid };
  }
}

/** Sin cuenta de Twilio: registra el envío (con el número enmascarado) y no manda nada. */
export class EnviadorSimulado implements EnviadorWhatsApp {
  readonly simulado = true;
  enviados: EnvioWhatsApp[] = [];
  constructor(private log: (msg: string) => void = () => {}) {}
  async enviar(m: EnvioWhatsApp) {
    this.enviados.push(m);
    this.log(`WhatsApp simulado a ${enmascarar(m.para)}${m.mediaUrl ? ' con PDF' : ''}`);
    return { sid: null };
  }
}
