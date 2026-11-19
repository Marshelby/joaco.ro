-- Ejecutar manualmente como postgres después de gestion_administradores.sql.
-- Consultar los UUID vigentes para revisión, por ejemplo:
-- select p.usuario_id from public.perfiles p join auth.users u on u.id = p.usuario_id
-- where p.rol = 'admin' order by p.usuario_id;
-- Confirmar explícitamente la identidad de la cuenta administradora existente
-- antes de sustituir NULL por su UUID real entre comillas. No se asignan roles aquí.
begin;

lock table public.perfiles in share row exclusive mode;

do $$
declare
  confirmado constant uuid := null;
  existente uuid;
begin
  if confirmado is null then raise exception 'UUID_PRINCIPAL_SIN_CONFIRMAR'; end if;

  select usuario_id into existente from administracion_privada.administrador_principal;
  if existente is not null and existente <> confirmado then
    raise exception 'ADMINISTRADOR_PRINCIPAL_YA_CONFIGURADO';
  end if;

  if not exists (
    select 1 from public.perfiles p join auth.users u on u.id = p.usuario_id
    where p.usuario_id = confirmado and p.rol = 'admin'
  ) then
    raise exception 'UUID_NO_CORRESPONDE_A_UN_ADMINISTRADOR';
  end if;

  insert into administracion_privada.administrador_principal (usuario_id)
  values (confirmado) on conflict (unico) do nothing;
end;
$$;

commit;
