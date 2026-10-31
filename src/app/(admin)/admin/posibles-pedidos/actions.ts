"use server";
import { revalidatePath } from "next/cache";
import { operacionAdmin, parametrosOperacion } from "@/lib/posibles-pedidos/admin-contrato";
import { clienteAdministradorPosibles } from "@/lib/posibles-pedidos/administracion";
import { mensajeErrorPosiblePedido } from "@/lib/posibles-pedidos/contrato";
export type EstadoOperacionPosible = { error?: string; exito?: string; pedidoId?: string };
export async function operarPosiblePedido(_: EstadoOperacionPosible, form: FormData): Promise<EstadoOperacionPosible> {
  const valor: Record<string,unknown> = Object.fromEntries(form.entries());
  if (valor.tipo === "editar") {
    try { valor.lineas = JSON.parse(String(valor.lineas)); } catch { return { error: "Revisa las líneas de la solicitud." }; }
  }
  const validado = operacionAdmin.safeParse(valor);
  if (!validado.success) return { error: "Revisa los datos de la operación y confirma los cambios solicitados." };
  if (validado.data.tipo === "precio" && validado.data.venta < validado.data.neto) return { error: "El precio de venta no puede ser menor que el neto." };
  try {
    const supabase = await clienteAdministradorPosibles();
    const { rpc, args } = parametrosOperacion(validado.data);
    const { data, error } = await supabase.rpc(rpc, args);
    if (error) return { error: mensajeErrorPosiblePedido(error.message) };
    if (!data?.posible_pedido_id) return { error: "No pudimos verificar el resultado. Reintenta la misma operación." };
    revalidatePath("/admin/posibles-pedidos");
    revalidatePath(`/admin/posibles-pedidos/${validado.data.id}`);
    if (data.pedido_id) {
      revalidatePath("/admin"); revalidatePath("/admin/pedidos"); revalidatePath(`/admin/pedidos/${data.pedido_id}`);
      revalidatePath("/admin/clientes"); revalidatePath("/mi-cuenta/pedidos");
    }
    return { exito: validado.data.tipo === "convertir" ? "Pedido oficial creado en estado recibido. No se registró ningún pago." : "Solicitud actualizada.", pedidoId: data.pedido_id ?? undefined };
  } catch (error) {
    return { error: error instanceof Error && error.message === "NO_AUTORIZADO" ? "Tu sesión no tiene permisos de administrador. Inicia sesión nuevamente." : "La operación no está disponible. Conserva los datos para reintentar." };
  }
}
