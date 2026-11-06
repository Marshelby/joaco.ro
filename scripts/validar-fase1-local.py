"""Validación exclusiva del contenedor aislado; nunca acepta URL remota."""
from pathlib import Path
import subprocess, hashlib, json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/fase1'; OUT.mkdir(parents=True,exist_ok=True)
CMD=['docker','exec','-i','supabase_db_hidro-validacion-20261022','psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1']
def sql(s):
    return subprocess.run(CMD,input=s,text=True,capture_output=True)
def save(name,r):
    (OUT/name).write_text(r.stdout+r.stderr)
    print(name,r.returncode, r.stderr[-2500:])
r=sql("select nombre || '|' || sha256 from auditoria_local.migraciones order by nombre;")
assert r.returncode==0,r.stderr
applied=dict(line.strip().split('|') for line in r.stdout.splitlines() if '.sql|' in line)
local={p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'supabase/migrations').glob('*.sql')}
assert applied==local, 'Historial y archivos difieren'
(OUT/'migraciones.json').write_text(json.dumps(local,indent=2))
admin='11111111-1111-4111-8111-111111111111'
r=sql(f"begin; insert into auth.users(id,raw_user_meta_data) values('{admin}','{{}}') on conflict do nothing; update perfiles set rol='admin',nombre='ADMIN SINTETICO FASE1' where usuario_id='{admin}'; commit;")
save('fixture-admin.log',r); assert r.returncode==0
s=(ROOT/'supabase/tests/posibles_pedidos.sql').read_text().replace('begin;','begin;\nset local app.hidro_test_aislado=si;',1)
r=sql("\\set admin_uuid '"+admin+"'\n"+s)
save('secuenciales.log',r)
assert r.returncode==0, r.stderr
import sys
if '--solo-secuenciales' in sys.argv: raise SystemExit(0)
# Cada carrera conserva su fixture sintética identificada para auditoría local.
import time, uuid
admin_b='22222222-2222-4222-8222-222222222222'
r=sql(f"insert into auth.users(id,raw_user_meta_data) values('{admin_b}','{{}}') on conflict do nothing; update perfiles set rol='admin',nombre='ADMIN B SINTETICO' where usuario_id='{admin_b}'; create table if not exists auditoria_local.fixtures_fase1(caso text primary key,datos jsonb);")
assert r.returncode==0,r.stderr
base=(ROOT/'supabase/tests/posibles_pedidos.sql').read_text()
prefix=base.split('  -- ACL efectiva:')[0]
prefix=prefix.replace('begin;','begin;\nset local app.hidro_test_aislado=si;',1)
def auth(who):
    return f"select set_config('request.jwt.claim.sub','{who}',true); select set_config('request.jwt.claim.role','authenticated',true); select set_config('request.jwt.claims','{{\"role\":\"authenticated\",\"sub\":\"{who}\"}}',true); set local role authenticated;"
def fixture(case):
    tail=f"""
  v_resultado:=public.asociar_cliente_posible_pedido(v_id,1,gen_random_uuid(),v_cliente);
  execute 'reset role';
  insert into auditoria_local.fixtures_fase1 values('{case}',jsonb_build_object('id',v_id,'item',v_item,'cliente',v_cliente,'direccion',v_direccion,'fecha',v_fecha,'presentacion',v_presentacion));
end; $pruebas$; set constraints all immediate; commit;
"""
    r=sql("\\set admin_uuid '"+admin+"'\n"+prefix+tail);save(case+'-fixture.log',r);assert r.returncode==0,r.stderr
    r=sql(f"select datos from auditoria_local.fixtures_fase1 where caso='{case}';")
    return json.loads(next(x for x in r.stdout.splitlines() if x.strip().startswith('{')))
def call(d,op):
    if op=='convertir': return f"public.convertir_posible_pedido_administrativo('{d['id']}',2,gen_random_uuid(),'{d['direccion']}','{d['fecha']}',array['efectivo'])"
    if op=='editar': return f"public.editar_posible_pedido_administrativo('{d['id']}',2,gen_random_uuid(),'[{{\"item_id\":\"{d['item']}\",\"cantidad\":3}}]')"
    if op=='descartar': return f"public.descartar_posible_pedido('{d['id']}',2,gen_random_uuid(),'TEST CARRERA')"
    if op=='precio': return f"public.autorizar_precio_posible_pedido('{d['id']}',2,gen_random_uuid(),'{d['item']}',900,1100,'TEST CARRERA')"
results=[]
run_id=uuid.uuid4().hex[:8]
for label,op_a,op_b,rollback,expected in [
 ('convertir-convertir','convertir','convertir',False,None),
 ('convertir-rollback','convertir','convertir',True,None),
 ('editar-editar','editar','editar',False,'POSIBLE_PEDIDO_DESACTUALIZADO'),
 ('editar-convertir','editar','convertir',False,'POSIBLE_PEDIDO_DESACTUALIZADO'),
 ('descartar-convertir','descartar','convertir',False,'POSIBLE_PEDIDO_CERRADO'),
 ('precio-editar','precio','editar',False,'POSIBLE_PEDIDO_DESACTUALIZADO')]:
    case=run_id+'-'+label;d=fixture(case)
    # A bloquea la cabecera. Se espera la señal observable de pg_sleep antes de lanzar B.
    a_sql=f"begin; set local application_name='fase1_carrera_A'; {auth(admin)} select {call(d,op_a)}; select pg_sleep(3); {'rollback' if rollback else 'commit'};"
    a=subprocess.Popen(CMD,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);a.stdin.write(a_sql);a.stdin.close();a.stdin=None
    for _ in range(50):
        probe=sql("select count(*) from pg_stat_activity where application_name='fase1_carrera_A' and wait_event='PgSleep';")
        if '\n     1\n' in probe.stdout: break
        if a.poll() is not None: raise AssertionError(a.communicate())
        time.sleep(.05)
    else: raise AssertionError('A no llegó a mantener el lock')
    started=time.monotonic();b=sql(f"begin; set local lock_timeout='10s'; {auth(admin_b)} select {call(d,op_b)}; commit;");elapsed=time.monotonic()-started
    ao,ae=a.communicate(timeout=15)
    (OUT/(case+'-A.log')).write_text(ao+ae);save(case+'-B.log',b)
    assert a.returncode==0,ae
    assert elapsed>1, 'No se observó espera concurrente'
    if expected: assert b.returncode!=0 and expected in b.stderr,b.stderr
    else: assert b.returncode==0,b.stderr
    # Registro + asociación + una operación confirmada = tres eventos.
    verify=sql(f"""do $$ begin
      assert (select version=3 from posibles_pedidos where id='{d['id']}');
      assert (select count(*)={1 if op_b=='convertir' and not expected else 0} from pedidos where cliente_id='{d['cliente']}');
      assert (select count(*)=3 from historial_posibles_pedidos where posible_pedido_id='{d['id']}');
    end $$;""")
    save(case+'-verificacion.log',verify);assert verify.returncode==0,verify.stderr
    results.append(dict(caso=label,resultado='PASÓ',espera_segundos=round(elapsed,2)))
(OUT/'concurrencia.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
print('SEIS CARRERAS PASARON')
