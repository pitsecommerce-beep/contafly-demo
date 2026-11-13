import { crearApp } from './app.js';

const puerto = Number(process.env.PORT ?? 4000);
const app = crearApp();
app.listen({ port: puerto, host: '0.0.0.0' }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
