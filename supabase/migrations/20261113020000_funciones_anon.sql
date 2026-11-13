-- Acceso de la api con la llave anon.
-- Las tablas siguen cerradas por RLS. La llave anon solo puede ejecutar estas funciones
-- (SECURITY DEFINER), que escriben con validaciones y NUNCA devuelven conversaciones,
-- teléfonos ni documentos. Leer los datos queda reservado al panel de Supabase.

create or replace function public.demo_conectar(p_telefono text, p_persona text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_persona uuid;
  v_sesion uuid;
begin
  if p_telefono !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Teléfono inválido'; end if;
  select id into v_persona from personas_demo where slug = p_persona;
  if v_persona is null then raise exception 'Persona inválida'; end if;
  select id into v_sesion from sesiones_demo
    where telefono_e164 = p_telefono and borrado_at is null order by creado_at desc limit 1;
  if v_sesion is null then
    insert into sesiones_demo (telefono_e164, persona_id, consentimiento_at)
      values (p_telefono, v_persona, now()) returning id into v_sesion;
  else
    update sesiones_demo set persona_id = v_persona where id = v_sesion;
  end if;
  return v_sesion;
end;
$$;

-- Para el webhook entrante: devuelve solo el id y la persona, nada de la conversación.
create or replace function public.demo_sesion(p_telefono text)
returns table (id uuid, persona text)
language sql security definer set search_path = public stable as $$
  select s.id, p.slug from sesiones_demo s join personas_demo p on p.id = s.persona_id
  where s.telefono_e164 = p_telefono and s.borrado_at is null
  order by s.creado_at desc limit 1;
$$;

create or replace function public.demo_guardar_mensaje(p_sesion uuid, p_direccion text, p_cuerpo text, p_sid text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_direccion not in ('in', 'out') then raise exception 'Dirección inválida'; end if;
  insert into mensajes (sesion_id, direccion, cuerpo, twilio_sid)
    select p_sesion, p_direccion, left(p_cuerpo, 4000), left(p_sid, 64)
    where exists (select 1 from sesiones_demo where id = p_sesion and borrado_at is null);
end;
$$;

create or replace function public.demo_guardar_documento(p_sesion uuid, p_tipo text, p_ruta text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into documentos (sesion_id, tipo, ruta_storage)
    select p_sesion, p_tipo, left(p_ruta, 300)
    where exists (select 1 from sesiones_demo where id = p_sesion and borrado_at is null);
end;
$$;

create or replace function public.demo_registrar_recordatorio(p_sesion uuid, p_tipo text, p_fecha date)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  insert into recordatorios (sesion_id, tipo, programado_para, enviado_at)
    values (p_sesion, p_tipo, p_fecha + time '16:00', now());
  return true;
exception when unique_violation or foreign_key_violation then
  return false;
end;
$$;

create or replace function public.demo_registrar_llamada(p_sesion uuid, p_sid text, p_estado text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into llamadas (sesion_id, twilio_sid, estado)
    select p_sesion, left(p_sid, 64), left(p_estado, 32)
    where exists (select 1 from sesiones_demo where id = p_sesion);
end;
$$;

-- Suma uno y dice si sigue dentro del límite. El teléfono llega ya como hash.
create or replace function public.demo_consumir_cupo(p_hash text, p_canal text, p_fecha date, p_maximo int)
returns boolean
language plpgsql security definer set search_path = public as $$
declare v int;
begin
  if p_canal = 'llamadas' then
    insert into limites_uso (telefono_hash, fecha, llamadas) values (p_hash, p_fecha, 1)
      on conflict (telefono_hash, fecha) do update set llamadas = limites_uso.llamadas + 1
      returning llamadas into v;
  else
    insert into limites_uso (telefono_hash, fecha, mensajes) values (p_hash, p_fecha, 1)
      on conflict (telefono_hash, fecha) do update set mensajes = limites_uso.mensajes + 1
      returning mensajes into v;
  end if;
  return v <= p_maximo;
end;
$$;

create or replace function public.demo_bitacora(p_sesion uuid, p_evento text, p_detalle jsonb)
returns void
language sql security definer set search_path = public as $$
  insert into bitacora (sesion_id, evento, detalle) values (p_sesion, left(p_evento, 64), coalesce(p_detalle, '{}'::jsonb));
$$;

-- Borrar mis datos: requiere el id de sesión (uuid que solo conoce quien se conectó).
create or replace function public.demo_borrar(p_sesion uuid)
returns void
language sql security definer set search_path = public as $$
  delete from sesiones_demo where id = p_sesion;
$$;

-- Solo estas funciones quedan expuestas a anon
revoke execute on all functions in schema public from public;
grant execute on function
  public.demo_conectar(text, text),
  public.demo_sesion(text),
  public.demo_guardar_mensaje(uuid, text, text, text),
  public.demo_guardar_documento(uuid, text, text),
  public.demo_registrar_recordatorio(uuid, text, date),
  public.demo_registrar_llamada(uuid, text, text),
  public.demo_consumir_cupo(text, text, date, int),
  public.demo_bitacora(uuid, text, jsonb),
  public.demo_borrar(uuid)
to anon, authenticated;
