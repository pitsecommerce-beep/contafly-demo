// WhatsApp y llamada simulados en computadora y celular. Uso: node apps/web/e2e/whatsapp-simulado.cjs
const { chromium, devices } = require('playwright');
const path = require('node:path');
const OUT = path.resolve(__dirname, '../../../docs/capturas');
(async () => {
  const b = await chromium.launch();
  const errores = [];
  const d = await (
    await b.newContext({ viewport: { width: 1440, height: 940 }, reducedMotion: 'reduce' })
  ).newPage();
  d.on('pageerror', (e) => errores.push(e.message));
  await d.goto((process.env.WEB_URL ?? 'http://localhost:3100') + '/caso-b', {
    waitUntil: 'networkidle',
  });
  const wa = d.locator('.lateral .wa');
  await wa.getByText('Soy tu contador virtual').waitFor();
  await wa.getByRole('button', { name: '¿Por qué me retienen?' }).click();
  await wa.getByText(/te retienen 2\.1% de ISR/).waitFor({ timeout: 8000 });
  await d.locator('main').getByRole('button', { name: 'Confirmar y presentar' }).click();
  await d.getByRole('button', { name: 'Confirmar con tu huella o tu cara' }).click();
  await wa.locator('.wa-pdf').first().waitFor({ timeout: 12000 });
  await wa.getByText(/Listo, presentamos tu declaración de octubre/).waitFor({ timeout: 8000 });
  await d.waitForTimeout(1600);
  await d.screenshot({ path: `${OUT}/16-escritorio-whatsapp-simulado.png` });
  console.log('pdf href:', await wa.locator('.wa-pdf').first().getAttribute('href'));
  await wa.getByLabel('Escribe un mensaje').fill('márcame');
  await wa.getByRole('button', { name: 'Enviar' }).click();
  await wa.getByRole('button', { name: 'Contestar' }).waitFor({ timeout: 8000 });
  await d.screenshot({ path: `${OUT}/17-llamada-entrante.png` });
  await wa.getByRole('button', { name: 'Contestar' }).click();
  await wa.getByText(/Tu declaración de octubre está lista/).waitFor({ timeout: 8000 });
  await wa.getByLabel('Escribe tu pregunta').fill('¿por qué me retienen?');
  await wa.getByLabel('Escribe tu pregunta').press('Enter');
  await wa.locator('.llamada-yo').waitFor();
  await d.waitForTimeout(1500);
  await d.screenshot({ path: `${OUT}/18-llamada-activa.png` });
  await wa.getByRole('button', { name: 'Colgar' }).click();
  await wa.getByText(/Llamada de voz/).waitFor();
  console.log('después de colgar ok');
  // Móvil
  const m = await (
    await b.newContext({ ...devices['iPhone 13'], reducedMotion: 'reduce' })
  ).newPage();
  m.on('pageerror', (e) => errores.push(e.message));
  await m.goto((process.env.WEB_URL ?? 'http://localhost:3100') + '/caso-a', {
    waitUntil: 'networkidle',
  });
  await m.getByRole('button', { name: /Abrir WhatsApp/ }).click();
  await m.locator('.pantalla-wa').getByText('Hola, Mariana').waitFor();
  await m.locator('.pantalla-wa').getByRole('button', { name: '¿Cuánto pago este mes?' }).click();
  await m
    .locator('.pantalla-wa')
    .getByText(/Amazon te retuvo 1%/)
    .waitFor({ timeout: 8000 });
  await m.screenshot({ path: `${OUT}/19-movil-whatsapp-simulado.png` });
  console.log('errores:', JSON.stringify(errores));
  await b.close();
})().catch((e) => {
  console.error(e.message.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
});
