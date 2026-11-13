import { logoCompleto } from '@contafly/ui';

export default function Inicio() {
  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '48px 16px' }}>
      <div
        role="img"
        aria-label="Contafly"
        style={{ width: 200, color: 'var(--brand)' }}
        // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG propio del paquete ui
        dangerouslySetInnerHTML={{ __html: logoCompleto }}
      />
      <p style={{ color: 'var(--txt-mid)', marginTop: 12 }}>Accounting, reimagined.</p>
    </main>
  );
}
