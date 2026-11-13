'use client';

import { logoCompleto, logoIcono, logoSimbolo } from '@contafly/ui';
import { type ReactNode, useEffect, useRef } from 'react';

export function Logo({
  tipo = 'completo',
  ancho = 160,
}: {
  tipo?: 'completo' | 'simbolo' | 'icono';
  ancho?: number;
}) {
  const svg = tipo === 'completo' ? logoCompleto : tipo === 'simbolo' ? logoSimbolo : logoIcono;
  return (
    <span
      className="logo"
      role="img"
      aria-label="Contafly"
      style={{ width: ancho }}
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG propio del paquete ui
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

export type Tono = 'verde' | 'ambar' | 'rojo';

export function Chip({ tono, children }: { tono: Tono; children: ReactNode }) {
  return <span className={`chip chip-${tono}`}>{children}</span>;
}

export function Renglon({
  etiqueta,
  valor,
  total = false,
}: {
  etiqueta: ReactNode;
  valor: ReactNode;
  total?: boolean;
}) {
  return (
    <div className={`renglon${total ? ' renglon-total' : ''}`}>
      <span>{etiqueta}</span>
      <span className="num">{valor}</span>
    </div>
  );
}

export function Barra({ valor }: { valor: number }) {
  return (
    <div
      className="barra"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(valor)}
    >
      <div style={{ width: `${Math.min(100, Math.max(0, valor))}%` }} />
    </div>
  );
}

export function Hoja({
  titulo,
  children,
  onCerrar,
}: {
  titulo: string;
  children: ReactNode;
  onCerrar?: () => void;
}) {
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current?.();
    };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, []);
  return (
    <div className="velo">
      {onCerrar && (
        <button
          type="button"
          className="velo-fondo"
          aria-hidden="true"
          tabIndex={-1}
          onClick={onCerrar}
        />
      )}
      <div className="hoja" role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="fila" style={{ marginBottom: 12 }}>
          <h2 className="subtitulo">{titulo}</h2>
          {onCerrar && (
            <button type="button" className="boton-link" onClick={onCerrar}>
              Cerrar
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Notificacion({
  titulo,
  texto,
  onCerrar,
}: {
  titulo: string;
  texto: string;
  onCerrar: () => void;
}) {
  return (
    <output className="notificacion" aria-live="polite">
      <span className="notificacion-icono">
        <Logo tipo="icono" ancho={36} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="fila">
          <strong style={{ fontSize: 14 }}>{titulo}</strong>
          <span className="texto-low">ahora</span>
        </div>
        <div style={{ fontSize: 14 }}>{texto}</div>
      </div>
      <button
        type="button"
        className="boton-link"
        onClick={onCerrar}
        aria-label="Cerrar notificación"
        style={{ padding: 4 }}
      >
        ✕
      </button>
    </output>
  );
}

export function Encabezado({ onAtras, children }: { onAtras?: () => void; children?: ReactNode }) {
  return (
    <div className="encabezado">
      {onAtras && (
        <button type="button" className="boton-link" onClick={onAtras}>
          ‹ Atrás
        </button>
      )}
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
