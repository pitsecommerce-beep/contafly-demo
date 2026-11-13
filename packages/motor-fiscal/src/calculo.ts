import { aplicarTasa, type Centavos, sumar } from './dinero.js';
import { calcularTarifa, tarifaAcumulada } from './tarifa.js';
import type { App, Linea, ParametrosFiscales, PeriodoEntrada, ResultadoMes } from './tipos.js';
import { VERSION_MOTOR } from './version.js';

function totalesPeriodo(p: PeriodoEntrada) {
  const ingresosPorApp: Partial<Record<App, Centavos>> = {};
  for (const i of p.ingresos) ingresosPorApp[i.app] = (ingresosPorApp[i.app] ?? 0) + i.subtotalCent;
  return {
    ingresosCent: sumar(...p.ingresos.map((i) => i.subtotalCent)),
    ingresosPorApp,
    gastosCent: sumar(...p.gastos.map((g) => g.subtotalCent)),
    ivaAcreditableCent: sumar(...p.gastos.map((g) => g.ivaCent)),
    isrRetenidoCent: sumar(...p.ingresos.map((i) => i.isrRetenidoCent)),
    ivaRetenidoCent: sumar(...p.ingresos.map((i) => i.ivaRetenidoCent)),
  };
}

function validarOrden(periodos: PeriodoEntrada[]): void {
  if (periodos.length === 0) throw new RangeError('Se necesita al menos un periodo');
  const anio = periodos[0]?.anio;
  periodos.forEach((p, i) => {
    if (p.anio !== anio) throw new RangeError('Todos los periodos deben ser del mismo ejercicio');
    const prev = periodos[i - 1];
    if (prev && p.mes <= prev.mes) throw new RangeError('Los periodos deben venir en orden de mes');
  });
}

function calcularIva(p: PeriodoEntrada, params: ParametrosFiscales) {
  const t = totalesPeriodo(p);
  const trasladadoCent = aplicarTasa(t.ingresosCent, params.tasaIva.valor);
  const neto = trasladadoCent - t.ivaAcreditableCent - t.ivaRetenidoCent;
  return {
    trasladadoCent,
    acreditableCent: t.ivaAcreditableCent,
    retenidoCent: t.ivaRetenidoCent,
    aPagarCent: Math.max(0, neto),
    saldoAFavorCent: Math.max(0, -neto),
  };
}

interface Opciones {
  /** Mes de la tarifa a usar. Por defecto el mes del último periodo (acumulado de enero a N). */
  mesTarifa?: number;
}

function acumulado(
  periodos: PeriodoEntrada[],
  params: ParametrosFiscales,
  op: Opciones = {},
): ResultadoMes {
  validarOrden(periodos);
  let ingresosAcum = 0;
  let deduccionesAcum = 0;
  let retencionesAnteriores = 0;
  let pagosAnteriores = 0;
  let r: ResultadoMes | null = null;

  for (const [idx, p] of periodos.entries()) {
    const t = totalesPeriodo(p);
    ingresosAcum += t.ingresosCent;
    deduccionesAcum += t.gastosCent;
    const esUltimo = idx === periodos.length - 1;
    const mesTarifa = esUltimo && op.mesTarifa !== undefined ? op.mesTarifa : p.mes;
    const base = ingresosAcum - deduccionesAcum;
    const tarifa = calcularTarifa(base, tarifaAcumulada(params, mesTarifa));
    const causadoDelMes = Math.max(0, tarifa.isrCent - pagosAnteriores - retencionesAnteriores);
    const isrAPagar = Math.max(0, causadoDelMes - t.isrRetenidoCent);
    const iva = calcularIva(p, params);
    const total = isrAPagar + iva.aPagarCent;

    if (esUltimo) {
      const fT = params.tarifaMensual.fuente;
      const lineas: Linea[] = [
        {
          clave: 'ingresos_mes',
          concepto: 'Ingresos del mes antes de IVA',
          montoCent: t.ingresosCent,
        },
        {
          clave: 'ingresos_acumulados',
          concepto: 'Ingresos acumulados del año',
          montoCent: ingresosAcum,
        },
        {
          clave: 'deducciones_acumuladas',
          concepto: 'Gastos con factura acumulados',
          montoCent: deduccionesAcum,
        },
        { clave: 'base', concepto: 'Utilidad acumulada', montoCent: Math.max(0, base) },
        {
          clave: 'limite_inferior',
          concepto: `Límite inferior (renglón ${tarifa.renglon})`,
          montoCent: tarifa.limiteInferiorCent,
          fuente: fT,
        },
        {
          clave: 'excedente',
          concepto: 'Excedente del límite inferior',
          montoCent: tarifa.excedenteCent,
        },
        {
          clave: 'impuesto_marginal',
          concepto: `Impuesto marginal (${tarifa.tasaExcedenteBp / 100}%)`,
          montoCent: tarifa.impuestoMarginalCent,
          fuente: fT,
        },
        {
          clave: 'cuota_fija',
          concepto: 'Cuota fija',
          montoCent: tarifa.cuotaFijaCent,
          fuente: fT,
        },
        { clave: 'isr_acumulado', concepto: 'ISR acumulado', montoCent: tarifa.isrCent },
        {
          clave: 'pagos_anteriores',
          concepto: 'Menos pagos provisionales de meses anteriores',
          montoCent: -pagosAnteriores,
          fuente: 'Art. 106 LISR',
        },
        {
          clave: 'retenciones_anteriores',
          concepto: 'Menos retenciones de meses anteriores',
          montoCent: -retencionesAnteriores,
          fuente: 'Art. 113-A LISR',
        },
        { clave: 'isr_mes', concepto: 'ISR del mes', montoCent: causadoDelMes },
        {
          clave: 'isr_retenido',
          concepto: 'Menos ISR que te retuvieron las apps',
          montoCent: -t.isrRetenidoCent,
        },
        { clave: 'isr_a_pagar', concepto: 'ISR a pagar', montoCent: isrAPagar },
        {
          clave: 'iva_trasladado',
          concepto: 'IVA de tus ingresos (16%)',
          montoCent: iva.trasladadoCent,
          fuente: params.tasaIva.fuente,
        },
        {
          clave: 'iva_acreditable',
          concepto: 'Menos IVA de tus gastos con factura',
          montoCent: -iva.acreditableCent,
        },
        {
          clave: 'iva_retenido',
          concepto: 'Menos IVA que te retuvieron las apps',
          montoCent: -iva.retenidoCent,
          fuente: params.retencionIvaConRfc.fuente,
        },
        iva.saldoAFavorCent > 0
          ? { clave: 'iva_saldo_favor', concepto: 'IVA a favor', montoCent: iva.saldoAFavorCent }
          : { clave: 'iva_a_pagar', concepto: 'IVA a pagar', montoCent: iva.aPagarCent },
        { clave: 'total', concepto: 'Total a pagar', montoCent: total },
      ];
      r = {
        metodo: 'acumulado',
        anio: p.anio,
        mes: p.mes,
        ingresosCent: t.ingresosCent,
        ingresosPorApp: t.ingresosPorApp,
        gastosCent: t.gastosCent,
        isr: {
          causadoDelMesCent: causadoDelMes,
          retenidoDelMesCent: t.isrRetenidoCent,
          aPagarCent: isrAPagar,
        },
        iva,
        totalCent: total,
        // El IVA a favor se puede acreditar después, así que reduce la carga del mes.
        cargaTotalCent: t.isrRetenidoCent + t.ivaRetenidoCent + total - iva.saldoAFavorCent,
        lineas,
        versionMotor: VERSION_MOTOR,
        versionParametros: params.version,
      };
    }
    pagosAnteriores += isrAPagar;
    retencionesAnteriores += t.isrRetenidoCent;
  }
  // validarOrden garantiza al menos un periodo, así que el último siempre asigna r.
  return r as unknown as ResultadoMes;
}

/** Declarar y deducir: pago provisional acumulado de enero al último periodo (art. 106 LISR). */
export function calcularAcumulado(
  periodos: PeriodoEntrada[],
  params: ParametrosFiscales,
): ResultadoMes {
  return acumulado(periodos, params);
}

/** Cálculo de un solo mes con la tarifa mensual, sin acumular meses anteriores. */
export function calcularMes(periodo: PeriodoEntrada, params: ParametrosFiscales): ResultadoMes {
  return acumulado([periodo], params, { mesTarifa: 1 });
}

/** Pago definitivo (art. 113-B LISR y 18-M LIVA): lo retenido es el impuesto del mes. */
export function calcularPagoDefinitivo(
  periodo: PeriodoEntrada,
  params: ParametrosFiscales,
): ResultadoMes {
  const t = totalesPeriodo(periodo);
  const fuente = params.topePagoDefinitivo.fuente;
  return {
    metodo: 'definitivo',
    anio: periodo.anio,
    mes: periodo.mes,
    ingresosCent: t.ingresosCent,
    ingresosPorApp: t.ingresosPorApp,
    gastosCent: t.gastosCent,
    isr: {
      causadoDelMesCent: t.isrRetenidoCent,
      retenidoDelMesCent: t.isrRetenidoCent,
      aPagarCent: 0,
    },
    iva: {
      trasladadoCent: t.ivaRetenidoCent,
      acreditableCent: 0,
      retenidoCent: t.ivaRetenidoCent,
      aPagarCent: 0,
      saldoAFavorCent: 0,
    },
    totalCent: 0,
    cargaTotalCent: t.isrRetenidoCent + t.ivaRetenidoCent,
    lineas: [
      {
        clave: 'ingresos_mes',
        concepto: 'Ingresos del mes antes de IVA',
        montoCent: t.ingresosCent,
      },
      {
        clave: 'isr_retenido',
        concepto: 'ISR que te retuvieron las apps (pago definitivo)',
        montoCent: t.isrRetenidoCent,
        fuente,
      },
      {
        clave: 'iva_retenido',
        concepto: 'IVA que te retuvieron las apps (pago definitivo)',
        montoCent: t.ivaRetenidoCent,
        fuente: 'Art. 18-M LIVA',
      },
      { clave: 'total', concepto: 'Total a pagar', montoCent: 0 },
    ],
    versionMotor: VERSION_MOTOR,
    versionParametros: params.version,
  };
}
