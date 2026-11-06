"use server";

import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerFechasEntregaDisponibles } from "@/lib/delivery-availability";
import { z } from "zod";
import { administradorComercial, leerFichaComercial } from "@/lib/admin/cliente-comercial";
import { obtenerClienteAdmin, obtenerClientesAdmin } from "@/lib/admin/clientes";
import { CONFIRMACION_ADMINISTRATIVA_HABILITADA, type PedidoBorrador, type CrearPedidoAdministrativoParametros, type CrearPedidoAdministrativoResultado, type ConfirmarPedidoAdministrativoRespuesta } from "@/lib/admin/pedido-borrador";
import { PAYMENT_INTENT_OPTIONS } from "@/lib/payment-intent";
import { ROUTES } from "@/config/routes";

const importe = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
// Solo estructura y límites de transporte. La RPC verifica referencias,
// disponibilidad, cantidades por presentación, precios, totales y entrega.
const pedidoConfirmacion: z.ZodType<PedidoBorrador> = z.strictObject({
  clienteId: z.uuid(),
  ubicacionId: z.uuid(),
  lineas: z.array(z.strictObject({
    productoId: z.uuid(), presentacionId: z.uuid(),
    cantidad: z.number().positive().max(Number.MAX_SAFE_INTEGER),
    precioReferencia: importe, precioAplicado: importe,
    motivoAjuste: z.string().max(1000).nullable(), total: importe,
  })).min(1).max(100),
  subtotal: importe,
  fechaEntrega: z.iso.date(),
  metodosPagoPrevistos: z.array(z.enum(PAYMENT_INTENT_OPTIONS)).min(1).max(3),
});
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
    return { ok: false, mensaje: "La confirmación está pendiente de validar y aplicar la migración administrativa. Tu borrador se conserva en esta página." };
  }
  const parametros = parametrosConfirmacion.safeParse(entrada);
  if (!parametros.success) return { ok: false, mensaje: "El borrador contiene datos inválidos. Revisa las etapas antes de confirmar." };
  try {
    const { data, error } = await db.rpc("crear_pedido_administrativo", parametros.data);
    if (error) {
      const mensajes: Record<string, string> = {
        NO_AUTORIZADO: "Tu sesión no tiene permisos administrativos. Vuelve a iniciar sesión.",
        CLAVE_IDEMPOTENCIA_EN_USO: "La clave de este intento corresponde a otro contenido. Revisa el borrador antes de continuar.",
        PRECIO_REFERENCIA_DESACTUALIZADO: "Cambió un precio de referencia. Revisa el catálogo y los precios antes de reintentar.",
        FECHA_ENTREGA_NO_DISPONIBLE: "La fecha de entrega dejó de estar disponible. Actualiza las fechas y selecciona otra.",
        CLIENTE_INVALIDO: "El cliente ya no está disponible. Revisa la selección del cliente.",
        UBICACION_COMERCIAL_INVALIDA: "La ubicación comercial ya no está disponible para este cliente.",
        UBICACION_SIN_COORDENADAS: "La ubicación comercial requiere coordenadas válidas antes de confirmar.",
        PRODUCTO_NO_DISPONIBLE: "Un producto dejó de estar disponible. Revisa las líneas del pedido.",
        PRESENTACION_NO_DISPONIBLE: "Una presentación dejó de estar disponible. Revisa las líneas del pedido.",
        CATEGORIA_NO_DISPONIBLE: "La categoría de un producto dejó de estar disponible. Revisa las líneas del pedido.",
      };
      return { ok: false, mensaje: mensajes[error.message] ?? "No fue posible confirmar el pedido. Conservamos tu borrador; reintenta sin modificarlo para recuperar el resultado del mismo intento." };
    }
    const comprobante = comprobanteConfirmacion.safeParse(data);
    if (!comprobante.success) return { ok: false, mensaje: "No fue posible verificar el comprobante. El pedido podría haberse creado; reintenta sin modificar el borrador para recuperar el mismo resultado." };
    return { ok: true, pedido: comprobante.data, destino: ROUTES.adminOrder(comprobante.data.pedido_id) };
  } catch {
    return { ok: false, mensaje: "Se interrumpió la confirmación. El pedido podría haberse creado; reintenta con el mismo borrador para recuperar el resultado sin duplicarlo." };
  }
}

export async function buscarClientesPedido(busqueda: string, pagina: number) {
  await administradorComercial();
  return obtenerClientesAdmin(z.string().max(120).parse(busqueda), z.number().int().min(1).max(100000).parse(pagina));
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

export async function cargarCatalogoPedido(clienteId: string, ubicacionId: string) {
  const seleccion = await cargarClientePedido(clienteId);
  const ubicacion = z.uuid().parse(ubicacionId);
  if (!seleccion.ubicaciones.some((item) => item.id === ubicacion)) throw new Error("Ubicación no disponible");
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.from("productos")
    .select("id,nombre,categorias!inner(activa),presentaciones_producto!inner(id,nombre,cantidad,unidad,precio_final,activa,orden)")
    .eq("activo", true).eq("disponible", true).eq("categorias.activa", true)
    .eq("presentaciones_producto.activa", true).order("nombre");
  if (error) throw new Error("No fue posible cargar el catálogo vigente");
  return (data ?? []).flatMap((producto) => producto.presentaciones_producto
    .filter((item) => item.activa)
    .sort((a, b) => a.orden - b.orden)
    .map((item) => ({
      productoId: producto.id, nombre: producto.nombre, presentacionId: item.id,
      presentacionNombre: item.nombre, cantidadPresentacion: Number(item.cantidad),
      unidad: item.unidad, precioFinalReferencia: Number(item.precio_final),
    })))
    .filter((item) => Number.isFinite(item.precioFinalReferencia) && item.precioFinalReferencia > 0
      && Number.isFinite(item.cantidadPresentacion) && item.cantidadPresentacion > 0);
}

export async function cargarFechasEntregaPedido() {
  await administradorComercial();
  return obtenerFechasEntregaDisponibles();
}
