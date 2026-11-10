"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { administradorProduccion } from "@/lib/produccion/servidor";
import { fechaValida } from "@/lib/produccion/contrato";
export type EstadoProduccion = { error?: string; exito?: string; incierto?: boolean; conflicto?: boolean };
const uuid = z.string().uuid();
const nombre = z.string().trim().min(1).max(160);
const observaciones = z.string().trim().max(2000).transform(v => v || null);
const base = z.object({ clave: uuid, nombre, observaciones });
const lugar = base.extend({ tipo: z.enum(["nave", "gallinero"]) });
const unidad = base.extend({ lugar: uuid, tipo: z.enum(["meson", "flores", "suelo"]) });
const configuracion = z.object({ clave: uuid, unidad: uuid, fecha: z.string().refine(fechaValida), cantidad: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(0).max(2147483647)), observaciones });

export async function guardarProduccion(_: EstadoProduccion, datos: FormData): Promise<EstadoProduccion> {
  const cliente = await administradorProduccion();
  const entrada = Object.fromEntries(datos.entries());
  let rpc: string;
  let parametros: Record<string, string | number | null>;
  if (entrada.operacion === "lugar") {
    const r = lugar.safeParse(entrada);
    if (!r.success) return { error: "Revisa tipo, nombre (1 a 160 caracteres) y observaciones (máximo 2000)." };
    rpc = "crear_lugar_produccion";
    parametros = { p_clave_idempotencia: r.data.clave, p_tipo: r.data.tipo, p_nombre: r.data.nombre, p_observaciones: r.data.observaciones };
  } else if (entrada.operacion === "unidad") {
    const r = unidad.safeParse(entrada);
    if (!r.success) return { error: "Revisa la nave, el tipo, el nombre y las observaciones." };
    const { data: nave, error } = await cliente.from("produccion_lugares").select("tipo").eq("id", r.data.lugar).maybeSingle();
    if (error || nave?.tipo !== "nave") return { error: "Selecciona una nave disponible." };
    rpc = "crear_unidad_produccion";
    parametros = { p_clave_idempotencia: r.data.clave, p_lugar_id: r.data.lugar, p_tipo: r.data.tipo, p_nombre: r.data.nombre, p_observaciones: r.data.observaciones };
  } else if (entrada.operacion === "configuracion") {
    const r = configuracion.safeParse(entrada);
    if (!r.success) return { error: "Selecciona una fecha válida y una cantidad entera entre 0 y 2.147.483.647. Observaciones: máximo 2000 caracteres." };
    const { data: u, error } = await cliente.from("produccion_unidades").select("tipo").eq("id", r.data.unidad).maybeSingle();
    if (error || !u || !["meson", "avicola"].includes(u.tipo)) return { error: "Esta unidad no admite configuración de capacidad." };
    if (u.tipo === "meson" && r.data.cantidad < 1) return { error: "La capacidad del mesón debe ser mayor que cero." };
    rpc = "configurar_unidad_produccion";
    parametros = { p_clave_idempotencia: r.data.clave, p_unidad_id: r.data.unidad, p_vigente_desde: r.data.fecha, p_capacidad_lechugas: u.tipo === "meson" ? r.data.cantidad : null, p_cantidad_gallinas: u.tipo === "avicola" ? r.data.cantidad : null, p_observaciones: r.data.observaciones };
  } else return { error: "Operación no disponible." };
  try {
    const { error } = await cliente.rpc(rpc, parametros);
    if (error) {
      if (error.message.includes("PRODUCCION_INACTIV")) return { error: "El lugar o unidad está inactivo. Actívalo desde Configuración antes de continuar." };
      if (error.code === "23505") return { error: entrada.operacion === "configuracion" ? "Ya existe una configuración para esa fecha. El historial se conserva; elige otro inicio de vigencia." : "Ya existe ese nombre. Usa un nombre diferente." };
      if (error.message.includes("CLAVE_IDEMPOTENCIA_EN_USO")) return { error: "La solicitud ya fue utilizada con otros datos. Recarga la página antes de guardar.", conflicto: true };
      if (error.code === "42501") return { error: "No tienes permisos para guardar esta configuración." };
      return { error: "No pudimos confirmar el guardado. Reintenta la misma solicitud sin modificar los datos.", incierto: true };
    }
  } catch { return { error: "No pudimos confirmar el guardado por un problema de conexión. Reintenta con los mismos datos.", incierto: true }; }
  revalidatePath("/admin/produccion", "layout");
  return { exito: entrada.operacion === "configuracion" ? "Configuración guardada. El historial anterior se conserva." : "Creación guardada correctamente." };
}
