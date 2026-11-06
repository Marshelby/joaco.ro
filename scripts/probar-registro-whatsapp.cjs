// Pruebas sin red, servidor Next, Docker ni conexión a base de datos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const originalLoad = Module._load;
Module._load = function (name, parent, main) {
  if (name === 'server-only') return {};
  return originalLoad.call(this, name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : name, parent, main);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { registrarSolicitudHTTP } = require('../src/lib/posibles-pedidos/http.ts');
const { payloadSolicitud } = require('../src/lib/posibles-pedidos/contrato.ts');
const { obtenerIntento, guardarRespuesta, CLAVE_INTENTOS } = require('../src/lib/posibles-pedidos/intentos.ts');
const { enlaceSolicitud } = require('../src/lib/posibles-pedidos/mensaje.ts');
const config = require('../src/lib/posibles-pedidos/configuracion.ts');
const datos = { nombre: 'Prueba', telefono: '+56 9 1234 5678', fecha: '2026-11-02', observaciones: 'Localidad: Prueba',
  items: [{ presentacion_id: 'abcdefab-1234-4123-8123-abcdefabcdef', cantidad: 2 }] };
const payload = { ...datos, claveIdempotencia: '12345678-1234-4123-8123-123456789abc', secretoReintento: 'a'.repeat(64) };
const respuesta = { codigo: `PP-${'b'.repeat(32)}`, fecha_solicitada: datos.fecha, subtotal: 4000, despacho: 2000, total: 6000,
  moneda: 'CLP', estado: 'registrado', items: [{ producto: 'Agua', presentacion: 'Bidón', unidad: 'un', cantidad: 2, precio_unitario: 2000, subtotal: 4000 }] };
function request(body = JSON.stringify(payload), headers = {}) {
  return new Request('https://hidro.test/api/posibles-pedidos', { method: 'POST', headers: { origin: 'https://hidro.test', 'content-type': 'application/json', ...headers }, body });
}
test('HTTP: rechazos locales no llegan al registro', async () => {
  let llamadas = 0;
  const deps = { registrar: async () => { llamadas++; return { data: respuesta, error: null }; } };
  for (const [req, status] of [[request(undefined, { origin: 'https://otro.test' }), 403], [request(undefined, { 'sec-fetch-site': 'cross-site' }), 403],
    [request(undefined, { 'content-type': 'text/plain' }), 415], [request('{'), 400], [request('x'.repeat(49153)), 413],
    [request(JSON.stringify({ ...payload, precio: 1 })), 400]]) assert.equal((await registrarSolicitudHTTP(req, deps)).status, status);
  assert.equal(llamadas, 0);
});
test('HTTP: registro normalizado y respuesta comercial sin secretos', async () => {
  const res = await registrarSolicitudHTTP(request(), { registrar: async (p) => {
    assert.equal(p.telefono, '56912345678');
    return { data: { ...respuesta, secreto: 'privado' }, error: null };
  } });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await res.json(), { solicitud: respuesta });
});
test('HTTP: cuotas, conflictos, fallos y respuesta inválida', async () => {
  for (const [message, status] of [['LIMITE_SOLICITUDES', 429], ['REINTENTO_INVALIDO', 409], ['FECHA_FUERA_DE_OPCIONES', 409], ['PRODUCTO_NO_DISPONIBLE', 400], ['detalle privado', 503]]) {
    const res = await registrarSolicitudHTTP(request(), { registrar: async () => ({ data: null, error: { message } }) });
    assert.equal(res.status, status);
    if (status === 429) assert.equal(res.headers.get('retry-after'), '600');
    assert.ok(!(await res.text()).includes('detalle privado'));
  }
  assert.equal((await registrarSolicitudHTTP(request(), { registrar: async () => ({ data: {}, error: null }) })).status, 503);
  assert.equal((await registrarSolicitudHTTP(request(), { registrar: async () => { throw Error('privado'); } })).status, 503);
});
test('contrato: duplicados con mayúsculas, fecha imposible y cantidades inválidas', () => {
  for (const cambio of [{ items: [datos.items[0], { ...datos.items[0], presentacion_id: datos.items[0].presentacion_id.toUpperCase() }] },
    { fecha: '2026-02-30' }, { items: [{ ...datos.items[0], cantidad: 0 }] }, { items: [{ ...datos.items[0], cantidad: 100001 }] }]) {
    assert.equal(payloadSolicitud.safeParse({ ...payload, ...cambio }).success, false);
  }
});
test('idempotencia: conserva clave y secreto incluso al vencer un intento incierto', () => {
  const almacen = new Map();
  const storage = { getItem: (key) => almacen.get(key) ?? null, setItem: (key, value) => almacen.set(key, value) };
  const intento = obtenerIntento(storage, 'huella', 1000);
  assert.deepEqual(obtenerIntento(storage, 'huella', intento.expira + 1), intento);
  guardarRespuesta(storage, 'huella', { ...intento, expira: Date.now() + 10000 }, respuesta);
  assert.deepEqual(obtenerIntento(storage, 'huella').respuesta, respuesta);
  storage.setItem(CLAVE_INTENTOS, JSON.stringify({ huella: { secreto: 'roto' } }));
  assert.throws(() => obtenerIntento(storage, 'huella'), /ALMACEN_INVALIDO/);
});
test('WhatsApp: destino 56954878711 y resumen del servidor con referencia', () => {
  const url = new URL(enlaceSolicitud(payloadSolicitud.parse(payload), respuesta));
  assert.equal(url.origin + url.pathname, 'https://wa.me/56954878711');
  const mensaje = url.searchParams.get('text');
  assert.ok(mensaje.includes(respuesta.codigo));
  assert.ok(mensaje.includes('Agua'));
  assert.ok(mensaje.includes('pendiente de confirmación'));
  assert.ok(!mensaje.includes(payload.secretoReintento));
});
test('configuración: activación explícita y URL HTTPS del proyecto correcto', () => {
  const anterior = { ...process.env };
  try {
    delete process.env.POSIBLES_PEDIDOS_ENABLED;
    assert.equal(config.fasePosiblesPedidosHabilitada(), false);
    process.env.POSIBLES_PEDIDOS_ENABLED = 'true';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'clave-publica-fixture';
    for (const url of ['http://gxmkrerhuuzeeupjliap.supabase.co', 'https://otro.supabase.co', 'https://gxmkrerhuuzeeupjliap.supabase.co/otra-ruta']) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = url;
      assert.equal(config.configuracionRegistro(), null);
    }
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://gxmkrerhuuzeeupjliap.supabase.co';
    assert.ok(config.configuracionRegistro());
  } finally { process.env = anterior; }
});
