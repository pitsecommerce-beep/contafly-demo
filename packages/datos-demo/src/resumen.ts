import {
  calcularAcumulado,
  compararSinRfc,
  evaluarCompuertas,
  fechaVencimiento,
  nombreMes,
  PARAMETROS_2026,
  type Recomendacion,
  type ResultadoCompuertas,
  type ResultadoMes,
  recomendar,
} from '@contafly/motor-fiscal';
import type { PersonaDemo } from './personas.js';

export interface MesResumen {
  anio: number;
  mes: number;
  nombreMes: string;
  venceEl: string;
  presentado: boolean;
  estado: 'presentado' | 'listo' | 'ambar' | 'rojo';
  compuertas: ResultadoCompuertas;
  resultado: ResultadoMes;
  recomendacion: Recomendacion;
}

/** Calcula cada mes con actividad de la persona, con el motor y la fecha que se pase. */
export function resumenMeses(persona: PersonaDemo, hoy: string): MesResumen[] {
  const params = PARAMETROS_2026;
  return persona.periodos
    .map((p, i) => ({ p, hasta: persona.periodos.slice(0, i + 1) }))
    .filter(({ p }) => p.ingresos.length > 0)
    .map(({ p, hasta }) => {
      const presentado = persona.mesesPresentados.includes(p.mes);
      const compuertas = evaluarCompuertas(p, params, { hoy });
      const estado = presentado
        ? 'presentado'
        : compuertas.estado === 'verde'
          ? 'listo'
          : compuertas.estado;
      return {
        anio: p.anio,
        mes: p.mes,
        nombreMes: nombreMes(p.mes),
        venceEl: fechaVencimiento(p.anio, p.mes),
        presentado,
        estado,
        compuertas,
        resultado: calcularAcumulado(hasta, params),
        recomendacion: recomendar(hasta, params, {
          ingresosAnioAnteriorCent: persona.ingresosAnioAnteriorCent,
        }),
      };
    });
}

export function pendientes(persona: PersonaDemo, hoy: string): MesResumen[] {
  return resumenMeses(persona, hoy).filter((m) => !m.presentado);
}

export function comparadorDelMes(persona: PersonaDemo, mes: number, hoy: string) {
  const m = resumenMeses(persona, hoy).find((x) => x.mes === mes);
  const p = persona.periodos.find((x) => x.mes === mes);
  if (!m || !p) throw new RangeError(`Sin datos para el mes ${mes}`);
  return compararSinRfc(p, m.resultado, PARAMETROS_2026);
}

export interface Hallazgo {
  clave: string;
  titulo: string;
  explicacion: string;
  consecuencia: string;
  severidad: 'verde' | 'ambar' | 'rojo';
}

/** Hallazgos del diagnóstico simulado. Las consecuencias salen de los parámetros fiscales. */
export function hallazgos(persona: PersonaDemo, hoy: string): Hallazgo[] {
  const params = PARAMETROS_2026;
  const lista: Hallazgo[] = [];
  const alta = new Date(`${persona.altaRegimen}T00:00:00Z`);
  lista.push({
    clave: 'regimen',
    titulo: `Régimen de plataformas activo desde ${nombreMes(alta.getUTCMonth() + 1)} de ${alta.getUTCFullYear()}`,
    explicacion:
      'Desde ese mes debes presentar una declaración cada mes, aunque las apps ya te retengan.',
    consecuencia: 'Cada mes vence el día 17 del mes siguiente.',
    severidad: 'verde',
  });
  const pend = pendientes(persona, hoy);
  const atrasados = pend.filter((m) => m.compuertas.estado === 'rojo');
  if (pend.length > 0) {
    const nombres = pend.map((m) => m.nombreMes);
    const texto =
      nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres[0];
    lista.push({
      clave: 'declaraciones',
      titulo: `Declaraciones de ${texto} sin presentar`,
      explicacion:
        atrasados.length > 0
          ? `${atrasados.length === 1 ? 'Una ya venció' : `${atrasados.length} ya vencieron`}. Hay que presentarlas con recargos y actualización.`
          : 'Aún estás a tiempo de presentarlas.',
      consecuencia:
        params.tasaRecargosMensual.valor === null
          ? 'Los recargos y la actualización se calculan al presentar.'
          : 'Se suman recargos y actualización.',
      severidad: atrasados.length > 0 ? 'rojo' : 'ambar',
    });
  }
  if (!persona.buzonHabilitado) {
    const m = params.multaBuzon.valor;
    lista.push({
      clave: 'buzon',
      titulo: 'Buzón tributario sin habilitar',
      explicacion: 'Es el canal por el que el SAT te avisa de todo. Se habilita en minutos.',
      consecuencia: `Desde el 1 de enero de 2027 la multa va de $${(m.minimaCent / 100).toLocaleString('es-MX')} a $${(m.maximaCent / 100).toLocaleString('es-MX')}.`,
      severidad: 'ambar',
    });
  }
  return lista;
}
