import "server-only";
import { obtenerNombresResponsables, describirAccionRuta } from "@/lib/admin/responsables";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { formatCLP } from "@/lib/formatters";

type Registro = Record<string, unknown>;
export type EventoPedido = {
  id: string; fecha: string; tipo: string; actor?: string; provisional: boolean;
  detalles: string[];
};
const registro = (valor: unknown): Registro => valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Registro : {};
const lista = (valor: unknown): Registro[] => Array.isArray(valor) ? valor.map(registro) : [];
const texto = (valor: unknown) => valor == null ? "Sin registro" : (typeof valor === "boolean" ? valor ? "Sí" : "No" : String(valor)).replaceAll("_", " ");
const dinero = (valor: unknown) => valor == null ? "Sin registro" : formatCLP(Number(valor));
const campos: Record<string, string> = {
  estado: "Estado", cantidad_preparada: "Cantidad preparada", confirmado_explicito: "Confirmación del producto",
  importe_linea_operativo: "Importe operativo provisional", total_operativo_preparacion: "Total operativo provisional",
  parcial_autorizado: "Preparación parcial autorizada", preparacion_estado: "Estado de preparación", incluido: "Incluido en carga", motivo: "Motivo",
};
function cambios(anterior: Registro, nuevo: Registro) {
  return Object.entries(campos).flatMap(([clave, nombre]) => {
    if (!(clave in anterior) && !(clave in nuevo)) return [];
    const formato = clave.includes("importe") || clave.startsWith("total_") ? dinero : texto;
    const partes = [];
    if (clave in anterior) partes.push(`Anterior: ${formato(anterior[clave])}`);
    if (clave in nuevo) partes.push(`Nuevo: ${formato(nuevo[clave])}`);
    if (typeof anterior[clave] === "number" && typeof nuevo[clave] === "number") {
      const diferencia = (nuevo[clave] as number) - (anterior[clave] as number);
      partes.push(`Diferencia: ${formato(diferencia)}`);
    }
    return [`${nombre} · ${partes.join(" · ")}`];
  });
}

export async function obtenerHistorialPedido(id: string) {
  const supabase = await crearClienteSupabaseServidor();
  const { data: { user }, error: errorUsuario } = await supabase.auth.getUser();
  if (errorUsuario || !user) throw new Error("NO_AUTORIZADO");
  const { data: admin, error: errorAdmin } = await supabase.rpc("es_admin");
  if (errorAdmin || admin !== true) throw new Error("NO_AUTORIZADO");
  const { data: pedido, error } = await supabase.from("pedidos")
    .select("id,numero_pedido,fecha_creacion,fecha_entrega,venta_definitiva_snapshot,venta_reconocida_en")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  if (!pedido) return null;

  // Paginación estable: no truncar historiales al límite del API.
  async function leer(tabla: string, columnas: string, campo: string, valor: string, orden = "id"): Promise<Registro[]> {
    const filas: Registro[] = [];
    for (;;) {
      const { data, error } = await supabase.from(tabla).select(columnas).eq(campo, valor)
        .order(orden).range(filas.length, filas.length + 199);
      if (error) throw error;
      if (!data?.length) return filas;
      filas.push(...data.map(registro));
    }
  }
  const [estados, items, aplicaciones, paradas, preparacion] = await Promise.all([
    leer("historial_estados_pedido", "id,estado_anterior,estado_nuevo,cambiado_por,observacion,fecha_creacion", "pedido_id", id),
    leer("items_pedido", "id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot", "pedido_id", id),
    leer("aplicaciones_pago", "id,pago_id,monto_aplicado,fecha_creacion,activa,fecha_anulacion,anulada_por,motivo_anulacion", "pedido_id", id),
    leer("paradas_ruta", "id,ruta_id,posicion,estado_logistico,hora_inicio,hora_entrega,fecha_creacion", "pedido_id", id),
    supabase.rpc("leer_preparacion_explicita", { p_pedido_id: id }),
  ]);
  if (preparacion.error) throw preparacion.error;
  const eventos: EventoPedido[] = [];
  function agregar(clave: string, fecha: unknown, tipo: string, actor: unknown, detalles: string[], provisional = false) {
    if (typeof fecha !== "string") return;
    eventos.push({ id: clave, fecha, tipo, actor: typeof actor === "string" ? actor : undefined, detalles, provisional });
  }
  agregar("creacion", pedido.fecha_creacion, "Creación del pedido", null, []);
  for (const e of estados) agregar(`estado-${e.id}`, e.fecha_creacion, "Cambio de estado", e.cambiado_por,
    [...(e.estado_anterior == null ? [] : [`Estado anterior: ${texto(e.estado_anterior)}`]), `Estado nuevo: ${texto(e.estado_nuevo)}`, ...(e.observacion ? [String(e.observacion)] : [])]);
  const nombreItem = (itemId: unknown) => {
    const item = items.find((i) => i.id === itemId);
    return item ? `${item.nombre_producto_snapshot}${item.nombre_presentacion_snapshot ? ` · ${item.nombre_presentacion_snapshot}` : ""} · Unidad: ${item.unidad_snapshot}` : "Pedido";
  };
  for (const e of lista(registro(preparacion.data).historial)) agregar(`preparacion-${e.version}`, e.fecha, registro(e.valores_nuevos).origen === "sin_stock_pre_despacho" ? "No entregado por falta de stock" : "Preparación", e.actor_id,
    [nombreItem(e.item_pedido_id), ...(e.motivo ? [String(e.motivo)] : []), ...cambios(registro(e.valores_anteriores), registro(e.valores_nuevos))], registro(e.valores_nuevos).origen !== "sin_stock_pre_despacho");
  const precios = await Promise.all(items.map((item) => leer("auditoria_precios_pedido_administrativo", "item_pedido_id,precio_referencia,precio_aplicado,total_original,total_aplicado,motivo,administrador_id,fecha_autorizacion", "item_pedido_id", String(item.id), "item_pedido_id")));
  for (const e of precios.flat()) {
    const detalles = [nombreItem(e.item_pedido_id), `Motivo: ${texto(e.motivo)}`];
    if (e.total_original != null) detalles.push(`Total original: ${dinero(e.total_original)}`);
    if (e.total_aplicado != null) detalles.push(`Total aplicado: ${dinero(e.total_aplicado)}`);
    if (e.total_original != null && e.total_aplicado != null) detalles.push(`Diferencia: ${dinero(Number(e.total_aplicado) - Number(e.total_original))}`);
    detalles.push(`Precio unitario de referencia: ${dinero(e.precio_referencia)}`);
    if (e.precio_aplicado != null) detalles.push(`Precio unitario aplicado: ${dinero(e.precio_aplicado)}`);
    agregar(`precio-${e.item_pedido_id}`, e.fecha_autorizacion, "Ajuste de precio autorizado", e.administrador_id, detalles);
  }
  for (const e of paradas) {
    agregar(`parada-${e.id}`, e.fecha_creacion, "Registro de parada en ruta", null,
      [`Ruta: ${e.ruta_id}`, `Estado actual de parada (no histórico): ${texto(e.estado_logistico)}`, `Posición actual: ${texto(e.posicion)}`, "La ruta no conserva un historial de cambios de posición."], true);
    agregar(`inicio-${e.id}`, e.hora_inicio, "Inicio de parada registrado", null, []);
    agregar(`fin-${e.id}`, e.hora_entrega, "Hora de entrega registrada en parada", null, []);
  }
  // Solo pagos vinculados por aplicaciones, nunca todos los pagos del cliente.
  const pagos = await Promise.all([...new Set(aplicaciones.map((a) => String(a.pago_id)))].map((pagoId) => leer("pagos", "id,monto,metodo_pago,estado,registrado_por,fecha_pago,fecha_anulacion,anulado_por,motivo_anulacion", "id", pagoId)));
  for (const p of pagos.flat()) {
    agregar(`pago-${p.id}`, p.fecha_pago, "Pago registrado vinculado al pedido", p.registrado_por,
      [`Importe total del pago (puede cubrir otros pedidos): ${dinero(p.monto)}`, `Método: ${texto(p.metodo_pago)}`, `Estado actual: ${texto(p.estado)}`, "No se conserva aquí la fecha ni el estado anterior de una eventual confirmación."], p.estado !== "confirmado" && p.estado !== "anulado");
    agregar(`pago-anulado-${p.id}`, p.fecha_anulacion, "Anulación de pago", p.anulado_por, [`Motivo: ${texto(p.motivo_anulacion)}`]);
  }
  for (const a of aplicaciones) {
    const pago = pagos.flat().find((p) => p.id === a.pago_id);
    agregar(`aplicacion-${a.id}`, a.fecha_creacion, "Aplicación de pago al pedido", null,
      [`Importe aplicado registrado: ${dinero(a.monto_aplicado)}`, `Vigencia actual: ${a.activa ? "Activa" : "Anulada"}`, `Estado actual del pago: ${texto(pago?.estado)}`, "No se reconstruyen cambios del importe sin auditoría."], pago?.estado !== "confirmado");
    agregar(`aplicacion-anulada-${a.id}`, a.fecha_anulacion, "Anulación de aplicación", a.anulada_por, [`Motivo: ${texto(a.motivo_anulacion)}`]);
  }
  const venta = registro(pedido.venta_definitiva_snapshot);
  const correcciones = await leer("correcciones_venta_entregada", "id,fecha,actor_id,motivo,anteriores,nuevos,diferencia", "pedido_id", id);
  for (const c of correcciones) {
    const anterior = registro(c.anteriores), nuevo = registro(c.nuevos);
    agregar(`correccion-venta-${c.id}`, c.fecha, "Corrección administrativa de venta entregada", c.actor_id,
      [`Motivo: ${texto(c.motivo)}`, `Total anterior: ${dinero(anterior.total)}`, `Total corregido: ${dinero(nuevo.total)}`, `Diferencia: ${dinero(c.diferencia)}`,
        ...lista(nuevo.productos).map(p => {
          const antes = lista(anterior.productos).find(a => a.item_pedido_id === p.item_pedido_id);
          return `${nombreItem(p.item_pedido_id)} · Entregado anterior: ${texto(antes?.cantidad_entregada)} · Corregido: ${texto(p.cantidad_entregada)} · Importe anterior: ${dinero(antes?.importe_definitivo)} · Corregido: ${dinero(p.importe_definitivo)}`;
        })]);
  }
  agregar("entrega-definitiva", pedido.venta_reconocida_en, "Entrega definitiva confirmada", venta.actor_id,
    [`Subtotal: ${dinero(venta.subtotal)}`, `Despacho: ${dinero(venta.costo_entrega)}`, `Descuento: ${dinero(venta.descuento)}`, `Total definitivo: ${dinero(venta.total)}`,
      ...lista(venta.productos).map((p) => `${texto(p.nombre_producto)}${p.nombre_presentacion ? ` · ${p.nombre_presentacion}` : ""} · Unidad: ${texto(p.unidad)} · Pedido: ${texto(p.cantidad_pedida)} · Preparado: ${texto(p.cantidad_preparada)} · Entregado: ${texto(p.cantidad_entregada)} · Importe definitivo: ${dinero(p.importe_definitivo)}`)]);

  // Lectura Fase 3: evidencia privada expuesta únicamente por RPC administrativa.
  const avisos: string[] = [];
  const { data: evidencia, error: errorEvidencia } = await supabase.rpc("leer_intentos_pedido_admin", { p_pedido_id: id });
  if (errorEvidencia) {
    avisos.push(errorEvidencia.code === "PGRST202"
      ? "Los intentos fallidos y cierres requieren instalar el SQL manual de Fase 3. El historial mostrado es parcial."
      : "No se pudo consultar la evidencia de intentos y cierres. El historial mostrado es parcial.");
  } else {
    for (const intento of lista(registro(evidencia).intentos)) {
      agregar(`intento-fallido-${intento.id}`, intento.fecha, "Intento fallido · No entregado", intento.actor,
        [`Motivo: ${texto(intento.motivo)}`, ...(intento.observaciones ? [`Observaciones: ${intento.observaciones}`] : []),
          `Versión operativa: ${texto(intento.version)}`, "Este intento no constituye una entrega ni reconoce una venta o deuda."]);
    }
    for (const cierre of lista(registro(evidencia).cierres)) {
      const intento = registro(cierre.intento), original = registro(intento.pedido), fallo = registro(intento.fallo);
      agregar(`cierre-ruta-${cierre.fecha}-${cierre.version}`, cierre.cerrada_en, "Cierre de ruta · Evidencia del pedido", cierre.actor,
        [`Jornada original: ${texto(cierre.fecha)}`, `Versión de cierre: ${texto(cierre.version)}`,
          `Estado al cierre: ${texto(original.estado)}`, `Entrega programada conservada: ${texto(original.fecha_entrega)}`,
          ...(fallo.motivo ? [`Motivo del intento: ${fallo.motivo}`] : []),
          "El cierre conserva la evidencia original del intento, aunque el pedido cambie posteriormente."]);
    }
  }

  const { data: resolucion, error: errorResolucion } = await supabase.rpc("leer_resolucion_no_entregado_admin", { p_pedido_id: id });
  if (errorResolucion) {
    avisos.push("No se pudieron consultar las resoluciones administrativas. Requiere SQL manual de Fase 4; el historial mostrado es parcial.");
  } else {
    for (const r of lista(registro(resolucion).resoluciones)) {
      agregar(`resolucion-${r.id}`, r.fecha, r.operacion === "cancelar_no_entregado" ? "Cancelación administrativa de no entregado" : "Reprogramación administrativa de no entregado", r.actor,
        [`Motivo: ${texto(r.motivo)}`, `Versión operativa: ${texto(r.version)}`,
          ...(r.fecha_nueva ? [`Nueva fecha: ${r.fecha_nueva}`, "Pendiente de inclusión explícita en una nueva carga."] : []),
          ...(r.tratamiento ? [`Tratamiento de pagos y créditos: ${r.tratamiento}`] : []),
          "Conserva pedido, productos, precios, preparación, intentos y cierre original. No genera venta ni cargos ni devuelve pagos."]);
    }
  }

  // Las fechas vinculadas de rutas permiten encontrar jornadas anteriores sin inferir
  // que la fecha de entrega actual fue siempre la misma.
  const rutas = await Promise.all([...new Set(paradas.map((p) => String(p.ruta_id)))].map((rutaId) => leer("rutas", "id,fecha_operativa", "id", rutaId)));
  const fechas = [...new Set([pedido.fecha_entrega, ...rutas.flat().map((r) => r.fecha_operativa)].filter((f): f is string => typeof f === "string"))];
  for (const fecha of fechas) {
    const { data, error } = await supabase.rpc("leer_carga_jornada", { p_fecha: fecha });
    if (error) throw error;
    for (const h of lista(registro(data).historial)) {
      const anterior = registro(h.anterior), nuevo = registro(h.resultado), solicitud = registro(h.solicitud);
      const antes = lista(anterior.pedidos).find((p) => p.id === id);
      const despues = lista(nuevo.pedidos).find((p) => p.id === id);
      const seleccion = lista(solicitud.pedidos).find((p) => p.id === id);
      if (solicitud.accion === "resolver_sin_stock" ? solicitud.pedido !== id : solicitud.accion === "guardar" ? !seleccion : !(antes?.incluido || despues?.incluido)) continue;
      agregar(`carga-${fecha}-${h.version}`, h.instante, `Carga / ruta · ${describirAccionRuta(String(solicitud.accion))}`, h.actor,
        [`Jornada: ${fecha}`, ...cambios({ estado: anterior.estado }, { estado: nuevo.estado }), ...cambios(antes ?? {}, despues ?? {}), ...(solicitud.motivo ? [`Motivo: ${solicitud.motivo}`] : [])], solicitud.accion === "guardar" || solicitud.accion === "reabrir");
    }
  }
  const nombreResponsable = await obtenerNombresResponsables(eventos.map(e => e.actor));
  for (const evento of eventos) evento.actor = nombreResponsable(evento.actor);
  return { numeroPedido: String(pedido.numero_pedido), avisos, eventos: eventos.sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha) || a.id.localeCompare(b.id)) };
}
