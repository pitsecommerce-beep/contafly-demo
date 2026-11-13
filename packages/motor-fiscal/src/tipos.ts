import type { Centavos, PuntosBase } from './dinero.js';

export type Giro = 'transporte' | 'hospedaje' | 'ventas';
export type App = 'uber' | 'didi' | 'rappi' | 'mercado_libre' | 'amazon' | 'airbnb';
export type Metodo = 'definitivo' | 'acumulado';

/** Un parámetro fiscal siempre trae su fuente. `valor: null` significa pendiente de validar. */
export interface Parametro<T> {
  valor: T;
  fuente: string;
}

export interface RenglonTarifa {
  limiteInferiorCent: Centavos;
  /** null en el último renglón ("en adelante") */
  limiteSuperiorCent: Centavos | null;
  cuotaFijaCent: Centavos;
  tasaExcedenteBp: PuntosBase;
}

export type Tarifa = RenglonTarifa[];

export interface ParametrosFiscales {
  version: string;
  anio: number;
  retencionIsrConRfc: Record<Giro, Parametro<PuntosBase>>;
  retencionIsrSinRfc: Parametro<PuntosBase>;
  tasaIva: Parametro<PuntosBase>;
  retencionIvaConRfc: Parametro<PuntosBase>;
  retencionIvaSinRfc: Parametro<PuntosBase>;
  topePagoDefinitivo: Parametro<Centavos>;
  tarifaMensual: Parametro<Tarifa>;
  multaBuzon: Parametro<{ minimaCent: Centavos; maximaCent: Centavos; desde: string }>;
  diaVencimiento: Parametro<number>;
  // Pendientes: no se inventan. La interfaz muestra "se calcula al presentar".
  tasaRecargosMensual: Parametro<PuntosBase | null>;
  factorActualizacion: Parametro<number | null>;
  multaDeclaracionOmitida: Parametro<{ minimaCent: Centavos; maximaCent: Centavos } | null>;
}

export interface Ingreso {
  app: App;
  giro: Giro;
  /** Ingreso antes de IVA */
  subtotalCent: Centavos;
  /** Lo que la app retuvo según el CFDI de retenciones */
  isrRetenidoCent: Centavos;
  ivaRetenidoCent: Centavos;
  /** ¿La app tenía el RFC de la persona? */
  conRfc: boolean;
  /** Tasas leídas del CFDI de retenciones, si se conocen */
  tasaIsrLeidaBp?: PuntosBase;
  tasaIvaLeidaBp?: PuntosBase;
}

export interface Gasto {
  concepto: string;
  subtotalCent: Centavos;
  /** IVA trasladado en la factura del gasto (acreditable) */
  ivaCent: Centavos;
}

export interface PeriodoEntrada {
  anio: number;
  mes: number;
  ingresos: Ingreso[];
  gastos: Gasto[];
}

export interface Linea {
  clave: string;
  concepto: string;
  montoCent: Centavos;
  fuente?: string;
}

export interface ResultadoMes {
  metodo: Metodo;
  anio: number;
  mes: number;
  ingresosCent: Centavos;
  ingresosPorApp: Partial<Record<App, Centavos>>;
  gastosCent: Centavos;
  isr: {
    causadoDelMesCent: Centavos;
    retenidoDelMesCent: Centavos;
    aPagarCent: Centavos;
  };
  iva: {
    trasladadoCent: Centavos;
    acreditableCent: Centavos;
    retenidoCent: Centavos;
    aPagarCent: Centavos;
    saldoAFavorCent: Centavos;
  };
  /** Lo que se paga en la declaración */
  totalCent: Centavos;
  /** Retenciones + pago: lo que la persona aporta en total por el mes */
  cargaTotalCent: Centavos;
  lineas: Linea[];
  versionMotor: string;
  versionParametros: string;
}
