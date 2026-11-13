import {
  DEMO_FECHA_POR_DEFECTO,
  PERSONAS,
  resumenMeses,
  type SlugPersona,
} from '@contafly/datos-demo';
import { datosAcuseDesdeMotor, generarAcuse } from '@contafly/documentos';

export const runtime = 'nodejs';

/** PDF de acuse y línea de captura de demostración, calculado con el motor. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = (url.searchParams.get('persona') ?? 'luis') as SlugPersona;
  const mes = Number(url.searchParams.get('mes') ?? 10);
  const persona = PERSONAS[slug];
  if (!persona) return new Response('Persona no encontrada', { status: 404 });
  const hoy = process.env.DEMO_FECHA ?? DEMO_FECHA_POR_DEFECTO;
  const m = resumenMeses(persona, hoy).find((x) => x.mes === mes);
  if (!m) return new Response('Mes no encontrado', { status: 404 });
  const datos = datosAcuseDesdeMotor(persona, m.resultado, {
    presentadoEn: `${hoy}T18:42`,
    folio: `${slug}-${m.anio}-${mes}`,
    ...(process.env.PUBLIC_WEB_URL ? { urlQr: process.env.PUBLIC_WEB_URL } : {}),
  });
  const pdf = await generarAcuse(datos);
  return new Response(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `inline; filename="acuse-demo-${slug}-${mes}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
