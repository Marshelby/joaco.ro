"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { administradorProduccion } from "@/lib/produccion/servidor";
export type EstadoEntidad = { error?: string; exito?: boolean; incierto?: boolean; conflicto?: boolean };
const esquema = z.object({ clave: z.string().uuid(), entidad: z.enum(["lugar", "unidad"]), id: z.string().uuid(), version: z.coerce.number().int().min(0).max(2147483646), nombre: z.string().trim().min(1).max(160), observaciones: z.string().trim().max(2000), activo: z.enum(["true", "false"]) });
export async function editarEntidad(_: EstadoEntidad, datos: FormData): Promise<EstadoEntidad> {
  const cliente = await administradorProduccion();
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Revisa el nombre (1 a 160 caracteres) y la descripción (máximo 2000)." };
  const v = r.data;
  try {
    const { error } = await cliente.rpc("editar_entidad_produccion", { p_clave_idempotencia: v.clave, p_entidad: v.entidad, p_id: v.id, p_version_esperada: v.version, p_nombre: v.nombre, p_observaciones: v.observaciones || null, p_activo: v.activo === "true" });
    if (error) {
      if (["PGRST202", "42883"].includes(error.code)) return { error: "Falta aplicar el complemento SQL de Producción Fase 5." };
      if (error.message.includes("CLAVE_IDEMPOTENCIA_EN_USO")) return { error: "La solicitud ya se utilizó con otros datos. Recarga para consultar el estado actual.", conflicto: true };
      if (error.code === "23505") return { error: "Ese nombre ya está en uso o está reservado por un registro original. Elige otro." };
      if (error.message.includes("VERSION_PRODUCCION_CONFLICTO")) return { error: "Otro administrador modificó este registro. Recarga para ver la versión actual.", conflicto: true };
      if (error.message.includes("LUGAR_PRODUCCION_INACTIVO")) return { error: "Activa primero el lugar al que pertenece esta unidad." };
      if (error.code === "42501") return { error: "Se requieren permisos de administrador." };
      return { error: "No pudimos confirmar el cambio. Reintenta la misma solicitud.", incierto: true };
    }
  } catch { return { error: "Se interrumpió la conexión. Reintenta la misma solicitud.", incierto: true }; }
  revalidatePath("/admin/produccion", "layout");
  return { exito: true };
}
