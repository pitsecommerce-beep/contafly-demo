'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useNarracion } from '../lib/contexto';
import { Logo } from './ui';

export function Entrada({ children }: { children: ReactNode }) {
  useNarracion({
    paso: 'Inicio',
    titulo: 'Un contador virtual para quien cobra en apps',
    texto: [
      'Millones de personas cobran en Uber, DiDi, Rappi, Mercado Libre, Amazon o Airbnb y tienen que declarar cada mes en el Régimen de Plataformas Tecnológicas.',
      'Contafly lee lo que las apps ya reportan, calcula con reglas fiscales probadas y presenta por ti.',
      'Elige uno de los dos casos para recorrer la demo.',
    ],
  });
  return (
    <main className="pantalla">
      <div className="entrada" style={{ padding: '12px 0 20px' }}>
        <Logo ancho={190} />
        <p className="texto-mid" style={{ margin: '10px 0 0' }}>
          Accounting, reimagined.
        </p>
      </div>
      <h1 className="subtitulo" style={{ marginBottom: 10 }}>
        Elige un caso
      </h1>
      <Link
        href="/caso-a"
        className="tarjeta entrada"
        style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
      >
        <div className="fila">
          <strong>Tengo obligaciones pendientes</strong>
          <span className="chip chip-rojo">Caso A</span>
        </div>
        <p className="texto-mid" style={{ margin: '6px 0 0' }}>
          Mariana vende en Mercado Libre y Amazon y no ha presentado sus declaraciones.
        </p>
      </Link>
      <Link
        href="/caso-b"
        className="tarjeta entrada"
        style={{
          display: 'block',
          textDecoration: 'none',
          color: 'inherit',
          animationDelay: '60ms',
        }}
      >
        <div className="fila">
          <strong>Ya estoy inscrito, ¿cuánto pago este mes?</strong>
          <span className="chip chip-verde">Caso B</span>
        </div>
        <p className="texto-mid" style={{ margin: '6px 0 0' }}>
          Luis maneja en Uber y DiDi y quiere saber cuánto paga en octubre.
        </p>
      </Link>
      <div style={{ marginTop: 20 }}>{children}</div>
    </main>
  );
}
