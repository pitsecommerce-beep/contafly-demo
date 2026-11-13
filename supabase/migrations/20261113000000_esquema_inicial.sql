-- Esquema inicial de la demo de Contafly.
-- Todos los datos son de ejemplo. RLS activado en todas las tablas.
-- El servicio api usa la llave de servicio (salta RLS) solo del lado del servidor.

create extension if not exists pgcrypto;

-- Personas de ejemplo ------------------------------------------------------
create table public.personas_demo (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('mariana', 'luis')),
  nombre text not null,
  rfc_ficticio text not null,
  apps text[] not null,
  regimen text not null default 'plataformas_tecnologicas',
  alta_regimen date not null,
  opcion_pago_definitivo boolean not null default false,
  buzon_habilitado boolean not null default false,
  creado_at timestamptz not null default now()
);

-- Sesiones de inversionistas -------------------------------------------------
create table public.sesiones_demo (
  id uuid primary key default gen_random_uuid(),
  telefono_e164 text check (telefono_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  persona_id uuid references public.personas_demo (id),
  consentimiento_at timestamptz,
  creado_at timestamptz not null default now(),
  borrado_at timestamptz,
  constraint consentimiento_si_hay_telefono
    check (telefono_e164 is null or consentimiento_at is not null)
);
create index sesiones_demo_telefono_idx on public.sesiones_demo (telefono_e164);

-- Periodos y comprobantes ----------------------------------------------------
create table public.periodos (
  id uuid primary key default gen_random_uuid(),
  persona_id uuid not null references public.personas_demo (id) on delete cascade,
  anio int not null check (anio between 2020 and 2100),
  mes int not null check (mes between 1 and 12),
  estado text not null check (estado in ('listo', 'ambar', 'rojo', 'presentado')),
  vence_el date not null,
  unique (persona_id, anio, mes)
);

create table public.comprobantes (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.periodos (id) on delete cascade,
  tipo text not null check (tipo in ('ingreso', 'gasto', 'retencion')),
  app text,
  concepto text not null,
  subtotal_cent bigint not null default 0,
  iva_cent bigint not null default 0,
  isr_ret_cent bigint not null default 0,
  iva_ret_cent bigint not null default 0,
  tasa_isr_leida numeric(6, 4),
  tasa_iva_leida numeric(6, 4)
);
create index comprobantes_periodo_idx on public.comprobantes (periodo_id);

-- Resultados del motor -------------------------------------------------------
create table public.calculos (
  id uuid primary key default gen_random_uuid(),
  periodo_id uuid not null references public.periodos (id) on delete cascade,
  sesion_id uuid references public.sesiones_demo (id) on delete cascade,
  metodo text not null check (metodo in ('definitivo', 'acumulado')),
  desglose jsonb not null,
  total_cent bigint not null,
  version_motor text not null,
  version_parametros text not null,
  creado_at timestamptz not null default now()
);

create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.sesiones_demo (id) on delete cascade,
  periodo_id uuid references public.periodos (id) on delete set null,
  tipo text not null check (tipo in ('acuse', 'linea_captura')),
  ruta_storage text not null,
  creado_at timestamptz not null default now()
);

-- Canales --------------------------------------------------------------------
create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid references public.sesiones_demo (id) on delete cascade,
  canal text not null default 'whatsapp' check (canal in ('whatsapp')),
  direccion text not null check (direccion in ('in', 'out')),
  twilio_sid text,
  cuerpo text,
  creado_at timestamptz not null default now()
);
create index mensajes_sesion_idx on public.mensajes (sesion_id, creado_at);

create table public.llamadas (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid references public.sesiones_demo (id) on delete cascade,
  twilio_sid text,
  estado text not null default 'iniciada',
  inicio timestamptz not null default now(),
  fin timestamptz,
  latencia_p50_ms int
);

create table public.recordatorios (
  id uuid primary key default gen_random_uuid(),
  sesion_id uuid not null references public.sesiones_demo (id) on delete cascade,
  tipo text not null check (tipo in ('dia10', 'dia15', 'dia17')),
  programado_para timestamptz not null,
  enviado_at timestamptz,
  unique (sesion_id, tipo, programado_para)
);

-- Límite de uso por número y día (teléfono guardado como hash) ----------------
create table public.limites_uso (
  telefono_hash text not null,
  fecha date not null,
  mensajes int not null default 0,
  llamadas int not null default 0,
  primary key (telefono_hash, fecha)
);

-- Bitácora de solo inserción -------------------------------------------------
create table public.bitacora (
  id bigint generated always as identity primary key,
  sesion_id uuid,
  evento text not null,
  detalle jsonb not null default '{}'::jsonb,
  creado_at timestamptz not null default now()
);

create function public.bitacora_solo_insercion() returns trigger
language plpgsql as $$
begin
  raise exception 'La bitácora es de solo inserción';
end;
$$;

create trigger bitacora_sin_cambios
  before update or delete on public.bitacora
  for each row execute function public.bitacora_solo_insercion();

-- RLS ------------------------------------------------------------------------
alter table public.personas_demo enable row level security;
alter table public.sesiones_demo enable row level security;
alter table public.periodos enable row level security;
alter table public.comprobantes enable row level security;
alter table public.calculos enable row level security;
alter table public.documentos enable row level security;
alter table public.mensajes enable row level security;
alter table public.llamadas enable row level security;
alter table public.recordatorios enable row level security;
alter table public.limites_uso enable row level security;
alter table public.bitacora enable row level security;

-- Lo único público: las personas, periodos y comprobantes de ejemplo.
create policy personas_lectura_publica on public.personas_demo for select to anon, authenticated using (true);
create policy periodos_lectura_publica on public.periodos for select to anon, authenticated using (true);
create policy comprobantes_lectura_publica on public.comprobantes for select to anon, authenticated using (true);
-- El resto no tiene políticas: solo la llave de servicio puede leer o escribir.

-- Storage: bucket privado para PDFs; se comparten con URLs firmadas de corta duración.
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;
