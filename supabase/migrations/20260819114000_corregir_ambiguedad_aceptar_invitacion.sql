-- C5: evita que la columna de salida cliente_id opaque la columna de la tabla al revocar invitaciones hermanas.

create or replace function public.aceptar_invitacion_acceso_cliente(p_token text)
returns table (cliente_id uuid, estado text, ya_aceptada boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_usuario_id uuid := auth.uid(); v_usuario auth.users%rowtype; v_perfil public.perfiles%rowtype;
  v_invitacion public.invitaciones_acceso_cliente%rowtype; v_cliente_b2b public.clientes%rowtype;
  v_cliente_actual public.clientes%rowtype; v_cliente_previo_id uuid := null; v_token_hash text;
begin
  if v_usuario_id is null then raise exception 'NO_AUTORIZADO'; end if;
  if p_token is null or btrim(p_token) !~ '^[a-f0-9]{64}$' then raise exception 'INVITACION_INVALIDA'; end if;
  select * into v_usuario from auth.users u where u.id = v_usuario_id for update;
  if not found or v_usuario.email is null or v_usuario.email_confirmed_at is null then raise exception 'CORREO_NO_VERIFICADO'; end if;
  select * into v_perfil from public.perfiles p where p.usuario_id = v_usuario_id for update;
  if not found or v_perfil.rol <> 'cliente' then raise exception 'NO_AUTORIZADO'; end if;
  v_token_hash := encode(extensions.digest(lower(btrim(p_token)), 'sha256'), 'hex');
  select * into v_invitacion from public.invitaciones_acceso_cliente i where i.token_hash = v_token_hash for update;
  if not found then raise exception 'INVITACION_INVALIDA'; end if;
  select * into v_cliente_b2b from public.clientes c where c.id = v_invitacion.cliente_id for update;
  if not found then raise exception 'CLIENTE_NO_ENCONTRADO'; end if;
  if v_invitacion.estado = 'aceptada' then
    if v_invitacion.aceptada_por = v_usuario_id and v_cliente_b2b.usuario_id = v_usuario_id then return query select v_cliente_b2b.id, 'aceptada', true; return; end if;
    raise exception 'INVITACION_NO_DISPONIBLE';
  end if;
  if v_invitacion.estado = 'revocada' then raise exception 'INVITACION_REVOCADA'; end if;
  if v_invitacion.estado = 'expirada' or v_invitacion.fecha_expiracion <= now() then raise exception 'INVITACION_EXPIRADA'; end if;
  if v_invitacion.estado <> 'pendiente' then raise exception 'INVITACION_NO_DISPONIBLE'; end if;
  if lower(v_usuario.email) <> v_invitacion.correo_destino then raise exception 'CORREO_NO_COINCIDE'; end if;
  if not v_cliente_b2b.activo then raise exception 'CLIENTE_INACTIVO'; end if;
  if v_cliente_b2b.usuario_id is not null then raise exception 'CLIENTE_YA_VINCULADO'; end if;
  select * into v_cliente_actual from public.clientes c where c.usuario_id = v_usuario_id for update;
  if found and v_cliente_actual.id <> v_cliente_b2b.id then
    if exists (select 1 from public.direcciones_cliente d where d.cliente_id = v_cliente_actual.id) or exists (select 1 from public.pedidos p where p.cliente_id = v_cliente_actual.id) or exists (select 1 from public.pagos p where p.cliente_id = v_cliente_actual.id) or exists (select 1 from public.ajustes_cuenta_cliente a where a.cliente_id = v_cliente_actual.id) then raise exception 'CUENTA_CLIENTE_EXISTENTE_CON_HISTORIAL'; end if;
    update public.clientes set usuario_id = null where id = v_cliente_actual.id; v_cliente_previo_id := v_cliente_actual.id;
  end if;
  update public.clientes set usuario_id = v_usuario_id where id = v_cliente_b2b.id;
  update public.invitaciones_acceso_cliente i set estado = 'revocada' where i.cliente_id = v_cliente_b2b.id and i.estado = 'pendiente' and i.id <> v_invitacion.id;
  update public.invitaciones_acceso_cliente i set estado = 'aceptada', fecha_aceptacion = now(), aceptada_por = v_usuario_id, cliente_previo_id = v_cliente_previo_id where i.id = v_invitacion.id;
  return query select v_cliente_b2b.id, 'aceptada', false;
end;
$$;

alter function public.aceptar_invitacion_acceso_cliente(text) owner to postgres;
