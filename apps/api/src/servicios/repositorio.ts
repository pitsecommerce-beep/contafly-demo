import { randomUUID } from 'node:crypto';
import type { SlugPersona } from '@contafly/datos-demo';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { hashTelefono } from '../privacidad.js';

export interface Sesion {
  id: string;
  telefono: string;
  persona: SlugPersona;
  consentimientoAt: string;
}

export type Canal = 'mensajes' | 'llamadas' | 'documentos';

export interface MensajeGuardado {
  direccion: 'in' | 'out';
  cuerpo: string;
}

/** Persistencia de la demo. Hay versión en memoria (pruebas y sin Supabase) y en Supabase. */
export interface Repositorio {
  crearOActualizarSesion(telefono: string, persona: SlugPersona): Promise<Sesion>;
  sesionPorTelefono(telefono: string): Promise<Sesion | null>;
  borrarSesion(telefono: string): Promise<void>;
  sesionesActivas(): Promise<Sesion[]>;
  guardarMensaje(
    sesionId: string,
    m: MensajeGuardado & { twilioSid?: string | null },
  ): Promise<void>;
  historial(sesionId: string, limite: number): Promise<MensajeGuardado[]>;
  guardarDocumento(sesionId: string, tipo: 'acuse' | 'linea_captura', ruta: string): Promise<void>;
  /** Devuelve false si ya se había registrado (no se envía dos veces). */
  registrarRecordatorio(
    sesionId: string,
    tipo: 'dia10' | 'dia15' | 'dia17',
    fecha: string,
  ): Promise<boolean>;
  registrarLlamada(sesionId: string, twilioSid: string | null, estado: string): Promise<void>;
  /** Suma uno al contador del día y dice si sigue dentro del límite. */
  consumirCupo(telefono: string, canal: Canal, fecha: string, maximo: number): Promise<boolean>;
  bitacora(
    sesionId: string | null,
    evento: string,
    detalle?: Record<string, unknown>,
  ): Promise<void>;
}

export class RepositorioMemoria implements Repositorio {
  sesiones = new Map<string, Sesion>();
  mensajes = new Map<string, MensajeGuardado[]>();
  documentos: Array<{ sesionId: string; tipo: string; ruta: string }> = [];
  recordatorios = new Set<string>();
  llamadas: Array<{ sesionId: string; twilioSid: string | null; estado: string }> = [];
  cupos = new Map<string, number>();
  eventos: Array<{ sesionId: string | null; evento: string; detalle: Record<string, unknown> }> =
    [];

  async crearOActualizarSesion(telefono: string, persona: SlugPersona): Promise<Sesion> {
    const previa = this.sesiones.get(telefono);
    const s = previa
      ? { ...previa, persona }
      : { id: randomUUID(), telefono, persona, consentimientoAt: new Date().toISOString() };
    this.sesiones.set(telefono, s);
    return s;
  }
  async sesionPorTelefono(telefono: string) {
    return this.sesiones.get(telefono) ?? null;
  }
  async borrarSesion(telefono: string) {
    const s = this.sesiones.get(telefono);
    if (!s) return;
    this.sesiones.delete(telefono);
    this.mensajes.delete(s.id);
    this.documentos = this.documentos.filter((d) => d.sesionId !== s.id);
    this.llamadas = this.llamadas.filter((l) => l.sesionId !== s.id);
  }
  async sesionesActivas() {
    return [...this.sesiones.values()];
  }
  async guardarMensaje(sesionId: string, m: MensajeGuardado) {
    const lista = this.mensajes.get(sesionId) ?? [];
    lista.push({ direccion: m.direccion, cuerpo: m.cuerpo });
    this.mensajes.set(sesionId, lista);
  }
  async historial(sesionId: string, limite: number) {
    return (this.mensajes.get(sesionId) ?? []).slice(-limite);
  }
  async guardarDocumento(sesionId: string, tipo: 'acuse' | 'linea_captura', ruta: string) {
    this.documentos.push({ sesionId, tipo, ruta });
  }
  async registrarRecordatorio(sesionId: string, tipo: string, fecha: string) {
    const k = `${sesionId}|${tipo}|${fecha}`;
    if (this.recordatorios.has(k)) return false;
    this.recordatorios.add(k);
    return true;
  }
  async registrarLlamada(sesionId: string, twilioSid: string | null, estado: string) {
    this.llamadas.push({ sesionId, twilioSid, estado });
  }
  async consumirCupo(telefono: string, canal: Canal, fecha: string, maximo: number) {
    const k = `${hashTelefono(telefono)}|${canal}|${fecha}`;
    const n = (this.cupos.get(k) ?? 0) + 1;
    this.cupos.set(k, n);
    return n <= maximo;
  }
  async bitacora(sesionId: string | null, evento: string, detalle: Record<string, unknown> = {}) {
    this.eventos.push({ sesionId, evento, detalle });
  }
}

/**
 * Supabase con la llave anon. Escribe por funciones RPC (ver la migración de funciones anon)
 * y nunca lee conversaciones de la base: el historial reciente y la lista de sesiones
 * viven en memoria del proceso.
 */
export class RepositorioSupabaseAnon implements Repositorio {
  private db: SupabaseClient;
  private cache = new RepositorioMemoria();

  constructor(url: string, llaveAnon: string) {
    this.db = createClient(url, llaveAnon, { auth: { persistSession: false } });
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.db.rpc(fn, args);
    if (error) throw new Error(`Supabase ${fn}: ${error.message}`);
    return data as T;
  }

  async crearOActualizarSesion(telefono: string, persona: SlugPersona): Promise<Sesion> {
    const id = await this.rpc<string>('demo_conectar', {
      p_telefono: telefono,
      p_persona: persona,
    });
    const s: Sesion = { id, telefono, persona, consentimientoAt: new Date().toISOString() };
    this.cache.sesiones.set(telefono, s);
    return s;
  }

  async sesionPorTelefono(telefono: string) {
    const enCache = await this.cache.sesionPorTelefono(telefono);
    if (enCache) return enCache;
    const filas = await this.rpc<Array<{ id: string; persona: SlugPersona }>>('demo_sesion', {
      p_telefono: telefono,
    });
    const f = filas?.[0];
    if (!f) return null;
    const s: Sesion = { id: f.id, telefono, persona: f.persona, consentimientoAt: '' };
    this.cache.sesiones.set(telefono, s);
    return s;
  }

  async borrarSesion(telefono: string) {
    const s = await this.sesionPorTelefono(telefono);
    if (s) await this.rpc('demo_borrar', { p_sesion: s.id });
    await this.cache.borrarSesion(telefono);
  }

  async sesionesActivas() {
    return this.cache.sesionesActivas();
  }

  async guardarMensaje(sesionId: string, m: MensajeGuardado & { twilioSid?: string | null }) {
    await this.cache.guardarMensaje(sesionId, m);
    await this.rpc('demo_guardar_mensaje', {
      p_sesion: sesionId,
      p_direccion: m.direccion,
      p_cuerpo: m.cuerpo,
      p_sid: m.twilioSid ?? null,
    });
  }

  async historial(sesionId: string, limite: number) {
    return this.cache.historial(sesionId, limite);
  }

  async guardarDocumento(sesionId: string, tipo: 'acuse' | 'linea_captura', ruta: string) {
    await this.rpc('demo_guardar_documento', { p_sesion: sesionId, p_tipo: tipo, p_ruta: ruta });
  }

  async registrarRecordatorio(sesionId: string, tipo: 'dia10' | 'dia15' | 'dia17', fecha: string) {
    return this.rpc<boolean>('demo_registrar_recordatorio', {
      p_sesion: sesionId,
      p_tipo: tipo,
      p_fecha: fecha,
    });
  }

  async registrarLlamada(sesionId: string, twilioSid: string | null, estado: string) {
    await this.rpc('demo_registrar_llamada', {
      p_sesion: sesionId,
      p_sid: twilioSid,
      p_estado: estado,
    });
  }

  async consumirCupo(telefono: string, canal: Canal, fecha: string, maximo: number) {
    return this.rpc<boolean>('demo_consumir_cupo', {
      p_hash: hashTelefono(telefono),
      p_canal: canal,
      p_fecha: fecha,
      p_maximo: maximo,
    });
  }

  async bitacora(sesionId: string | null, evento: string, detalle: Record<string, unknown> = {}) {
    await this.rpc('demo_bitacora', { p_sesion: sesionId, p_evento: evento, p_detalle: detalle });
  }
}
