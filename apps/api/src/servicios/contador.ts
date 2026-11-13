import type Anthropic from '@anthropic-ai/sdk';
import { conversar, crearCliente, type Esfuerzo, type Turno } from '@contafly/agente';
import { PERSONAS, resumenMeses } from '@contafly/datos-demo';
import { datosAcuseDesdeMotor, generarAcuse } from '@contafly/documentos';
import { fechaVencimiento, formatoMxn, nombreMes } from '@contafly/motor-fiscal';
import type { Config } from '../config.js';
import { enmascarar } from '../privacidad.js';
import type { DocumentoFirmado, FirmadorDocumentos } from './almacen.js';
import type { Llamador } from './llamadas.js';
import type { Repositorio, Sesion } from './repositorio.js';
import type { EnviadorWhatsApp } from './whatsapp.js';

export type TipoRecordatorio = 'dia10' | 'dia15' | 'dia17';

export interface Dependencias {
  config: Config;
  repo: Repositorio;
  documentos: FirmadorDocumentos;
  whatsapp: EnviadorWhatsApp;
  llamador: Llamador;
  /** Cliente de Anthropic; null si no hay llave (respuestas de respaldo) */
  anthropic: Pick<Anthropic, 'messages'> | null;
  esperar: (ms: number) => Promise<void>;
  log: {
    info: (o: object | string, m?: string) => void;
    error: (o: object | string, m?: string) => void;
  };
}

export class LimiteExcedido extends Error {
  constructor(canal: string) {
    super(`Se alcanzó el límite diario de ${canal} para este número`);
  }
}

const RETRASO_ESCRIBIENDO_MS = 1500;
const ENTRE_MENSAJES_MS = 800;
const DURACION_URL_S = 600;

function vencimientoCorto(anio: number, mes: number): string {
  const v = fechaVencimiento(anio, mes);
  return `${Number(v.slice(8, 10))} de ${nombreMes(Number(v.slice(5, 7)))}`;
}

export class Contador {
  constructor(private d: Dependencias) {}

  private hoy() {
    return this.d.config.demoFecha;
  }

  private resultado(sesion: Sesion, mes: number) {
    const m = resumenMeses(PERSONAS[sesion.persona], this.hoy()).find((x) => x.mes === mes);
    if (!m) throw new Error(`Sin datos para ${nombreMes(mes)}`);
    return m;
  }

  private async cupo(sesion: Sesion, canal: 'mensajes' | 'llamadas' | 'documentos') {
    const max = {
      mensajes: this.d.config.limites.mensajesPorDia,
      llamadas: this.d.config.limites.llamadasPorDia,
      documentos: this.d.config.limites.documentosPorDia,
    }[canal];
    const ok = await this.d.repo.consumirCupo(sesion.telefono, canal, this.fechaReal(), max);
    if (!ok) {
      await this.d.repo.bitacora(sesion.id, 'limite_excedido', { canal });
      throw new LimiteExcedido(canal);
    }
  }

  /** El límite se cuenta por día real, no por DEMO_FECHA. */
  private fechaReal() {
    return new Date().toISOString().slice(0, 10);
  }

  async enviarTexto(sesion: Sesion, cuerpo: string) {
    const r = await this.d.whatsapp.enviar({ para: sesion.telefono, cuerpo });
    await this.d.repo.guardarMensaje(sesion.id, { direccion: 'out', cuerpo, twilioSid: r.sid });
    return r;
  }

  /** Genera el PDF de demostración a partir del motor. */
  async pdf(doc: DocumentoFirmado): Promise<Uint8Array> {
    const persona = PERSONAS[doc.persona];
    const m = resumenMeses(persona, this.hoy()).find((x) => x.mes === doc.mes);
    if (!m) throw new Error(`Sin datos para ${nombreMes(doc.mes)}`);
    return generarAcuse(
      datosAcuseDesdeMotor(persona, m.resultado, {
        presentadoEn: `${this.hoy()}T18:42`,
        folio: doc.folio,
        ...(this.d.config.publicWebUrl ? { urlQr: this.d.config.publicWebUrl } : {}),
      }),
    );
  }

  /** Manda por WhatsApp el PDF de demostración del mes con una URL firmada de corta duración. */
  async enviarLineaCaptura(sesion: Sesion, mes: number, conTexto = true) {
    await this.cupo(sesion, 'documentos');
    const m = this.resultado(sesion, mes);
    const { url, ruta } = this.d.documentos.url(
      { persona: sesion.persona, mes, folio: `${sesion.id}-${m.anio}-${mes}` },
      DURACION_URL_S,
    );
    await this.d.repo.guardarDocumento(sesion.id, 'linea_captura', ruta.slice(0, 120));
    const pie = `Línea de captura de ${nombreMes(mes)} (demostración, no válida para pago)`;
    const r = await this.d.whatsapp.enviar({
      para: sesion.telefono,
      cuerpo: conTexto ? pie : '',
      mediaUrl: url,
    });
    await this.d.repo.guardarMensaje(sesion.id, {
      direccion: 'out',
      cuerpo: `[PDF] ${pie}`,
      twilioSid: r.sid,
    });
    return { totalCent: m.resultado.totalCent, mes };
  }

  /** Al confirmar en la web: "escribiendo", PDF(s) y el mensaje final, en ese orden. */
  async presentar(sesion: Sesion, meses: number[]) {
    await this.d.repo.bitacora(sesion.id, 'presentar', { meses, persona: sesion.persona });
    await this.d.esperar(RETRASO_ESCRIBIENDO_MS);
    let total = 0;
    for (const [i, mes] of meses.entries()) {
      if (i > 0) await this.d.esperar(ENTRE_MENSAJES_MS);
      const r = await this.enviarLineaCaptura(sesion, mes);
      total += r.totalCent;
    }
    await this.d.esperar(ENTRE_MENSAJES_MS);
    const ultimo = meses.at(-1) ?? 10;
    const texto =
      meses.length === 1
        ? `Listo, presentamos tu declaración de ${nombreMes(ultimo)}. Aquí está tu línea de captura por ${formatoMxn(total)}. Págala en tu banco cuando quieras, antes del ${vencimientoCorto(2026, ultimo)}.`
        : `Listo, ya estás al corriente. Te mandé ${meses.length} líneas de captura por ${formatoMxn(total)} en total, más recargos y actualización. Págalas en tu banco; la de ${nombreMes(ultimo)} vence el ${vencimientoCorto(2026, ultimo)}.`;
    await this.enviarTexto(sesion, texto);
    return { totalCent: total };
  }

  textoRecordatorio(sesion: Sesion, tipo: TipoRecordatorio): string {
    const pendiente = resumenMeses(PERSONAS[sesion.persona], this.hoy())
      .filter((m) => !m.presentado)
      .at(-1);
    if (!pendiente) return 'Estás al corriente. Te aviso cuando tu siguiente mes esté listo.';
    const total = formatoMxn(pendiente.resultado.totalCent);
    const mes = nombreMes(pendiente.mes);
    const vence = vencimientoCorto(pendiente.anio, pendiente.mes);
    return {
      dia10: `Tu mes está listo. ${mes[0]?.toUpperCase()}${mes.slice(1)} suma ${total} y vence el ${vence}. ¿Lo presentamos?`,
      dia15: `Faltan 2 días para el ${vence}. Tu declaración de ${mes} es de ${total}.`,
      dia17: `Hoy vence tu declaración de ${mes} por ${total}. Si quieres, la presento ahora y te mando la línea de captura.`,
    }[tipo];
  }

  async recordatorio(sesion: Sesion, tipo: TipoRecordatorio) {
    await this.cupo(sesion, 'mensajes');
    return this.enviarTexto(sesion, this.textoRecordatorio(sesion, tipo));
  }

  async llamar(sesion: Sesion) {
    if (!this.d.llamador.disponible) throw new Error('Las llamadas todavía no están configuradas');
    await this.cupo(sesion, 'llamadas');
    const r = await this.d.llamador.llamar(sesion.telefono, sesion.id);
    await this.d.repo.registrarLlamada(sesion.id, r.sid, 'iniciada');
    await this.d.repo.bitacora(sesion.id, 'llamada', { telefono: enmascarar(sesion.telefono) });
    return r;
  }

  /** Mensaje entrante de WhatsApp: el contador virtual responde con las herramientas del motor. */
  async responder(sesion: Sesion, texto: string, opciones: { esfuerzo?: Esfuerzo } = {}) {
    const historial: Turno[] = (await this.d.repo.historial(sesion.id, 12)).map((m) => ({
      rol: m.direccion === 'in' ? 'user' : 'assistant',
      texto: m.cuerpo,
    }));
    await this.d.repo.guardarMensaje(sesion.id, { direccion: 'in', cuerpo: texto });
    try {
      await this.cupo(sesion, 'mensajes');
    } catch {
      return this.enviarTexto(
        sesion,
        'Por hoy llegamos al límite de mensajes de la demo. Mañana seguimos.',
      );
    }
    if (!this.d.anthropic || !this.d.config.anthropic) {
      return this.enviarTexto(
        sesion,
        'El contador virtual todavía no está configurado en esta demo.',
      );
    }
    const r = await conversar({
      cliente: this.d.anthropic,
      modelo: this.d.config.anthropic.modelo,
      esfuerzo: opciones.esfuerzo ?? 'low',
      historial,
      mensaje: texto,
      ctx: {
        persona: sesion.persona,
        hoy: this.hoy(),
        acciones: {
          enviarLineaCaptura: async (mes) => {
            const x = await this.enviarLineaCaptura(sesion, mes);
            return { enviado: true, detalle: `PDF de ${nombreMes(x.mes)} enviado por WhatsApp` };
          },
          agendarLlamada: async () => {
            try {
              await this.llamar(sesion);
              return { programada: true, detalle: 'Le llamamos en unos segundos' };
            } catch (e) {
              return { programada: false, detalle: (e as Error).message };
            }
          },
        },
      },
    });
    this.d.log.info(
      { herramientas: r.herramientas, vueltas: r.vueltas, para: enmascarar(sesion.telefono) },
      'respuesta del contador',
    );
    return this.enviarTexto(sesion, r.texto);
  }
}

export function clienteAnthropic(config: Config) {
  return config.anthropic ? crearCliente(config.anthropic.apiKey) : null;
}
