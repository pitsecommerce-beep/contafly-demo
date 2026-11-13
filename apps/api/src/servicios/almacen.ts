import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Guarda PDFs y devuelve una URL firmada de corta duración para que Twilio la descargue. */
export interface Almacen {
  guardarPdf(
    ruta: string,
    bytes: Uint8Array,
    segundos: number,
  ): Promise<{ ruta: string; url: string }>;
}

export class AlmacenSupabase implements Almacen {
  private db: SupabaseClient;
  constructor(url: string, llaveServicio: string) {
    this.db = createClient(url, llaveServicio, { auth: { persistSession: false } });
  }
  async guardarPdf(ruta: string, bytes: Uint8Array, segundos: number) {
    const sube = await this.db.storage
      .from('documentos')
      .upload(ruta, bytes, { contentType: 'application/pdf', upsert: true });
    if (sube.error) throw new Error(`No se pudo subir el PDF: ${sube.error.message}`);
    const firma = await this.db.storage.from('documentos').createSignedUrl(ruta, segundos);
    if (firma.error || !firma.data)
      throw new Error(`No se pudo firmar la URL: ${firma.error?.message}`);
    return { ruta, url: firma.data.signedUrl };
  }
}

/**
 * Sin Supabase: guarda en memoria y sirve desde la propia api con una URL firmada (HMAC)
 * que caduca. Suficiente para la demo; se pierde al reiniciar.
 */
export class AlmacenMemoria implements Almacen {
  archivos = new Map<string, { bytes: Uint8Array; caduca: number }>();
  constructor(
    private baseUrl: string,
    private secreto: string,
    private ahora: () => number = Date.now,
  ) {}

  firmar(id: string, exp: number): string {
    return createHmac('sha256', this.secreto).update(`${id}.${exp}`).digest('hex');
  }

  async guardarPdf(ruta: string, bytes: Uint8Array, segundos: number) {
    const id = randomUUID();
    const exp = Math.floor(this.ahora() / 1000) + segundos;
    this.archivos.set(id, { bytes, caduca: exp });
    return {
      ruta,
      url: `${this.baseUrl}/documentos/${id}.pdf?exp=${exp}&firma=${this.firmar(id, exp)}`,
    };
  }

  leer(id: string, exp: number, firma: string): Uint8Array | null {
    const esperada = Buffer.from(this.firmar(id, exp));
    const dada = Buffer.from(firma);
    if (esperada.length !== dada.length || !timingSafeEqual(esperada, dada)) return null;
    if (exp < Math.floor(this.ahora() / 1000)) return null;
    const a = this.archivos.get(id);
    return a && a.caduca === exp ? a.bytes : null;
  }
}
