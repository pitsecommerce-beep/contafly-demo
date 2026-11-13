# Contafly demo

Demo funcional de Contafly, el contador virtual para personas que cobran en apps y tributan en el Régimen de Plataformas Tecnológicas. Usa datos de ejemplo y nunca se conecta al SAT.

## Estructura

| Ruta | Qué es |
|---|---|
| `apps/web` | Interfaz (Next.js, PWA) |
| `apps/api` | Webhooks de Twilio, voz, PDFs y recordatorios (Fastify) |
| `packages/motor-fiscal` | Reglas fiscales puras y probadas |
| `packages/datos-demo` | Personas y comprobantes de ejemplo |
| `packages/agente` | Prompt y herramientas del contador virtual |
| `packages/ui` | Tokens de diseño y logos |
| `supabase/` | Migraciones, RLS y semillas |

## Requisitos

Node 22, pnpm 10 y [gitleaks](https://github.com/gitleaks/gitleaks#installing) para el hook de pre-commit.

## Comandos

```bash
pnpm install
pnpm dev        # web en :3000, api en :4000
pnpm test
pnpm lint && pnpm typecheck && pnpm build
```

Copia `.env.example` a `.env` y llena los valores. Nunca subas secretos al repositorio.

## Base de datos

```bash
supabase db reset   # aplica migraciones y supabase/seed.sql
```
