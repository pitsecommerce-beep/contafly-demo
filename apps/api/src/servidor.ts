import { crearApp } from './app.js';
import { leerConfig } from './config.js';
import { programarRecordatorios } from './recordatorios.js';
import { FirmadorDocumentos } from './servicios/almacen.js';
import { Contador, clienteAnthropic } from './servicios/contador.js';
import { LlamadorNoDisponible } from './servicios/llamadas.js';
import { RepositorioMemoria, RepositorioSupabaseAnon } from './servicios/repositorio.js';
import { EnviadorSimulado, EnviadorTwilio } from './servicios/whatsapp.js';

const config = leerConfig();
const puerto = Number(process.env.PORT ?? 4000);
const baseUrl = config.publicApiUrl ?? `http://localhost:${puerto}`;

const repo = config.supabase
  ? new RepositorioSupabaseAnon(config.supabase.url, config.supabase.anonKey)
  : new RepositorioMemoria();
const documentos = new FirmadorDocumentos(baseUrl, config.secretoUrls);
const whatsapp = config.twilio
  ? new EnviadorTwilio(
      config.twilio.accountSid,
      config.twilio.authToken,
      config.twilio.whatsappFrom,
    )
  : new EnviadorSimulado((m) => console.log(m));

const deps = {
  config,
  repo,
  documentos,
  whatsapp,
  llamador: new LlamadorNoDisponible(),
  anthropic: clienteAnthropic(config),
  esperar: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
  log: {
    info: (o: object | string, m?: string) =>
      console.log(m ?? '', typeof o === 'string' ? o : JSON.stringify(o)),
    error: (o: object | string, m?: string) =>
      console.error(m ?? '', typeof o === 'string' ? o : JSON.stringify(o)),
  },
};

const app = crearApp({ ...deps, tokenDemo: process.env.DEMO_API_TOKEN ?? null });
programarRecordatorios(repo, new Contador(deps));

app.listen({ port: puerto, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
