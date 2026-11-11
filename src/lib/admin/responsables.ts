import "server-only";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function obtenerNombresResponsables(ids: (string | null | undefined)[]) {
  const db = await crearClienteSupabaseServidor();
  const nombres = new Map<string, string>();
  const unicos = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  for (let n = 0; n < unicos.length; n += 100) {
    const { data, error } = await db.from("perfiles").select("usuario_id,nombre").in("usuario_id", unicos.slice(n, n + 100));
    if (!error) for (const perfil of data ?? []) if (perfil.nombre?.trim()) nombres.set(perfil.usuario_id, perfil.nombre.trim());
  }
  return (id?: string | null) => id ? nombres.get(id) ?? "Responsable sin nombre disponible" : "Sistema / responsable no registrado";
}

export function describirAccionRuta(accion: string) {
  const acciones: Record<string, string> = { confirmar_preparacion: "Preparación de la ruta confirmada", crear: "Ruta creada", seleccionar: "Selección de pedidos actualizada", asignar: "Repartidores asignados", preparar: "Preparación iniciada", autorizar_parcial: "Salida parcial autorizada", resolver_sin_stock: "No entregado — Sin stock · Retirado del reparto", salir: "Salida efectiva registrada", cerrar: "Ruta cerrada", ordenar: "Orden de paradas actualizado", incorporar: "Pedidos incorporados", entregar: "Entrega confirmada", fallida: "Intento de entrega fallido", guardar: "Selección de carga guardada", confirmar: "Carga confirmada", reabrir: "Carga reabierta" };
  return acciones[accion] ?? "Operación administrativa registrada";
}
