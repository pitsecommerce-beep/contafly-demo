import { DEMO_FECHA_POR_DEFECTO } from '@contafly/datos-demo';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Marco } from '../components/Marco';
import { ProveedorChat } from '../lib/chat';
import { ProveedorDemo } from '../lib/contexto';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contafly',
  description: 'Tu contador virtual para lo que cobras en apps.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Contafly', statusBarStyle: 'default' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EAE6E0' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
};

export const dynamic = 'force-dynamic';

/** Pregunta a la api si Twilio está activo. Si no hay api o no responde, todo se simula en la web. */
async function whatsappReal(): Promise<boolean> {
  const api = process.env.PUBLIC_API_URL;
  if (!api) return false;
  try {
    const r = await fetch(`${api.replace(/\/$/, '')}/salud`, {
      signal: AbortSignal.timeout(1500),
      next: { revalidate: 60 },
    });
    const d = (await r.json()) as { whatsapp?: string };
    return d.whatsapp === 'twilio';
  } catch {
    return false;
  }
}

export default async function Layout({ children }: { children: ReactNode }) {
  const hoy = process.env.DEMO_FECHA ?? DEMO_FECHA_POR_DEFECTO;
  const real = await whatsappReal();
  return (
    <html lang="es-MX">
      <body>
        <div className="franja-demo" role="note">
          Demostración con datos de ejemplo. No se conecta al SAT.
        </div>
        <ProveedorDemo hoy={hoy} whatsappReal={real}>
          <ProveedorChat>
            <Marco>{children}</Marco>
          </ProveedorChat>
        </ProveedorDemo>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: registro del service worker para la PWA
          dangerouslySetInnerHTML={{
            __html:
              "if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}",
          }}
        />
      </body>
    </html>
  );
}
