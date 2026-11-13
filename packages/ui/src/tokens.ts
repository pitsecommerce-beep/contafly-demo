export const temaClaro = {
  bg: '#EAE6E0',
  surf: '#FFFFFF',
  txtHi: '#191614',
  txtMid: '#5A544D',
  txtLow: '#665F59',
  brand: '#3A63AE',
  accion: '#1A1613',
  verde: '#26694A',
  ambar: '#7C5A13',
  rojo: '#9A443A',
} as const;

export const temaOscuro = {
  bg: '#121110',
  surf: '#1D1B19',
  txtHi: '#F5F2ED',
  txtMid: '#ABA59E',
  // El brief no define txt-low oscuro; usamos un gris que mantiene contraste AA sobre --surf.
  txtLow: '#9A948D',
  brand: '#5B84D4',
  accion: '#F2EDE4',
  verde: '#8FD3AF',
  ambar: '#E5C078',
  rojo: '#E39A8E',
} as const;

export const radio = 18;

export const fuenteSistema =
  "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, system-ui, sans-serif";

export type EstadoChip = 'verde' | 'ambar' | 'rojo';
