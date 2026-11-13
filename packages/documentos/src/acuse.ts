import { aPesos, formatoMxn, nombreMes } from '@contafly/motor-fiscal';
import bwipjs from 'bwip-js/node';
import { degrees, PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { SIMBOLO_ANCHO, SIMBOLO_D } from './logo.js';

/**
 * Plantilla de acuse de recibo y línea de captura PARA LA DEMO.
 * Sigue la estructura de un acuse real (secciones, campos y recuadro de línea de captura)
 * pero no lleva escudos ni logos oficiales, usa datos ficticios, una línea de captura
 * con letras que ningún banco acepta y una marca de agua en cada hoja.
 */

export interface DatosAcuse {
  rfc: string;
  nombre: string;
  /** 1 a 12 */
  mes: number;
  ejercicio: number;
  /** "2026-11-13T18:42" hora local de la demo */
  presentadoEn: string;
  isrACargoCent: number;
  ivaACargoCent: number;
  /** AAAA-MM-DD */
  vigenteHasta: string;
  /** Semilla para que el número de operación y el sello sean estables */
  folio: string;
  /** URL que codifica el QR (la página de la demo) */
  urlQr?: string;
}

export const MARCA_AGUA = 'DEMOSTRACIÓN. NO ES UN DOCUMENTO DEL SAT. NO VÁLIDO PARA PAGO';

const NEGRO = rgb(0.1, 0.09, 0.08);
const GRIS = rgb(0.35, 0.33, 0.3);
const MARCA = rgb(0.6, 0.27, 0.23);
const AZUL = rgb(0.23, 0.39, 0.68);

const ANCHO = 612;
const ALTO = 792;
const M = 48;

/** Hash FNV-1a simple, solo para que los números ficticios sean repetibles. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (const ch of s) {
    h ^= ch.codePointAt(0) ?? 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function digitos(semilla: string, n: number): string {
  let out = '';
  let h = hash(semilla);
  while (out.length < n) {
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
    out += String(h % 10);
  }
  return out;
}

/** Línea de captura evidentemente ficticia: empieza con DEMO y nunca valida en un banco. */
export function lineaCapturaDemo(d: DatosAcuse): string {
  const total = String(d.isrACargoCent + d.ivaACargoCent).padStart(8, '0');
  const base = `DEMO${String(d.mes).padStart(2, '0')}${String(d.ejercicio).slice(2)}${digitos(d.folio, 4)}${total}`;
  return base.match(/.{1,4}/g)?.join(' ') ?? base;
}

export function numeroOperacionDemo(d: DatosAcuse): string {
  return `DEMO-${digitos(`${d.folio}-op`, 10)}`;
}

function selloDemo(d: DatosAcuse): string[] {
  const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let h = hash(`${d.folio}-sello`);
  let s = 'DEMOSTRACION/SIN/VALIDEZ/';
  while (s.length < 344) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
    s += alfabeto[h % 64];
  }
  s = `${s.slice(0, 342)}==`;
  return s.match(/.{1,100}/g) ?? [s];
}

function fechaHora(iso: string): string {
  const [f = '', h = ''] = iso.split('T');
  const [a, m, d] = f.split('-');
  return `${d}/${m}/${a} ${h.slice(0, 5)}`;
}

function fechaCorta(iso: string): string {
  const [a, m, d] = iso.split('-');
  return `${d}/${m}/${a}`;
}

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Fuentes {
  normal: PDFFont;
  negrita: PDFFont;
  mono: PDFFont;
}

function marcaDeAgua(p: PDFPage, f: Fuentes) {
  const lineas = ['DEMOSTRACIÓN', 'NO ES UN DOCUMENTO DEL SAT', 'NO VÁLIDO PARA PAGO'];
  const tam = [64, 30, 30];
  lineas.forEach((t, i) => {
    const size = tam[i] ?? 30;
    const w = f.negrita.widthOfTextAtSize(t, size);
    // Centrado a lo largo de la diagonal
    const ang = Math.atan2(ALTO, ANCHO);
    const cx = ANCHO / 2 + (i - 1) * 48 * Math.sin(ang);
    const cy = ALTO / 2 - (i - 1) * 48 * Math.cos(ang);
    p.drawText(t, {
      x: cx - (w / 2) * Math.cos(ang),
      y: cy - (w / 2) * Math.sin(ang),
      size,
      font: f.negrita,
      color: MARCA,
      opacity: 0.16,
      rotate: degrees((ang * 180) / Math.PI),
    });
  });
}

function encabezado(p: PDFPage, f: Fuentes, d: DatosAcuse, hoja: number, total: number) {
  // Símbolo de Contafly, nunca escudos oficiales
  const escala = 36 / SIMBOLO_ANCHO;
  p.drawSvgPath(SIMBOLO_D, { x: M, y: ALTO - 40, scale: escala, color: AZUL });
  p.drawText('Contafly', { x: M + 42, y: ALTO - 66, size: 12, font: f.negrita, color: AZUL });

  const t1 = 'ACUSE DE RECIBO (DEMOSTRACIÓN)';
  const t2 = 'DECLARACIÓN PROVISIONAL O DEFINITIVA DE IMPUESTOS FEDERALES';
  p.drawText(t1, {
    x: (ANCHO - f.normal.widthOfTextAtSize(t1, 10)) / 2,
    y: ALTO - 52,
    size: 10,
    font: f.normal,
    color: NEGRO,
  });
  p.drawText(t2, {
    x: (ANCHO - f.normal.widthOfTextAtSize(t2, 9)) / 2,
    y: ALTO - 64,
    size: 9,
    font: f.normal,
    color: NEGRO,
  });

  const chip = 'DATOS DE EJEMPLO';
  const cw = f.negrita.widthOfTextAtSize(chip, 7) + 12;
  p.drawRectangle({
    x: ANCHO - M - cw,
    y: ALTO - 62,
    width: cw,
    height: 16,
    borderColor: MARCA,
    borderWidth: 1,
  });
  p.drawText(chip, { x: ANCHO - M - cw + 6, y: ALTO - 57, size: 7, font: f.negrita, color: MARCA });

  let y = ALTO - 104;
  const etiqueta = (t: string, x: number, yy: number) =>
    p.drawText(t, { x, y: yy, size: 8.5, font: f.negrita, color: NEGRO });
  const valor = (t: string, x: number, yy: number) =>
    p.drawText(t, { x, y: yy, size: 8.5, font: f.normal, color: NEGRO });

  etiqueta('RFC:', M, y);
  valor(d.rfc, M + 150, y);
  const hojaTxt = `Hoja ${hoja} de ${total}`;
  valor(hojaTxt, ANCHO - M - f.normal.widthOfTextAtSize(hojaTxt, 8.5), y);
  y -= 16;
  etiqueta('Nombre:', M, y);
  valor(d.nombre.toUpperCase(), M + 150, y);
  y -= 12;
  p.drawLine({ start: { x: M, y }, end: { x: ANCHO - M, y }, thickness: 1, color: NEGRO });
  y -= 18;

  const filas: Array<[string, string, string, string]> = [
    ['Tipo de declaración:', 'Normal', 'Medio de presentación:', 'Contafly (demostración)'],
    ['Período de la declaración:', mayus(nombreMes(d.mes)), 'Ejercicio:', String(d.ejercicio)],
    ['Fecha y hora de presentación:', fechaHora(d.presentadoEn), 'Periodicidad:', 'Mensual'],
    ['Número de operación:', numeroOperacionDemo(d), '', ''],
  ];
  for (const [a, b, c, e] of filas) {
    etiqueta(a, M, y);
    valor(b, M + 150, y);
    if (c) etiqueta(c, M + 300, y);
    if (e) valor(e, M + 420, y);
    y -= 16;
  }
  y += 4;
  p.drawLine({ start: { x: M, y }, end: { x: ANCHO - M, y }, thickness: 1, color: NEGRO });
}

function pie(p: PDFPage, f: Fuentes, d: DatosAcuse) {
  const lineas = selloDemo(d);
  p.drawText('Sello digital:', { x: M, y: 92, size: 8, font: f.negrita, color: NEGRO });
  for (const [i, l] of lineas.entries()) {
    p.drawText(l, { x: M + 70, y: 104 - i * 9, size: 6.4, font: f.mono, color: GRIS });
  }
  const aviso = `Generado por Contafly con datos de ejemplo. ${MARCA_AGUA}.`;
  p.drawText(aviso, {
    x: (ANCHO - f.normal.widthOfTextAtSize(aviso, 7)) / 2,
    y: 36,
    size: 7,
    font: f.normal,
    color: MARCA,
  });
}

function pesos(cent: number): string {
  // Mismo formato del acuse (sin signo de pesos), conservando centavos para que cuadre con la demo
  return formatoMxn(cent).replace('$', '');
}

export async function generarAcuse(d: DatosAcuse): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Acuse de demostración ${mayus(nombreMes(d.mes))} ${d.ejercicio}`);
  pdf.setAuthor('Contafly (demostración)');
  pdf.setSubject(MARCA_AGUA);
  pdf.setKeywords(['demostración', 'datos de ejemplo', 'no válido']);
  pdf.setProducer('Contafly demo');
  pdf.setCreator('Contafly demo');

  const f: Fuentes = {
    normal: await pdf.embedFont(StandardFonts.Helvetica),
    negrita: await pdf.embedFont(StandardFonts.HelveticaBold),
    mono: await pdf.embedFont(StandardFonts.Courier),
  };
  const total = d.isrACargoCent + d.ivaACargoCent;

  // Hoja 1: impuestos que declara
  const h1 = pdf.addPage([ANCHO, ALTO]);
  encabezado(h1, f, d, 1, 2);
  let y = ALTO - 230;
  h1.drawText('Impuestos que declara:', { x: M, y, size: 9, font: f.negrita, color: NEGRO });
  y -= 24;
  const conceptos: Array<[string, number]> = [
    ['ISR PERSONAS FÍSICAS PLATAFORMAS TECNOLÓGICAS', d.isrACargoCent],
    ['IVA PERSONAS FÍSICAS PLATAFORMAS TECNOLÓGICAS', d.ivaACargoCent],
  ];
  conceptos.forEach(([nombre, monto], i) => {
    const filas: Array<[string, string]> = [
      [`Concepto de pago ${i + 1}:`, nombre],
      ['A cargo:', pesos(monto)],
      ['Recargos:', 'Se calculan al presentar'],
      ['Cantidad a cargo:', pesos(monto)],
      ['Cantidad a pagar:', pesos(monto)],
    ];
    for (const [a, b] of filas) {
      h1.drawText(a, { x: M, y, size: 8.5, font: f.negrita, color: NEGRO });
      const esTexto = a.startsWith('Concepto') || a === 'Recargos:';
      // Los textos van alineados a la izquierda; los montos, a la derecha de la misma columna.
      const x = esTexto ? M + 220 : M + 330 - f.normal.widthOfTextAtSize(b, 8.5);
      h1.drawText(b, { x, y, size: 8.5, font: f.normal, color: a === 'Recargos:' ? GRIS : NEGRO });
      y -= 15;
    }
    y -= 6;
  });
  marcaDeAgua(h1, f);
  pie(h1, f, d);

  // Hoja 2: línea de captura
  const h2 = pdf.addPage([ANCHO, ALTO]);
  encabezado(h2, f, d, 2, 2);
  y = ALTO - 232;
  const avisos = [
    'Este documento es una demostración de Contafly. No se presentó ninguna declaración ante el SAT.',
    'Todos los datos son de ejemplo: el RFC, el nombre, el número de operación, el sello y la línea de captura son ficticios.',
    'La línea de captura contiene letras para que ningún banco la acepte. No intentes pagarla.',
  ];
  for (const a of avisos) {
    h2.drawText(a, { x: M, y, size: 8, font: f.normal, color: NEGRO });
    y -= 13;
  }

  const caja = { x: M, y: y - 130, w: ANCHO - 2 * M, h: 118 };
  h2.drawRectangle({
    x: caja.x,
    y: caja.y,
    width: caja.w,
    height: caja.h,
    borderColor: NEGRO,
    borderWidth: 1.2,
  });
  const tit = 'SECCIÓN LÍNEA DE CAPTURA (DEMOSTRACIÓN)';
  h2.drawText(tit, {
    x: (ANCHO - f.negrita.widthOfTextAtSize(tit, 12)) / 2,
    y: caja.y + caja.h - 20,
    size: 12,
    font: f.negrita,
    color: NEGRO,
  });
  h2.drawText(
    'En una declaración real, el importe a cargo se paga en un banco autorizado con la línea de captura.',
    {
      x: caja.x + 14,
      y: caja.y + caja.h - 38,
      size: 8.5,
      font: f.normal,
      color: NEGRO,
    },
  );
  h2.drawText('En esta demostración no se paga nada.', {
    x: caja.x + 14,
    y: caja.y + caja.h - 50,
    size: 8.5,
    font: f.normal,
    color: NEGRO,
  });
  const linea = lineaCapturaDemo(d);
  h2.drawText('Línea de', {
    x: caja.x + 14,
    y: caja.y + 48,
    size: 9.5,
    font: f.normal,
    color: NEGRO,
  });
  h2.drawText('captura:', {
    x: caja.x + 14,
    y: caja.y + 37,
    size: 9.5,
    font: f.normal,
    color: NEGRO,
  });
  h2.drawText(linea, { x: caja.x + 70, y: caja.y + 40, size: 13, font: f.negrita, color: NEGRO });
  h2.drawText('Importe total', {
    x: caja.x + 330,
    y: caja.y + 48,
    size: 9.5,
    font: f.normal,
    color: NEGRO,
  });
  h2.drawText('a pagar:', {
    x: caja.x + 330,
    y: caja.y + 37,
    size: 9.5,
    font: f.normal,
    color: NEGRO,
  });
  h2.drawText(formatoMxn(total), {
    x: caja.x + 400,
    y: caja.y + 40,
    size: 13,
    font: f.negrita,
    color: NEGRO,
  });
  h2.drawText('Vigente hasta:', {
    x: caja.x + 14,
    y: caja.y + 14,
    size: 9.5,
    font: f.normal,
    color: NEGRO,
  });
  h2.drawText(fechaCorta(d.vigenteHasta), {
    x: caja.x + 85,
    y: caja.y + 14,
    size: 10,
    font: f.negrita,
    color: NEGRO,
  });

  // Código de barras y QR: solo codifican un aviso de demostración
  const barras = await bwipjs.toBuffer({
    bcid: 'code128',
    text: 'DEMO-NO-VALIDO-PARA-PAGO',
    scale: 3,
    height: 14,
    includetext: false,
  });
  const imgBarras = await pdf.embedPng(barras);
  const by = caja.y - 70;
  h2.drawImage(imgBarras, { x: M, y: by, width: 230, height: 52 });
  h2.drawText(`${linea.replaceAll(' ', '')} ${aPesos(total)}`, {
    x: M,
    y: by - 12,
    size: 9,
    font: f.negrita,
    color: NEGRO,
  });
  const qr = await bwipjs.toBuffer({
    bcid: 'qrcode',
    text:
      d.urlQr ?? 'Contafly: documento de demostración con datos de ejemplo. No válido para pago.',
    scale: 3,
  });
  const imgQr = await pdf.embedPng(qr);
  h2.drawImage(imgQr, { x: ANCHO - M - 64, y: by - 12, width: 64, height: 64 });

  marcaDeAgua(h2, f);
  pie(h2, f, d);
  return pdf.save();
}
