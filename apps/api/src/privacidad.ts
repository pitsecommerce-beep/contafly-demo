import { createHash } from 'node:crypto';

const E164 = /^\+[1-9]\d{7,14}$/;

export function esE164(t: unknown): t is string {
  return typeof t === 'string' && E164.test(t);
}

/** "+52 ••• ••• 5678": nunca se registra el número completo. */
export function enmascarar(e164: string): string {
  return `${e164.slice(0, 3)} ••• ••• ${e164.slice(-4)}`;
}

export function hashTelefono(e164: string): string {
  return createHash('sha256').update(`contafly-demo:${e164}`).digest('hex');
}

/** "whatsapp:+5215512345678" -> "+5215512345678" */
export function deWhatsApp(from: string): string {
  return from.replace(/^whatsapp:/, '');
}

/**
 * En WhatsApp, los números móviles de México llegan como +521XXXXXXXXXX y
 * en la web se capturan como +52XXXXXXXXXX. Normalizamos a la forma sin el 1.
 */
export function normalizarMx(e164: string): string {
  return /^\+521\d{10}$/.test(e164) ? `+52${e164.slice(4)}` : e164;
}
