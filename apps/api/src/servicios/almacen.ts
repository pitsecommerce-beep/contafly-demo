import { createHmac, timingSafeEqual } from 'node:crypto';
import type { SlugPersona } from '@contafly/datos-demo';

/**
 * PDFs sin almacenamiento: la URL lleva persona, mes, folio y caducidad, firmados con HMAC.
 * Al pedirla, la api vuelve a generar el PDF con el motor. Así no se necesita Storage
 * y las URLs siguen sirviendo aunque el proceso se reinicie (mientras no caduquen).
 */
export interface DocumentoFirmado {
  persona: SlugPersona;
  mes: number;
  folio: string;
  exp: number;
}

export class FirmadorDocumentos {
  constructor(
    private baseUrl: string,
    private secreto: string,
    private ahora: () => number = Date.now,
  ) {}

  private firma(token: string): string {
    return createHmac('sha256', this.secreto).update(token).digest('base64url');
  }

  url(doc: Omit<DocumentoFirmado, 'exp'>, segundos: number): { url: string; ruta: string } {
    const completo: DocumentoFirmado = { ...doc, exp: Math.floor(this.ahora() / 1000) + segundos };
    const token = Buffer.from(JSON.stringify(completo)).toString('base64url');
    const ruta = `/documentos/${token}.${this.firma(token)}.pdf`;
    return { url: `${this.baseUrl}${ruta}`, ruta };
  }

  /** Devuelve el documento si la firma es válida y no ha caducado. */
  leer(nombre: string): DocumentoFirmado | null {
    const m = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)\.pdf$/.exec(nombre);
    if (!m) return null;
    const [, token = '', firma = ''] = m;
    const esperada = Buffer.from(this.firma(token));
    const dada = Buffer.from(firma);
    if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null;
    try {
      const doc = JSON.parse(Buffer.from(token, 'base64url').toString()) as DocumentoFirmado;
      if (doc.exp < Math.floor(this.ahora() / 1000)) return null;
      return doc;
    } catch {
      return null;
    }
  }
}
