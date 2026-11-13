'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useChat } from '../lib/chat';
import { Logo } from './ui';

interface Linea {
  de: 'contador' | 'yo';
  texto: string;
}

// Tipos mínimos del reconocimiento de voz del navegador (no está en lib.dom de TypeScript)
interface ResultadoVoz {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}
interface Reconocedor {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ResultadoVoz) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type ConstructorReconocedor = new () => Reconocedor;

function reconocedorDisponible(): ConstructorReconocedor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstructorReconocedor;
    webkitSpeechRecognition?: ConstructorReconocedor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Elige una voz en español de México si existe, si no cualquier voz en español. */
function vozEspanol(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voces = window.speechSynthesis.getVoices();
  return (
    voces.find((v) => v.lang === 'es-MX') ??
    voces.find((v) => v.lang.startsWith('es-US')) ??
    voces.find((v) => v.lang.startsWith('es')) ??
    null
  );
}

/** Llamada simulada: la voz la pone el navegador y las respuestas salen del mismo contador virtual. */
export function Llamada() {
  const { llamada, setLlamada, persona, recibir, anotarLlamada } = useChat();
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [hablando, setHablando] = useState(false);
  const [escuchando, setEscuchando] = useState(false);
  const [pensando, setPensando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [texto, setTexto] = useState('');
  const reconocedor = useRef<Reconocedor | null>(null);
  const lineasRef = useRef<Linea[]>([]);
  lineasRef.current = lineas;
  const puedeEscuchar = reconocedorDisponible() !== null;

  useEffect(() => {
    if (llamada !== 'activa') return;
    const t = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [llamada]);

  // Al desmontar, que no se quede hablando
  useEffect(
    () => () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window)
        window.speechSynthesis.cancel();
      reconocedor.current?.stop();
    },
    [],
  );

  const decir = useCallback((voz: string) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window) || !voz) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(voz);
    u.lang = 'es-MX';
    const v = vozEspanol();
    if (v) u.voice = v;
    u.rate = 1.05;
    u.onstart = () => setHablando(true);
    u.onend = () => setHablando(false);
    u.onerror = () => setHablando(false);
    window.speechSynthesis.speak(u);
  }, []);

  const preguntar = useCallback(
    async (pregunta: string) => {
      const p = pregunta.trim();
      if (!p) return;
      // Interrumpir al contador si estaba hablando (barge-in)
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      const historial = lineasRef.current.map((l) => ({
        rol: l.de === 'yo' ? 'user' : 'assistant',
        texto: l.texto,
      }));
      setLineas((ls) => [...ls, { de: 'yo', texto: p }]);
      setPensando(true);
      try {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ persona, mensaje: p, historial, canal: 'voz' }),
        });
        const d = (await r.json()) as {
          texto: string;
          voz: string;
          efectos: Array<{ tipo: string; mes?: number }>;
        };
        setLineas((ls) => [...ls, { de: 'contador', texto: d.texto }]);
        decir(d.voz);
        const pdfs = d.efectos
          .filter((e) => e.tipo === 'pdf' && e.mes)
          .map((e) => ({ tipo: 'pdf' as const, mes: e.mes as number }));
        if (pdfs.length) void recibir(pdfs);
      } finally {
        setPensando(false);
      }
    },
    [persona, decir, recibir],
  );

  async function contestar() {
    setLlamada('activa');
    setSegundos(0);
    setPensando(true);
    try {
      const r = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ persona, inicioLlamada: true }),
      });
      const d = (await r.json()) as { texto: string; voz: string };
      setLineas([{ de: 'contador', texto: d.texto }]);
      decir(d.voz);
    } finally {
      setPensando(false);
    }
  }

  function escuchar() {
    const C = reconocedorDisponible();
    if (!C) return;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    const r = new C();
    r.lang = 'es-MX';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => {
      const t = e.results[0]?.[0]?.transcript ?? '';
      void preguntar(t);
    };
    r.onend = () => setEscuchando(false);
    r.onerror = () => setEscuchando(false);
    reconocedor.current = r;
    setEscuchando(true);
    r.start();
  }

  function colgar() {
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    reconocedor.current?.stop();
    const fueContestada = llamada === 'activa';
    setLlamada('ninguna');
    if (fueContestada) anotarLlamada(segundos);
  }

  const reloj = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;
  const estado = escuchando
    ? 'Te escucho…'
    : pensando
      ? 'Pensando…'
      : hablando
        ? 'Hablando…'
        : 'En llamada';

  return (
    <div className="llamada" role="dialog" aria-modal="true" aria-label="Llamada de tu contador">
      <div className="llamada-arriba">
        <span className="llamada-avatar">
          <Logo tipo="icono" ancho={84} />
        </span>
        <strong className="llamada-nombre">Contafly, tu contador</strong>
        <span className="llamada-estado" aria-live="polite">
          {llamada === 'entrante' ? 'Llamada entrante (simulada)' : `${estado} ${reloj}`}
        </span>
      </div>

      {llamada === 'activa' && (
        <div className="llamada-transcripcion" aria-live="polite">
          {lineas.map((l, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: la transcripción solo crece
            <p key={i} className={l.de === 'yo' ? 'llamada-yo' : 'llamada-contador'}>
              {l.texto}
            </p>
          ))}
        </div>
      )}

      {llamada === 'entrante' ? (
        <div className="llamada-botones">
          <button
            type="button"
            className="llamada-boton llamada-colgar"
            onClick={colgar}
            aria-label="Rechazar"
          >
            ✕
          </button>
          <button
            type="button"
            className="llamada-boton llamada-contestar"
            onClick={() => void contestar()}
            aria-label="Contestar"
            // biome-ignore lint/a11y/noAutofocus: la llamada entrante debe recibir el foco
            autoFocus
          >
            ✆
          </button>
        </div>
      ) : (
        <div className="llamada-controles">
          {puedeEscuchar ? (
            <button
              type="button"
              className="boton"
              onClick={escuchar}
              disabled={escuchando || pensando}
            >
              {escuchando ? 'Te escucho…' : 'Hablar'}
            </button>
          ) : null}
          <form
            className="llamada-texto"
            onSubmit={(e) => {
              e.preventDefault();
              const t = texto;
              setTexto('');
              void preguntar(t);
            }}
          >
            <input
              aria-label="Escribe tu pregunta"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              placeholder={puedeEscuchar ? 'O escribe tu pregunta' : 'Escribe tu pregunta'}
              autoComplete="off"
              maxLength={300}
            />
          </form>
          <button
            type="button"
            className="llamada-boton llamada-colgar"
            onClick={colgar}
            aria-label="Colgar"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
