# Despliegue

## Servicios

| Servicio | Railway | Comando de build | Comando de inicio |
|---|---|---|---|
| `api` | servicio Node 22 desde la raíz del repo | `pnpm install --frozen-lockfile && pnpm --filter @contafly/api... build` | `pnpm --filter @contafly/api start` |
| `web` | servicio Node 22 desde la raíz del repo | `pnpm install --frozen-lockfile && pnpm --filter @contafly/web... build` | `pnpm --filter @contafly/web start` |

Ambos se despliegan solos desde `main`. Railway asigna `PORT`; los dos servicios lo leen.

## Variables

Copia `.env.example`. Reparto:

- **web:** `DEMO_FECHA`, `PUBLIC_API_URL`, `PUBLIC_WEB_URL`, `DEMO_API_TOKEN`, `TWILIO_WHATSAPP_FROM`, `TWILIO_SANDBOX_JOIN_CODE`.
- **api:** todas las demás, más `DEMO_API_TOKEN` con el mismo valor que en web.

`SUPABASE_SERVICE_ROLE_KEY` y `TWILIO_AUTH_TOKEN` solo van en `api`. Nunca en variables `NEXT_PUBLIC_*`.

## Supabase

```bash
supabase link --project-ref <ref>
supabase db push
psql "$SUPABASE_DB_URL" -f supabase/seed.sql
```

Sin Supabase, la api guarda todo en memoria y sirve los PDFs con URLs firmadas que caducan en 10 minutos. Sirve para probar, pero se pierde al reiniciar.

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
