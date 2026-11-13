'use client';

import { createContext, type ReactNode, useContext, useEffect, useState } from 'react';

export interface Narracion {
  paso: string;
  titulo: string;
  texto: string[];
}

interface ContextoDemo {
  hoy: string;
  narracion: Narracion;
  narrar: (n: Narracion) => void;
}

const Ctx = createContext<ContextoDemo | null>(null);

export function ProveedorDemo({ hoy, children }: { hoy: string; children: ReactNode }) {
  const [narracion, narrar] = useState<Narracion>({
    paso: 'Inicio',
    titulo: 'Contafly',
    texto: ['Elige un caso para empezar.'],
  });
  return <Ctx.Provider value={{ hoy, narracion, narrar }}>{children}</Ctx.Provider>;
}

export function useDemo(): ContextoDemo {
  const c = useContext(Ctx);
  if (!c) throw new Error('useDemo fuera de ProveedorDemo');
  return c;
}

/** Actualiza el panel lateral del modo presentación cuando cambia el paso. */
export function useNarracion(n: Narracion) {
  const { narrar } = useDemo();
  const clave = `${n.paso}|${n.titulo}|${n.texto.join('|')}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: la clave resume la narración
  useEffect(() => {
    narrar(n);
  }, [clave]);
}
