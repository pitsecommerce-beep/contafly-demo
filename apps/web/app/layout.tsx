import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Contafly',
  description: 'Tu contador virtual para lo que cobras en apps.',
  manifest: '/manifest.webmanifest',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#EAE6E0' },
    { media: '(prefers-color-scheme: dark)', color: '#121110' },
  ],
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-MX">
      <body>
        <div className="franja-demo" role="note">
          Demostración con datos de ejemplo. No se conecta al SAT.
        </div>
        {children}
      </body>
    </html>
  );
}
