"use server";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerFechasEntregaDisponibles } from "@/lib/delivery-availability";
import { revalidatePath } from "next/cache";
import { aceptarPedidoAdmin } from "../actions";
import { z } from "zod";
import { administradorComercial, leerFichaComercial } from "@/lib/admin/cliente-comercial";
import { obtenerClienteAdmin, obtenerClientesAdmin } from "@/lib/admin/clientes";
import { CONFIRMACION_ADMINISTRATIVA_HABILITADA, IMPORTE_MAXIMO_PEDIDO, totalLineaPedido, type LineaPedidoBorrador, type PedidoBorrador, type CrearPedidoAdministrativoParametros, type CrearPedidoAdministrativoResultado, type ConfirmarPedidoAdministrativoRespuesta } from "@/lib/admin/pedido-borrador";
import { PAYMENT_INTENT_OPTIONS, esMetodoPagoPrevisto } from "@/lib/payment-intent";
import { cotizarDespacho } from "@/lib/delivery-pricing";
import { ROUTES } from "@/config/routes";

const importe = z.number().int().nonnegative().max(IMPORTE_MAXIMO_PEDIDO);
// Solo estructura y límites de transporte. La RPC verifica referencias,
// disponibilidad, cantidades por presentación, precios, totales y entrega.
const pedidoConfirmacion: z.ZodType<PedidoBorrador> = z.strictObject({
  clienteId: z.uuid(),
  ubicacionId: z.uuid(),
  lineas: z.array(z.strictObject({
    productoId: z.uuid(), presentacionId: z.uuid(),
    cantidad: z.number().positive().max(100000),
    precioReferencia: importe.positive(), totalFinal: importe,
    motivoAjuste: z.string().max(1000).nullable(), totalOriginal: importe,
  })).min(1).max(100),
  subtotal: importe,
  fechaEntrega: z.iso.date(),
  metodosPagoPrevistos: z.array(z.enum(PAYMENT_INTENT_OPTIONS)).min(1).max(3),
});
const edicionPedidoRecibido = z.strictObject({
  clienteId: z.uuid().nullable(), ubicacionId: z.uuid().nullable(),
  clienteNombre: z.string().nullable(), ubicacionResumen: z.string().nullable(),
  fechaEntrega: z.iso.date().nullable(),
  metodosPagoPrevistos: z.array(z.enum(PAYMENT_INTENT_OPTIONS)).max(3),
  lineas: z.array(z.union([
    z.strictObject({ itemId: z.uuid() }),
    z.strictObject({
      itemId: z.uuid().nullable(), productoId: z.uuid().nullable(), presentacionId: z.uuid().nullable(),
      cantidad: z.number().positive().max(100000), precioReferencia: importe,
      totalOriginal: importe, totalFinal: importe, motivoAjuste: z.string().max(1000).nullable(),
    }),
  ])).min(1).max(100),
  subtotal: importe, costoEntrega: importe, total: importe,
});
export type EdicionPedidoRecibido = z.infer<typeof edicionPedidoRecibido>;

const parametrosConfirmacion: z.ZodType<CrearPedidoAdministrativoParametros> = z.strictObject({
  p_clave_idempotencia: z.uuid(), p_pedido: pedidoConfirmacion,
});
const comprobanteConfirmacion: z.ZodType<CrearPedidoAdministrativoResultado> = z.strictObject({
  pedido_id: z.uuid(), numero_pedido: z.string().min(1), estado: z.literal("recibido"),
  subtotal: importe, costo_entrega: importe, descuento: importe, total: importe,
});

export async function confirmarPedidoAdministrativo(entrada: CrearPedidoAdministrativoParametros): Promise<ConfirmarPedidoAdministrativoRespuesta> {
  let db: Awaited<ReturnType<typeof administradorComercial>>;
  try {
    db = await administradorComercial();
  } catch {
    return { ok: false, mensaje: "No fue posible validar tu sesión administrativa. Inicia sesión con una cuenta administradora y reintenta." };
  }
  if (!CONFIRMACION_ADMINISTRATIVA_HABILITADA) {
    return { ok: false, mensaje: "La confirmación administrativa está deshabilitada. Tu borrador se conserva en esta página." };
  }
  const parametros = parametrosConfirmacion.safeParse(entrada);
  if (!parametros.success) return { ok: false, mensaje: "El borrador contiene datos inválidos. Revisa las etapas antes de confirmar." };
  try {
    const { data, error } = await db.rpc("crear_pedido_administrativo", parametros.data);
    if (error) {
      // Solo errores de negocio posteriores a la búsqueda idempotente prueban
      // que no hay una creación previa para esta clave. Un rechazo de sesión,
      // timeout o error de transporte no permite descartar un éxito anterior.
      const erroresSinCreacion = new Set([
        "CAMPOS_PEDIDO_INVALIDOS", "TIPOS_PEDIDO_INVALIDOS", "REFERENCIAS_PEDIDO_INVALIDAS",
        "LIMITE_LINEAS", "METODOS_PAGO_PREVISTOS_INVALIDOS", "CLIENTE_INVALIDO",
        "UBICACION_COMERCIAL_INVALIDA", "UBICACION_SIN_COORDENADAS", "NOMBRE_UBICACION_REQUERIDO",
        "ZONA_INVALIDA", "CAMPOS_LINEA_INVALIDOS", "TIPOS_LINEA_INVALIDOS",
        "REFERENCIAS_LINEA_INVALIDAS", "PRESENTACION_DUPLICADA", "CANTIDAD_O_PRECIO_INVALIDO",
        "PRODUCTO_NO_DISPONIBLE", "PRESENTACION_NO_DISPONIBLE", "CATEGORIA_NO_DISPONIBLE",
        "PRECIO_REFERENCIA_DESACTUALIZADO", "CANTIDAD_INVALIDA", "LIMITE_IMPORTE",
        "TOTAL_ORIGINAL_INCORRECTO", "MOTIVO_PRECIO_REQUERIDO", "MOTIVO_SIN_AJUSTE",
        "SUBTOTAL_INCORRECTO", "FECHA_ENTREGA_NO_DISPONIBLE",
      ]);
      const resultadoIncierto = !erroresSinCreacion.has(error.message)
        || !["P0001", "40001"].includes(error.code);
      const mensajes: Record<string, string> = {
        NO_AUTORIZADO: "Tu sesión no tiene permisos administrativos. Vuelve a iniciar sesión.",
        CLAVE_IDEMPOTENCIA_EN_USO: "No fue posible recuperar este intento con la sesión y el contenido originales. Conservamos la clave; vuelve a la cuenta administradora que inició el intento.",
        PRECIO_REFERENCIA_DESACTUALIZADO: "Cambió un precio de referencia. Revisa el catálogo y los precios antes de reintentar.",
        FECHA_ENTREGA_NO_DISPONIBLE: "La fecha de entrega dejó de estar disponible. Actualiza las fechas y selecciona otra.",
        CLIENTE_INVALIDO: "El cliente ya no está disponible. Revisa la selección del cliente.",
        UBICACION_COMERCIAL_INVALIDA: "La ubicación comercial ya no está disponible para este cliente.",
        UBICACION_SIN_COORDENADAS: "La ubicación comercial requiere coordenadas válidas antes de confirmar.",
        PRODUCTO_NO_DISPONIBLE: "Un producto dejó de estar disponible. Revisa las líneas del pedido.",
        PRESENTACION_NO_DISPONIBLE: "Una presentación dejó de estar disponible. Revisa las líneas del pedido.",
        CATEGORIA_NO_DISPONIBLE: "La categoría de un producto dejó de estar disponible. Revisa las líneas del pedido.",
        ZONA_INVALIDA: "La zona de la ubicación comercial ya no está activa. Revisa la ficha del cliente.",
        NOMBRE_UBICACION_REQUERIDO: "La ubicación comercial requiere un nombre o dirección antes de confirmar.",
        CANTIDAD_INVALIDA: "Revisa las cantidades permitidas para cada presentación.",
        MOTIVO_PRECIO_REQUERIDO: "Completa el motivo de cada ajuste de total.",
        SUBTOTAL_INCORRECTO: "El subtotal no coincide con las líneas. Revisa los precios antes de confirmar.",
        TOTAL_ORIGINAL_INCORRECTO: "Un total original no coincide con el catálogo. Revisa los precios y cantidades.",
      };
      return { ok: false, resultadoIncierto, mensaje: mensajes[error.message] ?? "No fue posible confirmar el pedido. Conservamos tu borrador; reintenta sin modificarlo para recuperar el resultado del mismo intento." };
    }
    const comprobante = comprobanteConfirmacion.safeParse(data);
    const cotizacion = cotizarDespacho(parametros.data.p_pedido.subtotal);
    if (!comprobante.success || comprobante.data.subtotal !== parametros.data.p_pedido.subtotal
      || comprobante.data.costo_entrega !== cotizacion.costoEntrega || comprobante.data.descuento !== 0
      || comprobante.data.total !== cotizacion.totalEstimado) return { ok: false, mensaje: "No fue posible verificar el comprobante. El pedido podría haberse creado; reintenta sin modificar el borrador para recuperar el mismo resultado." };
    return { ok: true, pedido: comprobante.data, destino: ROUTES.adminOrder(comprobante.data.pedido_id) };
  } catch {
    return { ok: false, mensaje: "Se interrumpió la confirmación. El pedido podría haberse creado; reintenta con el mismo borrador para recuperar el resultado sin duplicarlo." };
  }
}

export async function buscarClientesPedido(busqueda: string, pagina: number) {
  await administradorComercial();
  // El rango queda limitado solo por la precisión segura de los índices numéricos.
  const limitePaginas = Math.floor(Number.MAX_SAFE_INTEGER / 50);
  return obtenerClientesAdmin(z.string().max(120).parse(busqueda), z.number().int().min(1).max(limitePaginas).parse(pagina));
}

export async function cargarClientePedido(id: string) {
  const clienteId = z.uuid().parse(id);
  // La ficha comprueba sesión y rol antes de consultar los datos administrativos.
  const ficha = await leerFichaComercial(clienteId);
  if (ficha.cliente.id !== clienteId || !ficha.cliente.activo) throw new Error("Cliente no disponible");
  const cuenta = await obtenerClienteAdmin(clienteId);
  if (!cuenta || !cuenta.activo) throw new Error("Cliente no disponible");
  return {
    cliente: {
      id: ficha.cliente.id,
      nombre: ficha.cliente.nombre,
      telefono: ficha.cliente.telefono,
      email: ficha.cliente.email,
    },
    saldoActual: cuenta.saldoActual,
    ubicaciones: ficha.direcciones.filter((ubicacion) => ubicacion.activa),
  };
}

export async function cargarCatalogoPedido(clienteId: string | undefined, ubicacionId: string | undefined, pedidoRecibidoId?: string) {
  if (pedidoRecibidoId) {
    const db = await administradorComercial();
    const { data, error } = await db.from("pedidos").select("id")
      .eq("id", z.uuid().parse(pedidoRecibidoId)).eq("estado", "recibido").maybeSingle();
    if (error || !data) throw new Error("Pedido recibido no disponible");
    return leerCatalogoPedido();
  }
  const seleccion = await cargarClientePedido(z.uuid().parse(clienteId));
  const ubicacion = z.uuid().parse(ubicacionId);
  if (!seleccion.ubicaciones.some((item) => item.id === ubicacion)) {
    throw new Error("Ubicación no disponible");
  }
  return leerCatalogoPedido();
}

async function leerCatalogoPedido() {
  const supabase = await crearClienteSupabaseServidor();
  // Paginar presentaciones (también las de un mismo producto) evita los
  // límites implícitos de filas de Supabase y de las relaciones anidadas.
  type PresentacionCatalogo = {
    id: string; nombre: string; cantidad: number | string; unidad: string;
    precio_final: number | string; es_principal: boolean; orden: number;
    productos: { id: string; nombre: string };
  };
  const items: PresentacionCatalogo[] = [];
  let desde = 0;
  while (true) {
    const { data, error } = await supabase.from("presentaciones_producto")
      .select("id,nombre,cantidad,unidad,precio_final,es_principal,orden,productos!inner(id,nombre,activo,disponible,categorias!inner(activa))")
      .eq("activa", true).eq("productos.activo", true).eq("productos.disponible", true)
      .eq("productos.categorias.activa", true)
      .order("id").range(desde, desde + 199);
    if (error) throw new Error("No fue posible cargar el catálogo vigente");
    if (!data?.length) break;
    items.push(...(data as unknown as PresentacionCatalogo[]));
    desde += data.length;
  }
  return [...new Map(items.map((item) => [item.id, item])).values()]
    .sort((a, b) => a.productos.nombre.localeCompare(b.productos.nombre, "es-CL")
      || a.productos.id.localeCompare(b.productos.id)
      || Number(b.es_principal) - Number(a.es_principal)
      || a.orden - b.orden || a.id.localeCompare(b.id))
    .map((item) => ({
      productoId: item.productos.id, nombre: item.productos.nombre, presentacionId: item.id,
      presentacionNombre: item.nombre, cantidadPresentacion: Number(item.cantidad),
      unidad: item.unidad, precioFinalReferencia: Number(item.precio_final),
    }))
    .filter((item) => Number.isFinite(item.precioFinalReferencia) && item.precioFinalReferencia > 0
      && Number.isFinite(item.cantidadPresentacion) && item.cantidadPresentacion > 0);
}

export async function cargarFechasEntregaPedido() {
  await administradorComercial();
  return obtenerFechasEntregaDisponibles();
}

// Solo lectura: el ID de origen nunca forma parte de la confirmación del creador.
export async function cargarPedidoParaReciclar(id: string) {
  const db = await administradorComercial();
  const pedidoId = z.uuid().parse(id);
  const { data: pedido, error } = await db.from("pedidos")
    .select("cliente_id,direccion_cliente_id,estado")
    .eq("id", pedidoId).single();
  if (error || !pedido || !["entregado", "entrega_fallida"].includes(pedido.estado)) {
    throw new Error("Solo puedes reciclar pedidos entregados o no entregados disponibles.");
  }
  const inicial = await cargarClientePedido(pedido.cliente_id);
  const ubicacionId = inicial.ubicaciones.find(u => u.id === pedido.direccion_cliente_id)?.id;
  const advertencias: string[] = [];
  if (!ubicacionId) advertencias.push("La dirección original ya no es una ubicación comercial activa. Selecciona una dirección vigente en el paso 1.");
  const catalogo = ubicacionId ? await cargarCatalogoPedido(inicial.cliente.id, ubicacionId) : [];
  // El creador admite como máximo 100 líneas; detectar excesos sin truncarlos.
  const { data: items, error: errorItems } = await db.from("items_pedido")
    .select("id,producto_id,presentacion_producto_id,cantidad,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot")
    .eq("pedido_id", pedidoId).order("id").range(0, 100);
  if (errorItems || !items?.length || items.length > 100) throw new Error("No fue posible recuperar todas las líneas del pedido original.");
  const lineas: LineaPedidoBorrador[] = [];
  const ids = new Set<string>();
  for (const item of items) {
    const actual = catalogo.find(p => p.productoId === item.producto_id && p.presentacionId === item.presentacion_producto_id);
    // Conservar las líneas no disponibles para revisión explícita; nunca sustituir
    // por nombre ni omitir productos silenciosamente. No se copian precios antiguos.
    const presentacion = actual ?? {
      productoId: item.producto_id ?? item.id, presentacionId: item.presentacion_producto_id ?? item.id,
      nombre: item.nombre_producto_snapshot, presentacionNombre: item.nombre_presentacion_snapshot ?? "Presentación sin referencia vigente",
      unidad: item.unidad_snapshot, cantidadPresentacion: 0, precioFinalReferencia: 0,
    };
    const cantidad = String(item.cantidad);
    const total = actual ? totalLineaPedido(actual, cantidad, actual.precioFinalReferencia) : null;
    if (total === null || ids.has(presentacion.presentacionId)) advertencias.push(`${presentacion.nombre}: revisa la presentación y cantidad en el paso 2; no tienen una selección vigente válida.`);
    ids.add(presentacion.presentacionId);
    lineas.push({ presentacion, cantidad, precioReferencia: presentacion.precioFinalReferencia, totalFinal: total === null ? "" : String(total), motivoAjuste: "" });
  }
  const ubicacion = inicial.ubicaciones.find(u => u.id === ubicacionId);
  const direccionValida = ubicacion && [ubicacion.nombre_ubicacion, ubicacion.nombre, ubicacion.direccion].some(v => v?.trim())
    && ubicacion.latitud !== null && Number.isFinite(ubicacion.latitud) && Math.abs(ubicacion.latitud) <= 90
    && ubicacion.longitud !== null && Number.isFinite(ubicacion.longitud) && Math.abs(ubicacion.longitud) <= 180;
  const pasoInicial: 0 | 1 | 2 = !direccionValida ? 0 : advertencias.length ? 1 : 2;
  return { inicial, ubicacionId: ubicacionId ?? "", catalogo, lineas, advertencias, pasoInicial };
}

export async function cargarPedidoParaAceptar(id: string) {
  const db = await administradorComercial();
  const pedidoId = z.uuid().parse(id);
  const { data: pedido, error } = await db.from("pedidos")
    .select("id,numero_pedido,estado,fecha_actualizacion,cliente_id,direccion_cliente_id,nombre_cliente_snapshot,nombre_ubicacion_snapshot,direccion_snapshot,comuna_snapshot,region_snapshot,fecha_entrega,metodos_pago_previstos,subtotal,costo_entrega,descuento,total")
    .eq("id", pedidoId).single();
  if (error || !pedido || pedido.estado !== "recibido") throw new Error("Pedido recibido no disponible.");

  const leerLineas = async () => {
    const consulta = () => db.from("items_pedido")
      .select("id,producto_id,presentacion_producto_id,cantidad,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,precio_final_unitario_snapshot,modo_cantidad_snapshot,total_linea,vinculos_items_posible_pedido(item_pedido_id),auditoria_precios_pedido_administrativo(motivo,total_original,precio_referencia)")
      .eq("pedido_id", pedidoId).order("id");
    const items = [];
    for (;;) {
      const { data, error } = await consulta().range(items.length, items.length + 199);
      if (error || !data) throw new Error("No fue posible leer las líneas del pedido.");
      if (!data.length) return items;
      items.push(...data);
    }
  };
  const [cliente, items] = await Promise.all([
    pedido.cliente_id ? cargarClientePedido(pedido.cliente_id).catch(() => null) : null,
    leerLineas(),
  ]);
  const { data: vigente, error: errorVigencia } = await db.from("pedidos")
    .select("id").eq("id", pedidoId).eq("estado", "recibido")
    .eq("fecha_actualizacion", pedido.fecha_actualizacion).maybeSingle();
  if (errorVigencia || !vigente) throw new Error("El pedido cambió durante la lectura.");

  // Una dirección de checkout puede pertenecer al ámbito de cuenta.
  const ubicacionId = pedido.direccion_cliente_id ?? "";
  let inicial = cliente;
  if (cliente && ubicacionId && !cliente.ubicaciones.some((ubicacion) => ubicacion.id === ubicacionId)) {
    const { data: ubicacion } = await db.from("direcciones_cliente")
      .select("id,nombre_ubicacion,nombre,destinatario,telefono_contacto,direccion,comuna,region,referencia,zona_entrega_id,latitud,longitud,es_principal,activa")
      .eq("id", ubicacionId).eq("cliente_id", pedido.cliente_id).eq("activa", true).maybeSingle();
    if (ubicacion) inicial = { ...cliente, ubicaciones: [...cliente.ubicaciones, ubicacion] };
  }

  const referencias = items.map((item) => {
    const totalFinal = Number(item.total_linea);
    const cantidad = String(item.cantidad);
    const precioOriginal = Number(item.precio_final_unitario_snapshot);
    type Auditoria = { motivo: string; total_original: number | null; precio_referencia: number };
    const relacion = item.auditoria_precios_pedido_administrativo as Auditoria | Auditoria[] | null;
    const auditoria = Array.isArray(relacion) ? relacion[0] : relacion;
    const motivo = auditoria?.motivo ?? null;
    const cantidadMilesimas = BigInt(Math.round(Number(cantidad) * 1000));
    const referencia = BigInt(auditoria?.precio_referencia ?? item.precio_final_unitario_snapshot);
    const totalOriginal = Number(auditoria?.total_original ?? ((cantidadMilesimas * referencia + BigInt(500)) / BigInt(1000)));
    const fraccionable = item.modo_cantidad_snapshot
      ? item.modo_cantidad_snapshot === "kg_fraccionable"
      : item.unidad_snapshot.trim().toUpperCase() === "KG" && !/(saco|malla|caja|paquete|docena)/i.test(item.nombre_presentacion_snapshot ?? "");
    const snapshot = {
      productoId: item.producto_id ?? item.id, presentacionId: item.presentacion_producto_id ?? item.id,
      nombre: item.nombre_producto_snapshot, presentacionNombre: item.nombre_presentacion_snapshot ?? "",
      unidad: item.unidad_snapshot, cantidadPresentacion: 0,
      precioFinalReferencia: precioOriginal,
    };
    const vinculo = item.vinculos_items_posible_pedido;
    const protegida = Boolean(auditoria || (Array.isArray(vinculo) ? vinculo.length : vinculo));
    return {
      editable: { presentacion: { ...snapshot, presentacionId: item.id }, cantidad, precioReferencia: precioOriginal, totalFinal: String(totalFinal), motivoAjuste: motivo ?? "" },
      original: { id: item.id, presentacion: snapshot, cantidad: Number(cantidad), totalOriginal, totalFinal, motivoAjuste: motivo,
        productoId: item.producto_id, presentacionId: item.presentacion_producto_id, protegida, fraccionable },
    };
  });

  return {
    inicial, ubicacionId, catalogo: null, lineas: referencias.map((linea) => linea.editable),
    numero: String(pedido.numero_pedido),
    entrega: {
      pedidoId, version: String(pedido.fecha_actualizacion), clienteId: pedido.cliente_id, ubicacionId: pedido.direccion_cliente_id,
      fechaEntrega: String(pedido.fecha_entrega ?? ""),
      metodosPagoPrevistos: (Array.isArray(pedido.metodos_pago_previstos) ? pedido.metodos_pago_previstos : []).filter(esMetodoPagoPrevisto),
      clienteNombre: String(pedido.nombre_cliente_snapshot),
      ubicacionResumen: [pedido.nombre_ubicacion_snapshot, pedido.direccion_snapshot, pedido.comuna_snapshot, pedido.region_snapshot].filter(Boolean).join(" · "),
      lineas: referencias.map((linea) => linea.original),
      subtotal: Number(pedido.subtotal), costoEntrega: Number(pedido.costo_entrega),
      descuento: Number(pedido.descuento), total: Number(pedido.total),
    },
  };
}

export async function confirmarPedidoRecibido(id: string, version: string, cambios: EdicionPedidoRecibido | null) {
  const pedidoId = z.uuid().safeParse(id);
  if (!pedidoId.success) return { ok: false as const, mensaje: "No fue posible identificar el pedido." };
  const destino = ROUTES.adminOrder(pedidoId.data);
  if (cambios === null) {
    const datos = new FormData();
    datos.set("pedidoId", pedidoId.data);
    const respuesta = await aceptarPedidoAdmin({}, datos);
    if (!respuesta.aceptado) return { ok: false as const, mensaje: respuesta.error ?? "No fue posible aceptar el pedido." };
    revalidatePath("/admin/pedidos/entregas/[fecha]", "page");
    revalidatePath("/mi-cuenta/pedidos");
    revalidatePath(`/mi-cuenta/pedidos/${pedidoId.data}`);
    return { ok: true as const, destino };
  }

  const parametros = edicionPedidoRecibido.safeParse(cambios);
  if (!parametros.success || !z.iso.datetime({ offset: true }).safeParse(version).success) {
    return { ok: false as const, mensaje: "Revisa los datos del pedido antes de confirmar." };
  }

  let db: Awaited<ReturnType<typeof administradorComercial>>;
  try {
    db = await administradorComercial();
  } catch {
    return { ok: false as const, mensaje: "No fue posible validar tu sesión administrativa. Vuelve a iniciar sesión." };
  }
  const { error } = await db.rpc("guardar_y_aceptar_pedido_recibido", {
    p_pedido_id: pedidoId.data, p_version: version, p_pedido: parametros.data,
  });
  if (error) {
    const mensajes: Record<string, string> = {
      PGRST202: "El guardado de cambios requiere aplicar primero guardar_y_aceptar_pedido_recibido.sql.",
      PEDIDO_MODIFICADO: "El pedido cambió desde que lo abriste. Vuelve a Pedidos y revisa su estado.",
      PEDIDO_CON_REFERENCIAS: "El pedido tiene registros vinculados que impiden editarlo desde este asistente.",
      LINEA_CON_HISTORIAL: "Una línea tiene historial vinculado y debe conservar sus valores.",
      FECHA_ENTREGA_NO_DISPONIBLE: "La fecha seleccionada dejó de estar disponible. Elige otra fecha.",
      TOTALES_INVALIDOS: "Los importes del pedido no coinciden con el resumen o están fuera del rango permitido.",
      CLIENTE_INVALIDO: "El cliente seleccionado ya no está disponible.",
      DATOS_ENTREGA_MODIFICADOS: "El nombre del cliente o la dirección cambiaron desde que los seleccionaste. Vuelve a abrir el pedido y revisa esos datos.",
      ENTREGA_INVALIDA: "Revisa los datos de entrega y los métodos previstos de pago.",
      PRECIO_REFERENCIA_DESACTUALIZADO: "Cambió el precio de un producto agregado. Actualiza el catálogo y vuelve a agregarlo.",
      LINEAS_INVALIDAS: "Revisa la disponibilidad, las cantidades y los precios de las líneas.",
      UBICACION_COMERCIAL_INVALIDA: "Revisa la ubicación seleccionada para el cliente.",
    };
    return { ok: false as const, mensaje: mensajes[error.code] ?? mensajes[error.message] ?? "No fue posible guardar el pedido editado. Verifica su estado antes de reintentar." };
  }

  revalidatePath("/admin");
  revalidatePath(ROUTES.adminOrders);
  revalidatePath("/admin/rutas");
  revalidatePath(destino);
  revalidatePath("/admin/pedidos/entregas/[fecha]", "page");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin/clientes/[id]", "page");
  revalidatePath("/mi-cuenta/pedidos");
  revalidatePath(`/mi-cuenta/pedidos/${pedidoId.data}`);
  return { ok: true as const, destino };
}
