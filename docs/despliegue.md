# Despliegue

## Servicios

| Servicio | Railway | Comando de build | Comando de inicio |
|---|---|---|---|
| `api` | servicio Node 22 desde la raíz del repo | `pnpm install --frozen-lockfile && pnpm --filter @contafly/api... build` | `pnpm --filter @contafly/api start` |
| `web` | servicio Node 22 desde la raíz del repo | `pnpm install --frozen-lockfile && pnpm --filter @contafly/web... build` | `pnpm --filter @contafly/web start` |

Ambos se despliegan solos desde `main`. Railway asigna `PORT`; los dos servicios lo leen.

## Variables

Copia `.env.example`. Reparto:

- **web:** `DEMO_FECHA` y, si quieres que el contador use Claude, `ANTHROPIC_API_KEY` y `ANTHROPIC_MODEL`. Con eso basta para la demo completa.
- **web con Twilio real:** además `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `DEMO_API_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_SANDBOX_JOIN_CODE`.
- **api:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, las de Twilio, Anthropic y `DEMO_API_TOKEN` con el mismo valor que en web.

`TWILIO_AUTH_TOKEN` solo va en `api`. No se usa la llave de servicio de Supabase.

## Modo simulado (sin Twilio)

Si la web no encuentra una api con Twilio activo (`/salud` responde `whatsapp: "twilio"`), todo se simula en la página:

- En computadora, a la derecha aparece un WhatsApp de la demo; en el celular, un botón verde lo abre a pantalla completa.
- Al presentar, el PDF y el mensaje llegan a ese chat, y el teléfono muestra la notificación.
- "Que mi contador me llame" o escribir "márcame" abre una llamada simulada. La voz la pone el navegador (síntesis de voz en español) y, si el navegador lo permite, se puede responder hablando; si no, escribiendo.
- Con `ANTHROPIC_API_KEY` en web, el contador responde con Claude y las herramientas del motor. Sin llave, responde con reglas fijas y las mismas cifras.

Para la demo basta desplegar solo el servicio `web`.

## Supabase

Aplica las migraciones y las semillas desde el SQL Editor (o con `supabase db push`): `supabase/migrations/*.sql` en orden y después `supabase/seed.sql`.

La api solo necesita la URL y la llave anon. Las tablas tienen RLS sin políticas de escritura; la llave anon únicamente puede ejecutar las funciones `demo_*`, que escriben con validaciones y no devuelven conversaciones. Los PDFs no se guardan: la URL firmada (10 minutos) lleva los datos y la api los regenera con el motor.

Sin Supabase, la api guarda todo en memoria.

## Webhooks de Twilio

Con `PUBLIC_API_URL=https://<api>.up.railway.app`:

1. **WhatsApp Sandbox** (Console, Messaging, Try it out, Send a WhatsApp message, Sandbox settings):
   - "When a message comes in": `https://<api>.up.railway.app/twilio/whatsapp`, método `POST`.
2. **Remitente aprobado** (cuando exista): en el remitente de WhatsApp, el mismo webhook.
3. **Voz** (fase 5): `https://<api>.up.railway.app/twilio/voz`.

La api valida `X-Twilio-Signature` contra `PUBLIC_API_URL` + ruta. Si `PUBLIC_API_URL` no coincide exactamente con la URL configurada en Twilio (incluido `https` y sin `/` final), todas las peticiones se rechazan con 403.

## Verificación rápida

```bash
curl https://<api>.up.railway.app/salud
```

Debe responder `whatsapp: "twilio"` y `contador: true` cuando las llaves estén puestas.
