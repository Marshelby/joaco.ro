"""Pruebas adicionales; destino Docker fijo y exclusivamente aislado."""
from pathlib import Path
import subprocess,json,time,uuid
ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'artifacts/fase1'
CMD=['docker','exec','-i','supabase_db_hidro-validacion-20261022','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-At']
def sql(s): return subprocess.run(CMD,input=s,text=True,capture_output=True)
def checked(name,s):
 r=sql(s);(OUT/(name+'.log')).write_text(r.stdout+r.stderr);assert r.returncode==0,r.stderr;return r.stdout
(OUT/'adicionales.json').write_text('{"estado":"EN EJECUCION"}')
admin='11111111-1111-4111-8111-111111111111'
def auth(role='authenticated'):
 return f"select set_config('request.jwt.claim.sub','{admin}',true);select set_config('request.jwt.claim.role','{role}',true);select set_config('request.jwt.claims','{{\"role\":\"{role}\",\"sub\":\"{admin}\"}}',true);set local role {role};"
d=json.loads(checked('fixture-adicional',"select datos from auditoria_local.fixtures_fase1 where caso like '%editar-editar' order by caso desc limit 1;"))
def run_pair(name,a_sql,b_sql,expect=None):
 a=subprocess.Popen(CMD,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 a.stdin.write(a_sql);a.stdin.close();a.stdin=None
 for _ in range(100):
  p=sql("select count(*) from pg_stat_activity where application_name='fase1_adicional_A' and wait_event='PgSleep';")
  if p.stdout.strip()=='1':break
  if a.poll() is not None:raise AssertionError(a.communicate())
  time.sleep(.03)
 else:raise AssertionError('No hubo solapamiento')
 t=time.monotonic();b=sql(b_sql);elapsed=time.monotonic()-t
 ao,ae=a.communicate(timeout=20)
 (OUT/(name+'-A.log')).write_text(ao+ae);(OUT/(name+'-B.log')).write_text(b.stdout+b.stderr)
 assert a.returncode==0,ae
 assert elapsed>1,elapsed
 if expect:assert b.returncode!=0 and expect in b.stderr,b.stderr
 else:assert b.returncode==0,b.stderr
 return elapsed
key=str(uuid.uuid4())
reg=f"public.registrar_posible_pedido_whatsapp('SINTETICO','900000001','{d['fecha']}',null,'[{{\"presentacion_id\":\"{d['presentacion']}\",\"cantidad\":1}}]','{key}',repeat('a',64))"
a=f"begin;set local application_name='fase1_adicional_A';{auth('service_role')} select {reg};select pg_sleep(4);commit;"
b=f"begin;{auth('service_role')} select {reg};commit;"
e1=run_pair('registro-simultaneo',a,b)
checked('registro-simultaneo-verificacion',f"""do $$ begin
 assert (select count(*)=1 from posibles_pedidos where clave_idempotencia='{key}');
 assert (select count(*)=1 from historial_posibles_pedidos h join posibles_pedidos p on p.id=h.posible_pedido_id where p.clave_idempotencia='{key}');
 assert (select pedido_oficial_id is null and cliente_id is null from posibles_pedidos where clave_idempotencia='{key}');
end $$;""")
# Corte real tras esperar catálogo. Se usa un corte temporal próximo para no alterar el reloj.
# A revierte calendario y lock; B conserva el corte corto confirmado por setup.
checked('corte-guardar',"create table if not exists auditoria_local.calendario_fase1 as select * from public.dias_entrega;")
checked('corte-configurar',"update public.dias_entrega set activo=true,dias_anticipacion_corte=0,hora_corte=((clock_timestamp() at time zone 'America/Santiago')+interval '4 seconds')::time;")
a=f"begin;set local application_name='fase1_adicional_A';select 1 from productos where id=(select producto_id from presentaciones_producto where id='{d['presentacion']}') for update;select pg_sleep(7);rollback;"
b=f"begin;do $$ begin assert public.fecha_entrega_disponible((clock_timestamp() at time zone 'America/Santiago')::date,clock_timestamp()); end $$; {auth()} select clock_timestamp() as antes_de_esperar; select public.convertir_posible_pedido_administrativo('{d['id']}',3,gen_random_uuid(),'{d['direccion']}',(clock_timestamp() at time zone 'America/Santiago')::date,array['efectivo']);commit;"
try:
 e2=run_pair('corte-tras-lock',a,b,'FECHA_ENTREGA_NO_DISPONIBLE')
 checked('corte-tras-lock-verificacion',f"do $$ begin assert (select version=3 and pedido_oficial_id is null from posibles_pedidos where id='{d['id']}'); assert not exists(select 1 from pedidos where cliente_id='{d['cliente']}'); end $$;")
finally:
 checked('corte-restaurar',"update public.dias_entrega d set activo=c.activo,hora_corte=c.hora_corte,dias_anticipacion_corte=c.dias_anticipacion_corte from auditoria_local.calendario_fase1 c where c.dia_semana=d.dia_semana;")
(OUT/'adicionales.json').write_text(json.dumps([dict(caso='doble registro simultáneo',resultado='PASÓ',espera=e1),dict(caso='corte real tras lock catálogo',resultado='PASÓ',espera=e2)],indent=2,ensure_ascii=False))
print('REGISTRO SIMULTÁNEO Y CORTE TRAS LOCK PASARON')
