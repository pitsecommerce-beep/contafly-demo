/**
 * Fechas como texto ISO "AAAA-MM-DD" en UTC. Nunca se usa la fecha del sistema:
 * quien llama pasa "hoy" (en la demo, DEMO_FECHA).
 */

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export function nombreMes(mes: number): string {
  const n = MESES[mes - 1];
  if (!n) throw new RangeError(`Mes inválido: ${mes}`);
  return n;
}

function aFecha(iso: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new RangeError(`Fecha inválida: ${iso}`);
  const [, a, me, d] = m.map(Number) as [number, number, number, number];
  const f = new Date(Date.UTC(a, me - 1, d));
  if (f.getUTCMonth() !== me - 1 || f.getUTCDate() !== d)
    throw new RangeError(`Fecha inválida: ${iso}`);
  return f;
}

function aIso(f: Date): string {
  return f.toISOString().slice(0, 10);
}

function enesimoLunes(anio: number, mes: number, n: number): number {
  const primero = new Date(Date.UTC(anio, mes - 1, 1)).getUTCDay();
  const primerLunes = 1 + ((8 - primero) % 7);
  return primerLunes + (n - 1) * 7;
}

/** Días de descanso obligatorio (art. 74 LFT), que el art. 12 CFF considera inhábiles. */
function esFeriado(f: Date): boolean {
  const a = f.getUTCFullYear();
  const m = f.getUTCMonth() + 1;
  const d = f.getUTCDate();
  if (
    (m === 1 && d === 1) ||
    (m === 5 && d === 1) ||
    (m === 9 && d === 16) ||
    (m === 12 && d === 25)
  )
    return true;
  if (m === 2 && d === enesimoLunes(a, 2, 1)) return true;
  if (m === 3 && d === enesimoLunes(a, 3, 3)) return true;
  if (m === 11 && d === enesimoLunes(a, 11, 3)) return true;
  if (m === 10 && d === 1 && (a - 2024) % 6 === 0) return true;
  return false;
}

function esInhabil(f: Date): boolean {
  const ds = f.getUTCDay();
  return ds === 0 || ds === 6 || esFeriado(f);
}

/** El pago del mes vence el día 17 del mes siguiente; si es inhábil, el siguiente día hábil. */
export function fechaVencimiento(anio: number, mes: number, dia = 17): string {
  nombreMes(mes);
  const f = new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, dia));
  while (esInhabil(f)) f.setUTCDate(f.getUTCDate() + 1);
  return aIso(f);
}

export function diasEntre(desde: string, hasta: string): number {
  return Math.round((aFecha(hasta).getTime() - aFecha(desde).getTime()) / 86_400_000);
}

/** "martes 17 de noviembre" */
export function fechaLarga(iso: string): string {
  const f = aFecha(iso);
  return `${DIAS[f.getUTCDay()]} ${f.getUTCDate()} de ${nombreMes(f.getUTCMonth() + 1)}`;
}

export function textoVencimiento(hoy: string, vence: string): string {
  const dias = diasEntre(hoy, vence);
  const larga = fechaLarga(vence);
  if (dias < 0) return `Venció el ${larga}.`;
  if (dias === 0) return `Vence hoy, ${larga}.`;
  return `Vence el ${larga}. ${dias === 1 ? 'Falta 1 día' : `Faltan ${dias} días`}.`;
}
