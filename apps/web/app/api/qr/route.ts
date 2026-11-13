import bwipjs from 'bwip-js/node';

export const runtime = 'nodejs';

/** QR en PNG para el enlace de WhatsApp. Solo acepta enlaces wa.me. */
export async function GET(req: Request) {
  const texto = new URL(req.url).searchParams.get('t') ?? '';
  if (!texto.startsWith('https://wa.me/') || texto.length > 300) {
    return new Response('QR no permitido', { status: 400 });
  }
  const png = await bwipjs.toBuffer({ bcid: 'qrcode', text: texto, scale: 6 });
  return new Response(new Uint8Array(png), {
    headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
  });
}
