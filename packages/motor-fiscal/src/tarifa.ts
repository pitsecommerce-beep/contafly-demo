import { aplicarTasa, type Centavos, multiplicar } from './dinero.js';
import type { ParametrosFiscales, RenglonTarifa, Tarifa } from './tipos.js';

/**
 * Tarifa para el pago provisional del mes N (art. 106 LISR): se acumula de enero a N.
 * Límite superior y cuota fija se multiplican por N; el límite inferior es el
 * límite superior acumulado del renglón anterior más un centavo, como en las
 * tablas por periodo que publica el Anexo 8.
 */
export function tarifaAcumulada(params: ParametrosFiscales, mes: number): Tarifa {
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new RangeError(`Mes inválido: ${mes}`);
  }
  const mensual = params.tarifaMensual.valor;
  let superiorAnterior: Centavos | null = null;
  return mensual.map((r) => {
    const limiteSuperiorCent =
      r.limiteSuperiorCent === null ? null : multiplicar(r.limiteSuperiorCent, mes);
    const limiteInferiorCent =
      superiorAnterior === null ? r.limiteInferiorCent : superiorAnterior + 1;
    superiorAnterior = limiteSuperiorCent;
    return {
      limiteInferiorCent,
      limiteSuperiorCent,
      cuotaFijaCent: multiplicar(r.cuotaFijaCent, mes),
      tasaExcedenteBp: r.tasaExcedenteBp,
    };
  });
}

export interface ResultadoTarifa {
  isrCent: Centavos;
  /** Renglón de la tarifa, empezando en 1. 0 si la base es cero o negativa. */
  renglon: number;
  limiteInferiorCent: Centavos;
  excedenteCent: Centavos;
  impuestoMarginalCent: Centavos;
  cuotaFijaCent: Centavos;
  tasaExcedenteBp: number;
}

export function calcularTarifa(baseCent: Centavos, tarifa: Tarifa): ResultadoTarifa {
  const vacio = {
    isrCent: 0,
    renglon: 0,
    limiteInferiorCent: 0,
    excedenteCent: 0,
    impuestoMarginalCent: 0,
    cuotaFijaCent: 0,
    tasaExcedenteBp: 0,
  };
  if (baseCent <= 0) return vacio;
  // El último renglón no tiene límite superior, así que siempre hay uno aplicable.
  const i = tarifa.findIndex(
    (r) => r.limiteSuperiorCent === null || baseCent <= r.limiteSuperiorCent,
  );
  const r = tarifa[i] as RenglonTarifa;
  const excedenteCent = baseCent - r.limiteInferiorCent;
  const impuestoMarginalCent = aplicarTasa(excedenteCent, r.tasaExcedenteBp);
  return {
    isrCent: r.cuotaFijaCent + impuestoMarginalCent,
    renglon: i + 1,
    limiteInferiorCent: r.limiteInferiorCent,
    excedenteCent,
    impuestoMarginalCent,
    cuotaFijaCent: r.cuotaFijaCent,
    tasaExcedenteBp: r.tasaExcedenteBp,
  };
}
