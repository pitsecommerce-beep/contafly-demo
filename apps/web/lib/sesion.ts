'use client';

/** Datos de sesión del inversionista. Solo en este navegador y con try/catch. */
export interface SesionLocal {
  telefono: string;
  consentimientoAt: string;
  sesionId?: string;
}

const CLAVE = 'contafly-demo-sesion';

export function leerSesion(): SesionLocal | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v ? (JSON.parse(v) as SesionLocal) : null;
  } catch {
    return null;
  }
}

export function guardarSesion(s: SesionLocal): void {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(s));
  } catch {
    // Sin almacenamiento: la demo sigue funcionando sin recordar el teléfono.
  }
}

export function borrarSesion(): void {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // nada que borrar
  }
}

/** Normaliza a E.164 con México por defecto. Devuelve null si no es válido. */
export function aE164(entrada: string): string | null {
  const limpio = entrada.replace(/[\s()-]/g, '');
  if (/^\+[1-9]\d{7,14}$/.test(limpio)) return limpio;
  const digitos = limpio.replace(/\D/g, '');
  if (digitos.length === 10) return `+52${digitos}`;
  if (digitos.length === 12 && digitos.startsWith('52')) return `+${digitos}`;
  return null;
}

export function enmascarar(e164: string): string {
  return `${e164.slice(0, 3)} ••• ••• ${e164.slice(-4)}`;
}
