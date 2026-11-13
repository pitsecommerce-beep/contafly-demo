'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useChat } from '../lib/chat';
import { useDemo } from '../lib/contexto';
import { WhatsAppSimulado } from './WhatsAppSimulado';

function useEscritorio(): boolean {
  const [es, setEs] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const f = () => setEs(mq.matches);
    f();
    mq.addEventListener('change', f);
    return () => mq.removeEventListener('change', f);
  }, []);
  return es;
}

function Narracion() {
  const { narracion } = useDemo();
  return (
    <div className="panel-tarjeta entrada" key={narracion.titulo}>
      <div className="panel-paso">{narracion.paso}</div>
      <h2>{narracion.titulo}</h2>
      {narracion.texto.map((t) => (
        <p key={t}>{t}</p>
      ))}
    </div>
  );
}

/**
 * En móvil la app ocupa la pantalla; en computadora va dentro de un teléfono.
 * Sin Twilio, a la derecha aparece el WhatsApp simulado (en móvil, con un botón flotante).
 */
export function Marco({ children }: { children: ReactNode }) {
  const { whatsappReal } = useDemo();
  const { abierto, setAbierto, noLeidos } = useChat();
  const escritorio = useEscritorio();
  const simulado = !whatsappReal;

  return (
    <div className={`escenario${simulado ? ' con-wa' : ''}`}>
      <div className="telefono">{children}</div>
      <aside className="panel" aria-label="Qué está pasando">
        <Narracion />
      </aside>
      {simulado && escritorio && (
        <aside className="lateral" aria-label="Qué está pasando y WhatsApp">
          <Narracion />
          <div className="ventana-wa">
            <div className="ventana-barra" aria-hidden>
              <i />
              <i />
              <i />
              <span style={{ marginLeft: 6 }}>WhatsApp en tu computadora (simulado)</span>
            </div>
            <WhatsAppSimulado />
          </div>
        </aside>
      )}
      {simulado && !escritorio && !abierto && (
        <button
          type="button"
          className="flotante-wa"
          onClick={() => setAbierto(true)}
          aria-label={`Abrir WhatsApp${noLeidos ? `, ${noLeidos} mensajes nuevos` : ''}`}
        >
          Chat
          {noLeidos > 0 && <span className="insignia">{noLeidos}</span>}
        </button>
      )}
      {simulado && !escritorio && abierto && (
        <div className="pantalla-wa">
          <WhatsAppSimulado onCerrar={() => setAbierto(false)} />
        </div>
      )}
    </div>
  );
}
