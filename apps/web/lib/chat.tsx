'use client';

import { formatoMxn, nombreMes } from '@contafly/motor-fiscal';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export type Persona = 'luis' | 'mariana';

export interface Mensaje {
  id: number;
  de: 'contador' | 'yo';
  tipo: 'texto' | 'pdf' | 'llamada';
  texto: string;
  url?: string;
  hora: string;
}

export type EstadoLlamada = 'ninguna' | 'entrante' | 'activa';

interface Efecto {
  tipo: 'pdf' | 'llamada';
  mes?: number;
  url?: string;
}

interface ContextoChat {
  persona: Persona;
  setPersona: (p: Persona) => void;
  mensajes: Mensaje[];
  escribiendo: boolean;
  noLeidos: number;
  abierto: boolean;
  setAbierto: (v: boolean) => void;
  llamada: EstadoLlamada;
  setLlamada: (e: EstadoLlamada) => void;
  enviar: (texto: string) => Promise<void>;
  /** Mensajes que manda el contador por su cuenta (presentar, recordatorios) */
  recibir: (
    items: Array<{ tipo: 'texto'; texto: string } | { tipo: 'pdf'; mes: number }>,
  ) => Promise<void>;
  llamar: () => void;
  /** Deja constancia de la llamada en el chat al colgar */
  anotarLlamada: (segundos: number) => void;
}

const Ctx = createContext<ContextoChat | null>(null);

const hora = () =>
  new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false });
const pausa = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BIENVENIDA: Record<Persona, string> = {
  luis: 'Hola, Luis. Soy tu contador virtual de Contafly. Pregúntame lo que quieras de tu mes, por ejemplo: ¿cuánto pago este mes?',
  mariana:
    'Hola, Mariana. Soy tu contador virtual de Contafly. Revisé tu situación y te ayudo a ponerte al corriente. Pregúntame lo que quieras.',
};

let siguienteId = 1;
const nuevo = (m: Omit<Mensaje, 'id' | 'hora'>): Mensaje => ({
  ...m,
  id: siguienteId++,
  hora: hora(),
});

export function ProveedorChat({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>('luis');
  const [porPersona, setPorPersona] = useState<Record<Persona, Mensaje[]>>({
    luis: [],
    mariana: [],
  });
  const [escribiendo, setEscribiendo] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const [abierto, setAbiertoEstado] = useState(false);
  const [llamada, setLlamada] = useState<EstadoLlamada>('ninguna');
  const personaRef = useRef(persona);
  personaRef.current = persona;
  const abiertoRef = useRef(abierto);
  abiertoRef.current = abierto;
  const mensajesRef = useRef(porPersona);
  mensajesRef.current = porPersona;

  // Mensaje de bienvenida la primera vez que aparece cada persona
  useEffect(() => {
    setPorPersona((prev) =>
      prev[persona].length
        ? prev
        : {
            ...prev,
            [persona]: [nuevo({ de: 'contador', tipo: 'texto', texto: BIENVENIDA[persona] })],
          },
    );
  }, [persona]);

  const agregar = useCallback((p: Persona, m: Mensaje) => {
    setPorPersona((prev) => ({ ...prev, [p]: [...prev[p], m] }));
    if (m.de === 'contador' && !abiertoRef.current) setNoLeidos((n) => n + 1);
  }, []);

  const setAbierto = useCallback((v: boolean) => {
    setAbiertoEstado(v);
    if (v) setNoLeidos(0);
  }, []);

  const aplicarEfectos = useCallback(
    async (p: Persona, efectos: Efecto[]) => {
      for (const e of efectos) {
        if (e.tipo === 'pdf' && e.mes) {
          agregar(
            p,
            nuevo({
              de: 'contador',
              tipo: 'pdf',
              texto: `Línea de captura de ${nombreMes(e.mes)} (demostración)`,
              url: e.url ?? '',
            }),
          );
        }
        if (e.tipo === 'llamada') {
          await pausa(1200);
          setLlamada('entrante');
        }
      }
    },
    [agregar],
  );

  const enviar = useCallback(
    async (texto: string) => {
      const p = personaRef.current;
      const t = texto.trim();
      if (!t) return;
      const historial = mensajesRef.current[p]
        .filter((m) => m.tipo === 'texto')
        .map((m) => ({ rol: m.de === 'yo' ? 'user' : 'assistant', texto: m.texto }));
      agregar(p, nuevo({ de: 'yo', tipo: 'texto', texto: t }));
      setEscribiendo(true);
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ persona: p, mensaje: t, historial }),
        });
        const datos = (await r.json()) as { texto: string; efectos: Efecto[] };
        const conPdf = datos.efectos.some((e) => e.tipo === 'pdf');
        if (conPdf)
          await aplicarEfectos(
            p,
            datos.efectos.filter((e) => e.tipo === 'pdf'),
          );
        if (datos.texto) agregar(p, nuevo({ de: 'contador', tipo: 'texto', texto: datos.texto }));
        setEscribiendo(false);
        await aplicarEfectos(
          p,
          datos.efectos.filter((e) => e.tipo === 'llamada'),
        );
      } catch {
        agregar(
          p,
          nuevo({
            de: 'contador',
            tipo: 'texto',
            texto: 'Perdón, no me llegó tu mensaje. ¿Me lo repites?',
          }),
        );
      } finally {
        setEscribiendo(false);
      }
    },
    [agregar, aplicarEfectos],
  );

  const recibir = useCallback(
    async (items: Array<{ tipo: 'texto'; texto: string } | { tipo: 'pdf'; mes: number }>) => {
      const p = personaRef.current;
      setEscribiendo(true);
      await pausa(1300);
      for (const [i, it] of items.entries()) {
        if (i > 0) await pausa(700);
        if (it.tipo === 'pdf') {
          agregar(
            p,
            nuevo({
              de: 'contador',
              tipo: 'pdf',
              texto: `Línea de captura de ${nombreMes(it.mes)} (demostración)`,
              url: `/api/acuse?persona=${p}&mes=${it.mes}`,
            }),
          );
        } else {
          agregar(p, nuevo({ de: 'contador', tipo: 'texto', texto: it.texto }));
        }
      }
      setEscribiendo(false);
    },
    [agregar],
  );

  const anotarLlamada = useCallback(
    (segundos: number) => {
      const p = personaRef.current;
      const dur = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
      agregar(p, nuevo({ de: 'contador', tipo: 'llamada', texto: `Llamada de voz, ${dur}` }));
      agregar(
        p,
        nuevo({
          de: 'contador',
          tipo: 'texto',
          texto:
            'Gracias por tomar la llamada. Si quieres tu línea de captura, escríbeme "mándamela" y te la dejo aquí.',
        }),
      );
    },
    [agregar],
  );

  const llamar = useCallback(() => {
    setAbierto(true);
    setLlamada('entrante');
  }, [setAbierto]);

  const valor = useMemo(
    () => ({
      persona,
      setPersona,
      mensajes: porPersona[persona],
      escribiendo,
      noLeidos,
      abierto,
      setAbierto,
      llamada,
      setLlamada,
      enviar,
      recibir,
      llamar,
      anotarLlamada,
    }),
    [
      persona,
      porPersona,
      escribiendo,
      noLeidos,
      abierto,
      setAbierto,
      llamada,
      enviar,
      recibir,
      llamar,
      anotarLlamada,
    ],
  );
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>;
}

export function useChat(): ContextoChat {
  const c = useContext(Ctx);
  if (!c) throw new Error('useChat fuera de ProveedorChat');
  return c;
}

/** Cambia la persona del chat al entrar a un caso. */
export function usePersonaChat(p: Persona) {
  const { setPersona } = useChat();
  useEffect(() => setPersona(p), [p, setPersona]);
}

export function textoPresentada(mes: number, totalCent: number, vence: string) {
  return `Listo, presentamos tu declaración de ${nombreMes(mes)}. Aquí está tu línea de captura por ${formatoMxn(totalCent)}. Págala en tu banco cuando quieras, antes del ${vence}.`;
}
