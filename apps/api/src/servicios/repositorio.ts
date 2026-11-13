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

/** Implementación con Supabase. Usa la llave de servicio, solo del lado del servidor. */
export class RepositorioSupabase implements Repositorio {
  private db: SupabaseClient;
  private personas = new Map<SlugPersona, string>();

  constructor(url: string, llaveServicio: string) {
    this.db = createClient(url, llaveServicio, { auth: { persistSession: false } });
  }

  private async personaId(slug: SlugPersona): Promise<string> {
    const c = this.personas.get(slug);
    if (c) return c;
    const { data, error } = await this.db
      .from('personas_demo')
      .select('id')
      .eq('slug', slug)
      .single();
    if (error || !data) throw new Error(`Persona ${slug} no encontrada`);
    this.personas.set(slug, data.id as string);
    return data.id as string;
  }

  private async slugDe(personaId: string | null): Promise<SlugPersona> {
    for (const [slug, id] of this.personas) if (id === personaId) return slug;
    const { data } = await this.db
      .from('personas_demo')
      .select('slug')
      .eq('id', personaId)
      .single();
    return (data?.slug as SlugPersona | undefined) ?? 'luis';
  }

  private async aSesion(row: Record<string, unknown>): Promise<Sesion> {
    return {
      id: row.id as string,
      telefono: row.telefono_e164 as string,
      persona: await this.slugDe(row.persona_id as string | null),
      consentimientoAt: row.consentimiento_at as string,
    };
  }

  async crearOActualizarSesion(telefono: string, persona: SlugPersona) {
    const personaId = await this.personaId(persona);
    const previa = await this.sesionPorTelefono(telefono);
    if (previa) {
      await this.db.from('sesiones_demo').update({ persona_id: personaId }).eq('id', previa.id);
      return { ...previa, persona };
    }
    const { data, error } = await this.db
      .from('sesiones_demo')
      .insert({
        telefono_e164: telefono,
        persona_id: personaId,
        consentimiento_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error || !data) throw new Error(`No se pudo crear la sesión: ${error?.message}`);
    return this.aSesion(data);
  }

  async sesionPorTelefono(telefono: string) {
    const { data } = await this.db
      .from('sesiones_demo')
      .select()
      .eq('telefono_e164', telefono)
      .is('borrado_at', null)
      .order('creado_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ? this.aSesion(data) : null;
  }

  async borrarSesion(telefono: string) {
    const { data } = await this.db.from('sesiones_demo').select('id').eq('telefono_e164', telefono);
    const ids = (data ?? []).map((r) => r.id as string);
    if (ids.length === 0) return;
    const { data: docs } = await this.db
      .from('documentos')
      .select('ruta_storage')
      .in('sesion_id', ids);
    const rutas = (docs ?? []).map((d) => d.ruta_storage as string);
    if (rutas.length) await this.db.storage.from('documentos').remove(rutas);
    // Las tablas hijas se borran en cascada
    await this.db.from('sesiones_demo').delete().in('id', ids);
  }

  async sesionesActivas() {
    const { data } = await this.db
      .from('sesiones_demo')
      .select()
      .is('borrado_at', null)
      .not('telefono_e164', 'is', null);
    return Promise.all((data ?? []).map((r) => this.aSesion(r)));
  }

  async guardarMensaje(sesionId: string, m: MensajeGuardado & { twilioSid?: string | null }) {
    await this.db.from('mensajes').insert({
      sesion_id: sesionId,
      direccion: m.direccion,
      cuerpo: m.cuerpo,
      twilio_sid: m.twilioSid ?? null,
    });
  }

  async historial(sesionId: string, limite: number) {
    const { data } = await this.db
      .from('mensajes')
      .select('direccion, cuerpo')
      .eq('sesion_id', sesionId)
      .order('creado_at', { ascending: false })
      .limit(limite);
    return (data ?? [])
      .reverse()
      .map((r) => ({ direccion: r.direccion as 'in' | 'out', cuerpo: (r.cuerpo as string) ?? '' }));
  }

  async guardarDocumento(sesionId: string, tipo: 'acuse' | 'linea_captura', ruta: string) {
    await this.db.from('documentos').insert({ sesion_id: sesionId, tipo, ruta_storage: ruta });
  }

  async registrarRecordatorio(sesionId: string, tipo: 'dia10' | 'dia15' | 'dia17', fecha: string) {
    const { error } = await this.db.from('recordatorios').insert({
      sesion_id: sesionId,
      tipo,
      programado_para: `${fecha}T16:00:00Z`,
      enviado_at: new Date().toISOString(),
    });
    return !error;
  }

  async registrarLlamada(sesionId: string, twilioSid: string | null, estado: string) {
    await this.db.from('llamadas').insert({ sesion_id: sesionId, twilio_sid: twilioSid, estado });
  }

  async consumirCupo(telefono: string, canal: Canal, fecha: string, maximo: number) {
    const telefonoHash = hashTelefono(telefono);
    const columna = canal === 'llamadas' ? 'llamadas' : 'mensajes';
    const { data } = await this.db
      .from('limites_uso')
      .select()
      .eq('telefono_hash', telefonoHash)
      .eq('fecha', fecha)
      .maybeSingle();
    const actual = ((data?.[columna] as number | undefined) ?? 0) + 1;
    await this.db
      .from('limites_uso')
      .upsert(
        { telefono_hash: telefonoHash, fecha, ...(data ?? {}), [columna]: actual },
        { onConflict: 'telefono_hash,fecha' },
      );
    return actual <= maximo;
  }

  async bitacora(sesionId: string | null, evento: string, detalle: Record<string, unknown> = {}) {
    await this.db.from('bitacora').insert({ sesion_id: sesionId, evento, detalle });
  }
}
