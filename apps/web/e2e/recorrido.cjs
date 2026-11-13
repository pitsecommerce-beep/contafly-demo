// Recorrido de punta a punta de los casos A y B con capturas.
// Uso: levanta la web (pnpm --filter @contafly/web build && next start -p 3100) y corre: node apps/web/e2e/recorrido.cjs
const { chromium, devices } = require('playwright');
const path = require('node:path');
const OUT = path.resolve(__dirname, '../../../docs/capturas');
const B = process.env.WEB_URL ?? 'http://localhost:3100';
(async () => {
  const browser = await chromium.launch();
  const errores = [];
  async function contexto(opts) {
    const c = await browser.newContext({ ...opts, reducedMotion: 'reduce' });
    const p = await c.newPage();
    p.on('pageerror', (e) => errores.push(e.message));
    p.on('console', (m) => m.type() === 'error' && errores.push(m.text()));
    return p;
  }
  // Caso B en móvil
  const m = await contexto({ ...devices['iPhone 13'] });
  await m.goto(B, { waitUntil: 'networkidle' });
  await m.screenshot({ path: `${OUT}/01-entrada-movil.png` });
  await m.getByLabel('Tu número de WhatsApp').fill('55 1234 5678');
  await m.getByRole('checkbox').check();
  await m.getByRole('button', { name: 'Conectar mi WhatsApp' }).click();
  await m.locator('main').getByText('Conectado').waitFor();
  await m.goto(`${B}/caso-b`, { waitUntil: 'networkidle' });
  await m.locator('main').getByText('Vence el martes 17 de noviembre. Faltan 4 días.').waitFor();
  const monto = await m.locator('.monto').innerText();
  console.log('monto caso B:', monto);
  await m.screenshot({ path: `${OUT}/02-caso-b-inicio.png` });
  await m.getByRole('button', { name: 'Ver desglose del mes' }).click();
  await m.screenshot({ path: `${OUT}/03-caso-b-desglose.png` });
  await m.getByRole('button', { name: 'Cerrar', exact: true }).first().click();
  await m.getByRole('button', { name: 'Confirmar y presentar' }).click();
  await m.getByRole('button', { name: 'Confirmar con tu huella o tu cara' }).click();
  await m
    .getByRole('dialog')
    .getByText('Presentamos tu declaración de octubre')
    .waitFor({ timeout: 10000 });
  await m.locator('.notificacion').waitFor({ timeout: 5000 });
  console.log('notificación:', await m.locator('.notificacion').innerText());
  await m.screenshot({ path: `${OUT}/04-caso-b-exito.png` });
  await m.getByRole('button', { name: 'Ver documentos' }).click();
  await m.screenshot({ path: `${OUT}/05-caso-b-documentos.png` });
  await m.getByRole('button', { name: 'Movimientos' }).click();
  await m.screenshot({ path: `${OUT}/06-caso-b-movimientos.png` });

  // Caso A en móvil
  await m.goto(`${B}/caso-a`, { waitUntil: 'networkidle' });
  await m.screenshot({ path: `${OUT}/07-caso-a-diagnostico.png`, fullPage: true });
  await m.getByRole('button', { name: 'Revisar mi situación en el SAT' }).click();
  await m.getByPlaceholder('XAXX010101000').fill('ABCD');
  await m.getByPlaceholder('Cualquier texto').fill('secreto');
  await m.screenshot({ path: `${OUT}/08-caso-a-sat.png` });
  await m.getByRole('button', { name: 'Entrar' }).click();
  await m.locator('main').getByText('Lo que encontramos').waitFor({ timeout: 8000 });
  await m.screenshot({ path: `${OUT}/09-caso-a-hallazgos.png` });
  await m.getByRole('button', { name: 'Ver cálculo por mes' }).click();
  await m.screenshot({ path: `${OUT}/10-caso-a-calculo.png`, fullPage: true });
  await m.getByRole('button', { name: 'Ver mi plan' }).click();
  console.log('plan:', await m.locator('.monto').innerText());
  await m.screenshot({ path: `${OUT}/11-caso-a-plan.png` });
  await m.getByRole('button', { name: 'Ponerme al corriente' }).click();
  await m
    .locator('main')
    .getByRole('heading', { name: 'Ya estás al corriente' })
    .waitFor({ timeout: 10000 });
  await m.locator('.notificacion').waitFor({ timeout: 5000 });
  await m.screenshot({ path: `${OUT}/12-caso-a-exito.png` });

  // Escritorio: modo presentación
  const d = await contexto({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await d.goto(`${B}/caso-b`);
  await d.locator('main').getByText('Faltan 4 días').waitFor();
  await d.screenshot({ path: `${OUT}/13-escritorio-caso-b.png` });
  await d.goto(B);
  await d.screenshot({ path: `${OUT}/14-escritorio-entrada.png` });
  // Oscuro
  const o = await contexto({ ...devices['iPhone 13'], colorScheme: 'dark' });
  await o.goto(`${B}/caso-b`);
  await o.locator('main').getByText('Faltan 4 días').waitFor();
  await o.screenshot({ path: `${OUT}/15-caso-b-oscuro.png` });
  console.log('errores:', JSON.stringify(errores));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
