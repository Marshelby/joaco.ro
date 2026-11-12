-- Instalación MANUAL. No ejecutado por el agente.
-- Depende de entrega contrato 2 y su historial operativo. No cambia ventas,
-- pagos, ACL de tablas, preparación ni funciones de escritura existentes.
begin;
create or replace function public.consultar_resultado_entrega(
 p_pedido_id uuid, p_version_esperada bigint, p_clave uuid,
 p_items jsonb, p_cobro jsonb, p_diferencias boolean
) returns jsonb language plpgsql security definer set search_path=pg_catalog as $$
declare
 h operativo_privado.historial_operativo%rowtype;
 e operativo_privado.entregas_definitivas%rowtype;
 op text := case when p_diferencias then 'entrega_hubo_diferencias' else 'entrega_todo_correcto' end;
 s jsonb := jsonb_build_object('items',p_items,'cobro',p_cobro,'contrato',2);
begin
 if auth.uid() is null or not coalesce(public.es_admin(),false) then raise exception 'NO_AUTORIZADO'; end if;
 if p_clave is null or p_version_esperada is null or p_version_esperada<0 or p_diferencias is null then raise exception 'OPERACION_INVALIDA'; end if;
 -- Solo lectura; el historial aparece junto con venta y pagos al COMMIT.
 select * into h from operativo_privado.historial_operativo
 where pedido_id=p_pedido_id and clave_idempotencia=p_clave;
 if found then
  if h.actor_id is distinct from auth.uid() or h.operacion is distinct from op
   or h.version_esperada is distinct from p_version_esperada or h.solicitud is distinct from s then
   raise exception 'CLAVE_IDEMPOTENCIA_EN_USO';
  end if;
  return jsonb_build_object('confirmada',true,'misma_solicitud',true,'resultado',h.resultado);
 end if;
 select * into e from operativo_privado.entregas_definitivas where pedido_id=p_pedido_id;
 if not found then return jsonb_build_object('confirmada',false); end if;
 -- Otro operador/solicitud: informar el hecho persistido sin atribuirle el cobro
 -- solicitado ahora. No reconstruir saldo ni revelar el payload de otro actor.
 if exists(select 1 from public.pedidos p where p.id=e.pedido_id and p.estado='entregado'
   and p.venta_definitiva_snapshot is not null)
  and exists(select 1 from operativo_privado.cobros_entrega c where c.pedido_id=e.pedido_id) then
  return jsonb_build_object('confirmada',true,'misma_solicitud',false);
 end if;
 raise exception 'ENTREGA_PERSISTIDA_INCONSISTENTE';
end; $$;
alter function public.consultar_resultado_entrega(uuid,bigint,uuid,jsonb,jsonb,boolean) owner to postgres;
revoke all on function public.consultar_resultado_entrega(uuid,bigint,uuid,jsonb,jsonb,boolean) from public,anon,authenticated,service_role;
grant execute on function public.consultar_resultado_entrega(uuid,bigint,uuid,jsonb,jsonb,boolean) to authenticated;
notify pgrst, 'reload schema';
commit;
