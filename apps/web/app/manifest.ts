import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Contafly',
    short_name: 'Contafly',
    description: 'Tu contador virtual para lo que cobras en apps.',
    lang: 'es-MX',
    start_url: '/',
    display: 'standalone',
    background_color: '#EAE6E0',
    theme_color: '#3A63AE',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
