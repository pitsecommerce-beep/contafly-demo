import {
  aplicarTasa,
  type Centavos,
  centavos as c,
  type Gasto,
  type Ingreso,
  type PeriodoEntrada,
} from '@contafly/motor-fiscal';

export type SlugPersona = 'mariana' | 'luis';

export interface PersonaDemo {
  slug: SlugPersona;
  nombre: string;
  nombreCompleto: string;
  /** RFC evidentemente ficticio */
  rfc: string;
  ocupacion: string;
  apps: Ingreso['app'][];
  altaRegimen: string;
  opcionPagoDefinitivo: boolean;
  buzonHabilitado: boolean;
  ingresosAnioAnteriorCent: Centavos;
  /** Meses del año en curso ya presentados */
  mesesPresentados: number[];
  periodos: PeriodoEntrada[];
}

const ML = 'mercado_libre' as const;

/** Ingreso con retenciones con RFC: ISR a la tasa dada y IVA al 8%. */
function ingreso(
  app: Ingreso['app'],
  giro: Ingreso['giro'],
  pesos: string,
  tasaIsrBp: number,
): Ingreso {
  const subtotalCent = c(pesos);
  return {
    app,
    giro,
    subtotalCent,
    isrRetenidoCent: aplicarTasa(subtotalCent, tasaIsrBp),
    ivaRetenidoCent: aplicarTasa(subtotalCent, 800),
    conRfc: true,
    tasaIsrLeidaBp: tasaIsrBp,
    tasaIvaLeidaBp: 800,
  };
}

function gasto(concepto: string, pesos: string): Gasto {
  const subtotalCent = c(pesos);
  return { concepto, subtotalCent, ivaCent: aplicarTasa(subtotalCent, 1600) };
}

const vacio = (mes: number): PeriodoEntrada => ({ anio: 2026, mes, ingresos: [], gastos: [] });

/** Caso B: Luis, conductor de Uber y DiDi. Todos los meses de 2026 iguales a octubre. */
const mesLuis = (mes: number): PeriodoEntrada => ({
  anio: 2026,
  mes,
  ingresos: [
    ingreso('uber', 'transporte', '19000', 210),
    ingreso('didi', 'transporte', '13000', 210),
  ],
  gastos: [gasto('Gasolina', '9000'), gasto('Mantenimiento', '2000'), gasto('Celular', '500')],
});

export const LUIS: PersonaDemo = {
  slug: 'luis',
  nombre: 'Luis',
  nombreCompleto: 'Luis Ejemplo Demo',
  rfc: 'XAXX010101DL2',
  ocupacion: 'Conductor en Uber y DiDi',
  apps: ['uber', 'didi'],
  altaRegimen: '2025-01-01',
  opcionPagoDefinitivo: false,
  buzonHabilitado: true,
  // Más de $300,000 en 2025: no puede usar pago definitivo.
  ingresosAnioAnteriorCent: c('384000'),
  mesesPresentados: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  periodos: Array.from({ length: 10 }, (_, i) => mesLuis(i + 1)),
};

/**
 * Caso A: Mariana vende en Mercado Libre y Amazon. En 2025 vendió sin RFC más de
 * $300,000, así que no puede usar pago definitivo. Se inscribió en julio de 2026,
 * presentó julio y le faltan agosto, septiembre y octubre.
 * En octubre Amazon le siguió reteniendo 1% de ISR (la tasa de 2025): queda en ámbar.
 */
export const MARIANA: PersonaDemo = {
  slug: 'mariana',
  nombre: 'Mariana',
  nombreCompleto: 'Mariana Ejemplo Demo',
  rfc: 'XAXX010101DM1',
  ocupacion: 'Vende en Mercado Libre y Amazon',
  apps: [ML, 'amazon'],
  altaRegimen: '2026-07-01',
  opcionPagoDefinitivo: false,
  buzonHabilitado: false,
  ingresosAnioAnteriorCent: c('420000'),
  mesesPresentados: [7],
  periodos: [
    ...[1, 2, 3, 4, 5, 6].map(vacio),
    {
      anio: 2026,
      mes: 7,
      ingresos: [ingreso(ML, 'ventas', '16000', 250), ingreso('amazon', 'ventas', '8000', 250)],
      gastos: [gasto('Comisiones de venta', '2400'), gasto('Envíos y empaques', '1100')],
    },
    {
      anio: 2026,
      mes: 8,
      ingresos: [ingreso(ML, 'ventas', '18000', 250), ingreso('amazon', 'ventas', '9000', 250)],
      gastos: [gasto('Comisiones de venta', '2700'), gasto('Envíos y empaques', '1300')],
    },
    {
      anio: 2026,
      mes: 9,
      ingresos: [ingreso(ML, 'ventas', '20000', 250), ingreso('amazon', 'ventas', '10500', 250)],
      gastos: [gasto('Comisiones de venta', '3050'), gasto('Envíos y empaques', '1450')],
    },
    {
      anio: 2026,
      mes: 10,
      ingresos: [ingreso(ML, 'ventas', '22000', 250), ingreso('amazon', 'ventas', '12000', 100)],
      gastos: [gasto('Comisiones de venta', '3400'), gasto('Envíos y empaques', '1600')],
    },
  ],
};

export const PERSONAS: Record<SlugPersona, PersonaDemo> = { luis: LUIS, mariana: MARIANA };
