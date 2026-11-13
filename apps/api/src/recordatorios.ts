import cron from 'node-cron';
import type { Contador, TipoRecordatorio } from './servicios/contador.js';
import type { Repositorio } from './servicios/repositorio.js';

const POR_DIA: Record<number, TipoRecordatorio> = { 10: 'dia10', 15: 'dia15', 17: 'dia17' };

/** Revisa si hoy toca recordatorio y lo manda una sola vez por sesión. */
export async function correrRecordatorios(repo: Repositorio, contador: Contador, hoy: string) {
  const tipo = POR_DIA[Number(hoy.slice(8, 10))];
  if (!tipo) return 0;
  let enviados = 0;
  for (const s of await repo.sesionesActivas()) {
    if (!(await repo.registrarRecordatorio(s.id, tipo, hoy))) continue;
    try {
      await contador.recordatorio(s, tipo);
      enviados++;
    } catch {
      // Fuera de la ventana de 24 horas WhatsApp exige plantilla; se registra y se sigue.
      await repo.bitacora(s.id, 'recordatorio_fallido', { tipo });
    }
  }
  return enviados;
}

/** Todos los días a las 10:00 de la Ciudad de México. */
export function programarRecordatorios(repo: Repositorio, contador: Contador) {
  return cron.schedule(
    '0 10 * * *',
    () => {
      const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(
        new Date(),
      );
      void correrRecordatorios(repo, contador, hoy);
    },
    { timezone: 'America/Mexico_City' },
  );
}
