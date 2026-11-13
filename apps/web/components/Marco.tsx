'use client';

import type { ReactNode } from 'react';
import { useDemo } from '../lib/contexto';

/** En móvil muestra la app a pantalla completa; en computadora, dentro de un teléfono con panel lateral. */
export function Marco({ children }: { children: ReactNode }) {
  const { narracion } = useDemo();
  return (
    <div className="escenario">
      <div className="telefono">{children}</div>
      <aside className="panel" aria-label="Qué está pasando">
        <div className="panel-tarjeta entrada" key={narracion.titulo}>
          <div className="panel-paso">{narracion.paso}</div>
          <h2>{narracion.titulo}</h2>
          {narracion.texto.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </div>
      </aside>
    </div>
  );
}
