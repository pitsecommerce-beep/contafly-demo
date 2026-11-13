import { PERSONAS } from './personas.js';
import { resumenMeses } from './resumen.js';

const q = (s: string) => `'${s.replaceAll("'", "''")}'`;

/** Genera supabase/seed.sql a partir de los datos de ejemplo y el motor. */
export function generarSemillas(hoy: string): string {
  const sql: string[] = [
    '-- Archivo generado por packages/datos-demo (pnpm --filter @contafly/datos-demo semillas).',
    '-- Datos de ejemplo. RFC evidentemente ficticios. No editar a mano.',
    '',
  ];
  for (const p of Object.values(PERSONAS)) {
    sql.push(
      `insert into public.personas_demo (slug, nombre, rfc_ficticio, apps, alta_regimen, opcion_pago_definitivo, buzon_habilitado) values (${q(p.slug)}, ${q(p.nombre)}, ${q(p.rfc)}, array[${p.apps.map(q).join(', ')}], ${q(p.altaRegimen)}, ${p.opcionPagoDefinitivo}, ${p.buzonHabilitado}) on conflict (slug) do nothing;`,
    );
    const estados = new Map(resumenMeses(p, hoy).map((m) => [m.mes, m]));
    for (const per of p.periodos) {
      const m = estados.get(per.mes);
      if (!m) continue;
      sql.push(
        `insert into public.periodos (persona_id, anio, mes, estado, vence_el) select id, ${per.anio}, ${per.mes}, ${q(m.estado)}, ${q(m.venceEl)} from public.personas_demo where slug = ${q(p.slug)} on conflict do nothing;`,
      );
      const periodo = `(select pe.id from public.periodos pe join public.personas_demo pd on pd.id = pe.persona_id where pd.slug = ${q(p.slug)} and pe.anio = ${per.anio} and pe.mes = ${per.mes})`;
      for (const i of per.ingresos) {
        sql.push(
          `insert into public.comprobantes (periodo_id, tipo, app, concepto, subtotal_cent, iva_cent, isr_ret_cent, iva_ret_cent, tasa_isr_leida, tasa_iva_leida) values (${periodo}, 'ingreso', ${q(i.app)}, 'Ingresos del mes', ${i.subtotalCent}, 0, ${i.isrRetenidoCent}, ${i.ivaRetenidoCent}, ${(i.tasaIsrLeidaBp ?? 0) / 10_000}, ${(i.tasaIvaLeidaBp ?? 0) / 10_000});`,
        );
      }
      for (const g of per.gastos) {
        sql.push(
          `insert into public.comprobantes (periodo_id, tipo, concepto, subtotal_cent, iva_cent) values (${periodo}, 'gasto', ${q(g.concepto)}, ${g.subtotalCent}, ${g.ivaCent});`,
        );
      }
    }
    sql.push('');
  }
  return sql.join('\n');
}
