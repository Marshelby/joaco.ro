-- Solo Hidro Leufú gxmkrerhuuzeeupjliap. Requiere migraciones de octubre previas.
-- Reemplaza CAPTCHA/HMAC externos por cuotas globales conservadoras en PostgreSQL.
-- No abre tablas, no modifica RLS ni checkout; no crea pedidos oficiales ni deuda.
begin;
create or replace function public.consumir_limite_posibles_pedidos(p_origen_hash text, p_telefono_hash text)
returns boolean language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_ahora timestamptz; v_claves text[];
  v_duraciones integer[] := array[3600,600,3600]; v_maximos integer[] := array[300,10,5];
  v_indice integer; v_cantidad integer; v_ventana bigint;
begin
  if p_origen_hash is null or p_origen_hash !~ '^[a-f0-9]{64}$'
    or p_telefono_hash is null or p_telefono_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'HUELLA_INVALIDA';
  end if;
  -- Fijar la ventana después de esperar, también al cruzar un cambio de hora.
  perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
  v_ahora := clock_timestamp();
  delete from public.limites_posibles_pedidos where expira_en < v_ahora;
  v_claves := array['global','origen:'||p_origen_hash,'telefono:'||p_telefono_hash];
  -- Orden fijo global/origen/teléfono. ON CONFLICT serializa cada contador.
  for v_indice in 1..3 loop
    v_ventana := floor(extract(epoch from v_ahora)/v_duraciones[v_indice])::bigint;
    insert into public.limites_posibles_pedidos as l(clave,ventana,cantidad,expira_en)
      values(v_claves[v_indice],v_ventana,1,to_timestamp((v_ventana+1)*v_duraciones[v_indice]))
      on conflict(clave,ventana) do update set cantidad=l.cantidad+1
        where l.cantidad < v_maximos[v_indice]
      returning cantidad into v_cantidad;
    if not found then return false; end if;
  end loop;
  return true;
end;
$$;
alter function public.consumir_limite_posibles_pedidos(text,text) owner to postgres;
revoke all on function public.consumir_limite_posibles_pedidos(text,text) from public, anon, authenticated, service_role;

create or replace function public.registrar_posible_pedido_whatsapp(
  p_nombre text, p_telefono text, p_fecha date, p_observaciones text,
  p_items jsonb, p_clave_idempotencia uuid, p_secreto_reintento text
)
returns jsonb language plpgsql security definer set search_path = pg_catalog as $$
declare
  v_nombre text := btrim(p_nombre); v_telefono text; v_obs text := nullif(btrim(p_observaciones), '');
  v_items jsonb; v_item jsonb; v_linea jsonb; v_lineas jsonb := '[]'::jsonb;
  v_huella bytea; v_secreto bytea; v_p public.posibles_pedidos%rowtype;
  v_subtotal numeric := 0; v_despacho bigint; v_id uuid := gen_random_uuid(); v_orden integer := 0;
  v_respuesta jsonb; v_momento timestamptz;
begin
  -- La ACL permite registro público; no expone helpers ni operaciones administrativas.
  if v_nombre is null or char_length(v_nombre) not between 1 and 160
    or char_length(coalesce(v_obs, '')) > 2000 or p_fecha is null or not isfinite(p_fecha)
    or p_clave_idempotencia is null or p_secreto_reintento is null
    or p_secreto_reintento !~ '^[0-9a-f]{64}$' then raise exception 'SOLICITUD_INVALIDA'; end if;
  if p_telefono is null or char_length(p_telefono) > 40 or p_telefono !~ '^\+?[0-9 ()-]+$' then raise exception 'TELEFONO_INVALIDO'; end if;
  v_telefono := regexp_replace(p_telefono, '[^0-9]', '', 'g');
  if v_telefono ~ '^9[0-9]{8}$' then v_telefono := '56' || v_telefono; end if;
  if v_telefono !~ '^569[0-9]{8}$' then raise exception 'TELEFONO_INVALIDO'; end if;
  v_items := public.pp_normalizar_items(p_items);
  v_huella := public.pp_huella(jsonb_build_object('nombre', v_nombre, 'telefono', v_telefono,
    'fecha', p_fecha, 'observaciones', v_obs, 'items', v_items));
  v_secreto := sha256(convert_to(p_secreto_reintento, 'UTF8'));
  -- Puerta común con cuotas y administración: siempre ANTES de advisory de
  -- idempotencia y de filas. Evita ciclos incluso con claves cruzadas de reintento.
  perform pg_advisory_xact_lock(hashtextextended('posibles-pedidos:cuotas', 0));
  -- Serializa incluso cuando todavía no existe la fila. Una colisión de hash
  -- solo serializa solicitudes distintas; la unicidad sigue siendo del UUID.
  perform pg_advisory_xact_lock(hashtextextended('posible-pedido:' || p_clave_idempotencia::text, 0));
  select p.* into v_p from public.posibles_pedidos p where p.clave_idempotencia = p_clave_idempotencia for update;
  if found then
    if v_p.secreto_reintento_hash <> v_secreto or v_p.huella_solicitud <> v_huella then
      raise exception 'REINTENTO_INVALIDO';
    end if;
    select h.cambios -> 'respuesta_original' into v_respuesta from public.historial_posibles_pedidos h
      where h.posible_pedido_id = v_p.id and h.evento = 'registro' and h.version_resultante = 1;
    if v_respuesta is null then raise exception 'REGISTRO_INCONSISTENTE'; end if;
    return v_respuesta;
  end if;
  -- Cuotas persistentes dentro de la misma transacción, antes de consultar catálogo.
  -- 300 altas/h globales y 5/h por teléfono normalizado. La ventana de
  -- 10/10 minutos se agrupa por teléfono, nunca por una clave común a clientes.
  -- No depende de IP/headers manipulables ni persiste teléfonos en las cuotas.
  -- Los reintentos autenticados por secreto no consumen otra alta.
  if not public.consumir_limite_posibles_pedidos(
    encode(sha256(convert_to(v_telefono, 'UTF8')), 'hex'),
    encode(sha256(convert_to(v_telefono, 'UTF8')), 'hex')) then
    raise exception 'LIMITE_SOLICITUDES';
  end if;
  -- Hora real después de esperar el bloqueo, no inicio de la transacción.
  perform 1 from public.dias_entrega d order by d.dia_semana for share;
  v_momento := clock_timestamp();
  if not exists (select 1 from public.pp_fechas_validas(v_momento) f where f.fecha = p_fecha)
    then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
  for v_item in select value from jsonb_array_elements(v_items) loop
    v_linea := public.pp_capturar_presentacion((v_item ->> 'presentacion_id')::uuid, (v_item ->> 'cantidad')::numeric);
    v_lineas := v_lineas || jsonb_build_array(v_linea);
    v_subtotal := v_subtotal + (v_linea ->> 'subtotal')::numeric;
  end loop;
  v_despacho := case when v_subtotal < 25000 then 2000 else 0 end;
  if v_subtotal + v_despacho > 9000000000000 then raise exception 'LIMITE_IMPORTE'; end if;
  if not exists (select 1 from public.pp_fechas_validas(clock_timestamp()) f where f.fecha = p_fecha)
    then raise exception 'FECHA_FUERA_DE_OPCIONES'; end if;
  -- Misma regla vigente del checkout, capturada explícitamente, no entrada pública.
  insert into public.posibles_pedidos (id, nombre_solicitante, telefono_contacto, fecha_entrega_solicitada,
    observaciones, subtotal_estimado, costo_entrega_estimado, total_estimado,
    umbral_despacho_gratis_snapshot, tarifa_despacho_snapshot, clave_idempotencia, huella_solicitud, secreto_reintento_hash)
  values (v_id, v_nombre, v_telefono, p_fecha, v_obs, v_subtotal::bigint, v_despacho,
    (v_subtotal + v_despacho)::bigint, 25000, 2000, p_clave_idempotencia, v_huella, v_secreto)
  returning * into v_p;
  for v_linea in select value from jsonb_array_elements(v_lineas) loop
    v_orden := v_orden + 1;
    perform public.pp_insertar_linea(v_id, v_linea, v_orden);
  end loop;
  v_respuesta := jsonb_build_object('codigo', v_p.codigo_publico, 'fecha_solicitada', p_fecha,
    'subtotal', v_subtotal, 'despacho', v_despacho, 'total', v_subtotal + v_despacho,
    'moneda', 'CLP', 'estado', 'registrado', 'items', (
      select jsonb_agg(jsonb_build_object('producto', e.value ->> 'nombre_producto',
        'presentacion', e.value ->> 'nombre_presentacion', 'unidad', e.value ->> 'unidad',
        'cantidad', e.value -> 'cantidad', 'precio_unitario', e.value -> 'precio_venta',
        'subtotal', e.value -> 'subtotal') order by e.orden)
      from jsonb_array_elements(v_lineas) with ordinality e(value, orden)));
  insert into public.historial_posibles_pedidos (posible_pedido_id, clave_operacion, evento, version_resultante, cambios)
  values (v_id, p_clave_idempotencia, 'registro', 1, jsonb_build_object('respuesta_original', v_respuesta));
  return v_respuesta;
end;
$$;

alter function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) owner to postgres;
revoke all on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) from public, anon, authenticated, service_role;
grant execute on function public.registrar_posible_pedido_whatsapp(text,text,date,text,jsonb,uuid,text) to anon, authenticated;
commit;
