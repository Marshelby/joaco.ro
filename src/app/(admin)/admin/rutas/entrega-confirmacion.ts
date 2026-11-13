import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { BalanceEntrega, SolicitudConCobro } from "./entrega-actions";
import { cobroValido, solicitudValida, leerBalanceEntrega } from "./entrega-validacion";
import { mensajeErrorEntrega } from "./entrega-errores";

export type RespuestaConfirmacion = { resultado?: BalanceEntrega; yaEntregado?: boolean; recuperada?: boolean; error?: string };
export async function resolverEntrega(s: SolicitudConCobro, diferencias: boolean, soloConsultar = false): Promise<RespuestaConfirmacion> {
 if (!solicitudValida(s) || !cobroValido(s)) return { error: "Los datos de entrega o cobro no son válidos." };
 let respuesta: RespuestaConfirmacion;
 try {
  const db = await crearClienteSupabaseServidor();
  const args = { p_pedido_id: s.p_pedido_id, p_version_esperada: s.p_version_esperada, p_clave: s.p_clave,
   p_items: s.p_items.map(i => ({ item_pedido_id: i.item_pedido_id, cantidad_entregada: i.cantidad_entregada })),
   p_cobro: { metodo: s.p_cobro.metodo, efectivo: s.p_cobro.efectivo, transferencia: s.p_cobro.transferencia, confirmar_por_pagar: s.p_cobro.confirmar_por_pagar } };
  // Solicitudes antiguas sin observación conservan su contrato y recuperación.
  if (s.p_observacion !== undefined) {
   const parametros = { ...args, p_diferencias: diferencias, p_observacion: s.p_observacion };
   function leer(data: unknown): RespuestaConfirmacion | null {
    if (!data || typeof data !== "object" || !("confirmada" in data) || data.confirmada !== true) return null;
    if ("misma_solicitud" in data && data.misma_solicitud === false) return { yaEntregado: true };
    if (!("misma_solicitud" in data) || data.misma_solicitud !== true || !("resultado" in data)) return null;
    const balance = leerBalanceEntrega(data.resultado);
    const comprobante = data.resultado as { pedido_id?: unknown; estado?: unknown } | null;
    if (!balance || comprobante?.pedido_id !== s.p_pedido_id || comprobante.estado !== "entregado") return null;
    return { resultado: balance, recuperada: "reintento" in data && data.reintento === true };
   }
   let fallo = "No hay un comprobante confirmado visible. Conserva la misma solicitud para reintentar.";
   let confirmacion: RespuestaConfirmacion | null = null;
   try {
    const { data, error } = await db.rpc("resolver_entrega_con_observacion", { ...parametros, p_solo_consultar: soloConsultar });
    if (error) fallo = mensajeErrorEntrega(error, fallo);
    else confirmacion = leer(data);
   } catch { fallo = "Se perdió la conexión. Conserva la misma solicitud para recuperar el resultado."; }
   // Si se perdió la respuesta de escritura, recuperar solo leyendo. Nunca reenviar
   // automáticamente la mutación ni separar el comentario del cobro.
   if (!confirmacion && !soloConsultar) {
    try {
     const { data, error } = await db.rpc("resolver_entrega_con_observacion", { ...parametros, p_solo_consultar: true });
     if (!error) confirmacion = leer(data);
    } catch { /* El intento persistido en la pestaña permite recuperar después. */ }
   }
   if (!confirmacion) return { error: fallo };
   respuesta = confirmacion;
  } else {
   async function consultar(): Promise<RespuestaConfirmacion | null> {
    const { data, error } = await db.rpc("consultar_resultado_entrega", { ...args, p_diferencias: diferencias });
    if (error) throw new Error(mensajeErrorEntrega(error, "No se pudo consultar el resultado persistido."));
    if (data?.confirmada === true && data.misma_solicitud === false) return { yaEntregado: true };
    if (data?.confirmada === true && data.misma_solicitud === true) {
     const balance = leerBalanceEntrega(data.resultado);
     if (!balance || data.resultado?.pedido_id !== s.p_pedido_id || data.resultado?.estado !== "entregado") throw new Error("El comprobante persistido tiene un formato incompatible. Requiere revisión.");
     return { resultado: balance, recuperada: true };
    }
    if (data?.confirmada !== false) throw new Error("La consulta del resultado devolvió un formato incompatible.");
    return null;
   }
   // Recuperar antes de escribir: incluso con versión vieja, otra clave o ruta cerrada.
   const anterior = await consultar();
   if (anterior) respuesta = anterior;
   else if (soloConsultar) return { error: "Aún no hay una entrega confirmada visible. Reintenta con la misma solicitud; no modifiques el cobro." };
   else {
    let fallo = "No se recibió un comprobante válido de entrega y cobro.";
    let balance: BalanceEntrega | null = null;
    let recuperada = false;
    try {
     const { data, error } = await db.rpc(diferencias ? "confirmar_entrega_hubo_diferencias" : "confirmar_entrega_todo_correcto", args);
     if (error) fallo = mensajeErrorEntrega(error, "No se pudo confirmar la entrega y el cobro.");
     else if (data?.resultado?.pedido_id === s.p_pedido_id && data.resultado.estado === "entregado") {
      balance = leerBalanceEntrega(data.resultado);
      recuperada = data.reintento === true;
     }
    } catch { fallo = "Se perdió la conexión al confirmar la entrega y el cobro."; }
    if (balance) respuesta = { resultado: balance, recuperada };
    else {
     try {
      const recuperada = await consultar();
      if (!recuperada) return { error: `${fallo} No hay resultado confirmado visible; conserva la misma solicitud para reintentar.` };
      respuesta = recuperada;
     } catch (error) { return { error: `${fallo} ${error instanceof Error ? error.message : "No fue posible recuperar el resultado."} Conserva la misma solicitud.` }; }
    }
   }
  }
 } catch (error) { return { error: error instanceof Error ? error.message : "No fue posible verificar la entrega. Conserva la misma solicitud." }; }
 for (const ruta of ["/admin/rutas", "/admin/pedidos", "/admin/clientes", "/mi-cuenta/pedidos", "/reparto"]) {
  try { revalidatePath(ruta, "layout"); } catch { /* El comprobante confirmado no depende del refresh. */ }
 }
 return respuesta;
}
