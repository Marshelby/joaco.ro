"use server";

import { z } from "zod";
import { cargarClientePedido } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import type { LineaPedidoBorrador } from "@/lib/admin/pedido-borrador";
import { clienteAdministradorPosibles } from "@/lib/posibles-pedidos/administracion";

export async function cargarPosibleParaPedido(id: string, version: number) {
  const db = await clienteAdministradorPosibles();
  const { data: solicitud, error } = await db.from("posibles_pedidos")
    .select("solicitud_id,codigo_publico,cliente_id,fecha_entrega_solicitada")
    .eq("id", z.uuid().parse(id)).eq("version", z.number().int().positive().parse(version))
    .in("estado", ["registrado", "en_gestion"]).maybeSingle();
  if (error || !solicitud) throw new Error("Solicitud no disponible");

  const [cierre, items, inicial] = await Promise.all([
    db.from("posibles_pedidos").select("id").eq("solicitud_id", solicitud.solicitud_id)
      .in("estado", ["convertido", "descartado"]).limit(1).maybeSingle(),
    db.from("items_posible_pedido")
      .select("producto_id,presentacion_producto_id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad_presentacion_snapshot,cantidad,subtotal,precio_venta_autorizado,precio_venta_original_snapshot,motivo_autorizacion_precio")
      .eq("posible_pedido_id", id).eq("activo", true).order("orden"),
    solicitud.cliente_id ? cargarClientePedido(solicitud.cliente_id).catch(() => null) : null,
  ]);
  if (cierre.error || cierre.data || items.error) throw new Error("Solicitud no disponible");

  const { data: revision, error: errorRevision } = await db.from("posibles_pedidos")
    .select("id").eq("id", id).eq("version", version)
    .in("estado", ["registrado", "en_gestion"]).maybeSingle();
  if (errorRevision || !revision) throw new Error("Solicitud no disponible");

  const ubicacionId = inicial?.ubicaciones.find((ubicacion) => ubicacion.es_principal)?.id
    ?? (inicial?.ubicaciones.length === 1 ? inicial.ubicaciones[0].id : "");
  const lineas: LineaPedidoBorrador[] = (items.data ?? []).map((item) => {
    const precio = Number(item.precio_venta_autorizado ?? item.precio_venta_original_snapshot);
    return {
      presentacion: {
        productoId: item.producto_id, presentacionId: item.presentacion_producto_id,
        nombre: item.nombre_producto_snapshot, presentacionNombre: item.nombre_presentacion_snapshot,
        unidad: item.unidad_snapshot, cantidadPresentacion: Number(item.cantidad_presentacion_snapshot),
        precioFinalReferencia: precio,
      },
      cantidad: String(item.cantidad),
      precioReferencia: precio,
      totalFinal: String(item.subtotal),
      motivoAjuste: item.motivo_autorizacion_precio?.trim() || `Precio de la solicitud ${solicitud.codigo_publico}`,
    };
  });

  return { inicial, ubicacionId, lineas, catalogo: null, fechaEntrega: solicitud.fecha_entrega_solicitada };
}
