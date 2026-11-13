import { DEMO_FECHA_POR_DEFECTO as HOY, LUIS, resumenMeses } from '@contafly/datos-demo';
import { centavos as c } from '@contafly/motor-fiscal';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import {
  datosAcuseDesdeMotor,
  generarAcuse,
  lineaCapturaDemo,
  MARCA_AGUA,
  numeroOperacionDemo,
} from '../src/index.js';

const oct = resumenMeses(LUIS, HOY).find((m) => m.mes === 10);
if (!oct) throw new Error('sin octubre');
const datos = datosAcuseDesdeMotor(LUIS, oct.resultado, {
  presentadoEn: `${HOY}T18:42`,
  folio: 'luis-2026-10',
});

describe('acuse de demostración', () => {
  it('toma los montos del motor', () => {
    expect(datos.isrACargoCent + datos.ivaACargoCent).toBe(c('2538.45'));
    expect(datos.vigenteHasta).toBe('2026-11-17');
    expect(datos.rfc).toBe('XAXX010101DL2');
  });

  it('la línea de captura es evidentemente ficticia y estable', () => {
    const l = lineaCapturaDemo(datos);
    expect(l.startsWith('DEMO')).toBe(true);
    expect(l).toMatch(/^DEMO \d{4} \d{4} \d{4} \d{4}$/);
    expect(l.replaceAll(' ', '')).toMatch(/00253845$/);
    expect(lineaCapturaDemo(datos)).toBe(l);
    expect(numeroOperacionDemo(datos)).toMatch(/^DEMO-\d{10}$/);
  });

  it('genera un PDF de 2 hojas marcado como demostración', async () => {
    const bytes = await generarAcuse(datos);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBe(2);
    expect(pdf.getSubject()).toBe(MARCA_AGUA);
    expect(pdf.getTitle()).toBe('Acuse de demostración Octubre 2026');
  });
});
