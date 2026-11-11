"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type ResumenCierre = {
  fecha: string; estado: "en_ruta" | "cerrada"; version: number; huella: string;
  cerrada_en?: string; cerrada_por?: string;
  pedidos: { id: string; numero: string; cliente: string; estado: string; version: number; motivo: string | null }[];
};
export type SolicitudCierre = { fecha: string; version: number; clave: string; huella: string };
const fechaValida = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)
  && Number(v.slice(0, 4)) > 0 && !Number.isNaN(Date.parse(`${v}T12:00:00Z`))
  && new Date(`${v}T12:00:00Z`).toISOString().slice(0, 10) === v;
const mensajes: Record<string, string> = {
  NO_AUTORIZADO: "No tienes permisos administrativos para cerrar rutas.",
  CARGA_NO_SALIO: "La carga no está en ruta o ya fue cerrada. Actualiza la revisión.",
  VERSION_CARGA_CONFLICTO: "La carga cambió. Actualiza la revisión antes de cerrar.",
  RESUMEN_CIERRE_CONFLICTO: "Los pedidos cambiaron durante la revisión. Actualiza el resumen antes de cerrar.",
  PEDIDOS_PENDIENTES: "Resuelve los pedidos pendientes antes de cerrar.",
  CARGA_VACIA: "No se puede cerrar una carga vacía.",
  CLAVE_IDEMPOTENCIA_EN_USO: "Esta clave pertenece a otra solicitud. Actualiza la revisión.",
};
function resumenValido(data: ResumenCierre | null, fecha: string): data is ResumenCierre {
  return !!data && data.fecha === fecha && ["en_ruta", "cerrada"].includes(data.estado)
    && Number.isSafeInteger(data.version) && data.version >= 0 && /^[0-9a-f]{64}$/.test(data.huella)
    && Array.isArray(data.pedidos) && data.pedidos.every(p => typeof p.id === "string"
      && typeof p.estado === "string" && Number.isSafeInteger(p.version) && p.version >= 0);
}
export async function revisarCierreRuta(fecha: string): Promise<{ resumen?: ResumenCierre; error?: string }> {
  if (!fechaValida(fecha)) return { error: "Fecha inválida." };
  try {
    const db = await crearClienteSupabaseServidor();
    const { data, error } = await db.rpc("revisar_cierre_ruta", { p_fecha: fecha });
    if (error) return { error: mensajes[error.message] ?? "No se pudo revisar el cierre. Comprueba el complemento SQL manual de Fase 2." };
    if (!resumenValido(data, fecha)) return { error: "No se pudo verificar el resumen de la carga." };
    return { resumen: data };
  } catch { return { error: "No se pudo recuperar el resumen. Reintenta." }; }
}
export async function cerrarRuta(s: SolicitudCierre): Promise<{ resumen?: ResumenCierre; error?: string }> {
  if (!s || !fechaValida(s.fecha) || !Number.isSafeInteger(s.version) || s.version < 0 || s.version >= Number.MAX_SAFE_INTEGER
    || typeof s.clave !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.clave)
    || typeof s.huella !== "string" || !/^[0-9a-f]{64}$/.test(s.huella)) return { error: "Revisa el resumen antes de cerrar." };
  let resumen: ResumenCierre;
  try {
    const db = await crearClienteSupabaseServidor();
    // La RPC autoriza y resuelve idempotencia antes de validar el estado actual.
    const { data, error } = await db.rpc("cerrar_ruta", { p_fecha: s.fecha, p_version: s.version, p_clave: s.clave, p_huella: s.huella });
    if (error) return { error: mensajes[error.message] ?? "No se pudo verificar el cierre. Reintenta con la misma solicitud." };
    if (!resumenValido(data, s.fecha) || data.estado !== "cerrada") return { error: "Respuesta sin verificar. Reintenta con la misma solicitud." };
    resumen = data;
  } catch { return { error: "No se recibió respuesta. Reintenta con la misma solicitud para recuperar el resultado." }; }
  for (const ruta of ["/admin/rutas", "/admin/pedidos", "/reparto"]) {
    try { revalidatePath(ruta, "layout"); } catch { /* El cliente también refresca. */ }
  }
  return { resumen };
}
