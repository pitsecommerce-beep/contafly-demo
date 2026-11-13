'use client';

import { useEffect, useRef, useState } from 'react';
import { useChat } from '../lib/chat';
import { Llamada } from './Llamada';
import { Logo } from './ui';

const SUGERENCIAS = [
  '¿Cuánto pago este mes?',
  '¿Por qué me retienen?',
  'Mándame mi línea de captura',
  'Márcame',
];

/** Ventana de chat tipo WhatsApp para cuando no hay Twilio: la conversación ocurre dentro de la web. */
export function WhatsAppSimulado({ onCerrar }: { onCerrar?: () => void }) {
  const { mensajes, escribiendo, enviar, llamada, llamar } = useChat();
  const [texto, setTexto] = useState('');
  const lista = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: desplazar al recibir mensajes
  useEffect(() => {
    lista.current?.scrollTo({ top: lista.current.scrollHeight, behavior: 'smooth' });
  }, [mensajes.length, escribiendo]);

  const mandar = (t: string) => {
    setTexto('');
    void enviar(t);
  };

  return (
    <section className="wa" aria-label="WhatsApp de la demostración">
      <header className="wa-cabecera">
        {onCerrar && (
          <button
            type="button"
            className="wa-icono-boton"
            onClick={onCerrar}
            aria-label="Cerrar WhatsApp"
          >
            ‹
          </button>
        )}
        <span className="wa-avatar">
          <Logo tipo="icono" ancho={38} />
        </span>
        <div className="wa-contacto">
          <strong>Contafly</strong>
          <span>{escribiendo ? 'escribiendo…' : 'contador virtual, en línea'}</span>
        </div>
        <button
          type="button"
          className="wa-icono-boton"
          onClick={llamar}
          aria-label="Llamar a tu contador"
        >
          ✆
        </button>
      </header>
      <div className="wa-aviso">
        WhatsApp simulado de la demostración. Nada sale de esta pantalla.
      </div>
      <div className="wa-mensajes" ref={lista} aria-live="polite">
        {mensajes.map((m) => (
          <div key={m.id} className={`wa-burbuja ${m.de === 'yo' ? 'wa-mia' : 'wa-suya'} entrada`}>
            {m.tipo === 'pdf' ? (
              <a className="wa-pdf" href={m.url} target="_blank" rel="noreferrer">
                <span className="wa-pdf-icono" aria-hidden>
                  PDF
                </span>
                <span>
                  <strong>{m.texto}</strong>
                  <span className="wa-meta-pdf">Toca para abrir</span>
                </span>
              </a>
            ) : m.tipo === 'llamada' ? (
              <span className="wa-llamada-registro">✆ {m.texto}</span>
            ) : (
              <span style={{ whiteSpace: 'pre-wrap' }}>{m.texto}</span>
            )}
            <span className="wa-hora">{m.hora}</span>
          </div>
        ))}
        {escribiendo && (
          <output
            className="wa-burbuja wa-suya wa-escribiendo"
            aria-label="Contafly está escribiendo"
          >
            <span />
            <span />
            <span />
          </output>
        )}
      </div>
      <div className="wa-sugerencias">
        {SUGERENCIAS.map((s) => (
          <button
            key={s}
            type="button"
            className="wa-chip"
            onClick={() => mandar(s)}
            disabled={escribiendo}
          >
            {s}
          </button>
        ))}
      </div>
      <form
        className="wa-entrada"
        onSubmit={(e) => {
          e.preventDefault();
          if (texto.trim()) mandar(texto);
        }}
      >
        <input
          aria-label="Escribe un mensaje"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe un mensaje"
          autoComplete="off"
          maxLength={500}
        />
        <button type="submit" className="wa-enviar" aria-label="Enviar" disabled={!texto.trim()}>
          ➤
        </button>
      </form>
      {llamada !== 'ninguna' && <Llamada />}
    </section>
  );
}
