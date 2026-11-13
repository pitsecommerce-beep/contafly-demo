/** Interfaz de llamadas salientes. La implementación con Twilio Voice y Deepgram llega en la fase 5. */
export interface Llamador {
  readonly disponible: boolean;
  llamar(para: string, sesionId: string): Promise<{ sid: string | null }>;
}

export class LlamadorNoDisponible implements Llamador {
  readonly disponible = false;
  async llamar(): Promise<{ sid: string | null }> {
    throw new Error('Las llamadas todavía no están configuradas');
  }
}
