import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { BalanceEntrega, SolicitudConCobro } from "./entrega-actions";
import { cobroValido, solicitudValida, leerBalanceEntrega } from "./entrega-validacion";
import { mensajeErrorEntrega } from "./entrega-errores";

export type RespuestaConfirmacion = { resultado?: BalanceEntrega; yaEntregado?: boolean; error?: string };
export async function resolverEntrega(s: SolicitudConCobro, diferencias: boolean, soloConsultar = false): Promise<RespuestaConfirmacion> {
 if (!solicitudValida(s) || !cobroValido(s)) return { error: "Los datos de entrega o cobro no son válidos." };
 let respuesta: RespuestaConfirmacion;
 try {
  const db = await crearClienteSupabaseServidor();
  const args = { p_pedido_id: s.p_pedido_id, p_version_esperada: s.p_version_esperada, p_clave: s.p_clave,
   p_items: s.p_items.map(i => ({ item_pedido_id: i.item_pedido_id, cantidad_entregada: i.cantidad_entregada })),
   p_cobro: { metodo: s.p_cobro.metodo, efectivo: s.p_cobro.efectivo, transferencia: s.p_cobro.transferencia, confirmar_por_pagar: s.p_cobro.confirmar_por_pagar } };
  async function consultar(): Promise<RespuestaConfirmacion | null> {
   const { data, error } = await db.rpc("consultar_resultado_entrega", { ...args, p_diferencias: diferencias });
   if (error) throw new Error(mensajeErrorEntrega(error, "No se pudo consultar el resultado persistido."));
   if (data?.confirmada === true && data.misma_solicitud === false) return { yaEntregado: true };
   if (data?.confirmada === true && data.misma_solicitud === true) {
    const balance = leerBalanceEntrega(data.resultado);
    if (!balance || data.resultado?.pedido_id !== s.p_pedido_id || data.resultado?.estado !== "entregado") throw new Error("El comprobante persistido tiene un formato incompatible. Requiere revisión.");
    return { resultado: balance };
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
   try {
    const { data, error } = await db.rpc(diferencias ? "confirmar_entrega_hubo_diferencias" : "confirmar_entrega_todo_correcto", args);
    if (error) fallo = mensajeErrorEntrega(error, "No se pudo confirmar la entrega y el cobro.");
    else if (data?.resultado?.pedido_id === s.p_pedido_id && data.resultado.estado === "entregado") balance = leerBalanceEntrega(data.resultado);
   } catch { fallo = "Se perdió la conexión al confirmar la entrega y el cobro."; }
   if (balance) respuesta = { resultado: balance };
   else {
    try {
     const recuperada = await consultar();
     if (!recuperada) return { error: `${fallo} No hay resultado confirmado visible; conserva la misma solicitud para reintentar.` };
     respuesta = recuperada;
    } catch (error) { return { error: `${fallo} ${error instanceof Error ? error.message : "No fue posible recuperar el resultado."} Conserva la misma solicitud.` }; }
   }
  }
 } catch (error) { return { error: error instanceof Error ? error.message : "No fue posible verificar la entrega. Conserva la misma solicitud." }; }
 for (const ruta of ["/admin/rutas", "/admin/pedidos", "/admin/clientes", "/mi-cuenta/pedidos", "/reparto"]) {
  try { revalidatePath(ruta, "layout"); } catch { /* El comprobante confirmado no depende del refresh. */ }
 }
 return respuesta;
}
