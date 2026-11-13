// Genera src/logos.ts con los SVG como cadenas para usarlos en web y en PDFs.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');
const nombres = ['logo_completo', 'logo_texto', 'logo_simbolo', 'logo_icono'];
const camel = (s) => s.replace(/_(\w)/g, (_, c) => c.toUpperCase());
let salida = '// Archivo generado por scripts/generar-logos.mjs. No editar a mano.\n';
for (const n of nombres) {
  const svg = readFileSync(join(raiz, 'logos', `${n}.svg`), 'utf8').trim();
  salida += `export const ${camel(n)} = ${JSON.stringify(svg)};\n`;
}
writeFileSync(join(raiz, 'logos.ts'), salida);
