import type { PersonaDemo } from '@contafly/datos-demo';
import { fechaVencimiento, type ResultadoMes } from '@contafly/motor-fiscal';
import type { DatosAcuse } from './acuse.js';

/** Arma los datos del acuse a partir del resultado del motor. Ningún monto se calcula aquí. */
export function datosAcuseDesdeMotor(
  persona: PersonaDemo,
  r: ResultadoMes,
  opciones: { presentadoEn: string; folio: string; urlQr?: string },
): DatosAcuse {
  return {
    rfc: persona.rfc,
    nombre: persona.nombreCompleto,
    mes: r.mes,
    ejercicio: r.anio,
    presentadoEn: opciones.presentadoEn,
    isrACargoCent: r.isr.aPagarCent,
    ivaACargoCent: r.iva.aPagarCent,
    vigenteHasta: fechaVencimiento(r.anio, r.mes),
    folio: opciones.folio,
    ...(opciones.urlQr ? { urlQr: opciones.urlQr } : {}),
  };
}
