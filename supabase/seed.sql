-- Semillas: las dos personas de ejemplo. RFC evidentemente ficticios.
-- Los periodos y comprobantes se generan desde packages/datos-demo (fase 2).
insert into public.personas_demo (slug, nombre, rfc_ficticio, apps, alta_regimen, opcion_pago_definitivo, buzon_habilitado)
values
  ('mariana', 'Mariana', 'XAXX010101DM1', array['mercado_libre', 'amazon'], '2026-07-01', false, false),
  ('luis', 'Luis', 'XAXX010101DL2', array['uber', 'didi'], '2025-01-01', false, true)
on conflict (slug) do nothing;
