"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { administradorProduccion } from "@/lib/produccion/servidor";
import { fechaValida } from "@/lib/produccion/contrato";
import { actividadesUnidad, medidasActividad, type VersionActividad, type TipoActividad } from "@/lib/produccion/actividades";
export type EstadoCambio = { error?: string; exito?: boolean; incierto?: boolean; conflicto?: boolean };
const esquema = z.object({ clave: z.string().uuid(), actividad: z.string().uuid(), version: z.string().regex(/^[1-9]\d*$/).refine(v => Number.isSafeInteger(Number(v))), operacion: z.enum(["corregir", "anular"]), motivo: z.string().trim().min(1).max(2000) });
export async function cambiarActividad(_: EstadoCambio, datos: FormData): Promise<EstadoCambio> {
  const cliente = await administradorProduccion();
  const resultado = esquema.safeParse(Object.fromEntries(datos));
  if (!resultado.success) return { error: "Indica un motivo de 1 a 2000 caracteres y una solicitud válida." };
  const v = resultado.data;
  // Validar contra la versión que se mostró, no contra la última: un reintento
  // exitoso debe llegar a la RPC para recuperar su resultado idempotente.
  const { data: original, error: lectura } = await cliente.from("produccion_actividad_versiones")
    .select("tipo_unidad,tipo_actividad,evento").eq("actividad_id", v.actividad).eq("numero_version", Number(v.version)).maybeSingle();
  if (lectura) return { error: "No fue posible validar la versión. Reintenta sin cambiar los datos.", incierto: true };
  if (!original || original.evento === "anulacion") return { error: "Esta versión no permite cambios. Consulta nuevamente el detalle.", conflicto: true };
  const base = { p_clave_idempotencia: v.clave, p_actividad_id: v.actividad, p_version_esperada: Number(v.version), p_motivo: v.motivo };
  let correccion;
  if (v.operacion === "corregir") {
    const fecha = String(datos.get("fecha") ?? "");
    const tipo = String(datos.get("tipo") ?? "") as TipoActividad;
    const cantidadTexto = String(datos.get("cantidad") ?? "");
    const medida = String(datos.get("medida") ?? "");
    const observaciones = String(datos.get("observaciones") ?? "").trim();
    const unidad = original.tipo_unidad as VersionActividad["tipo_unidad"];
    if (!fechaValida(fecha) || !actividadesUnidad[unidad]?.includes(tipo) || observaciones.length > 2000 || (tipo === "libre" && !observaciones)) return { error: "Revisa fecha, actividad y observaciones." };
    // Evitar convertir compras a otro tipo o generar compras sin importe.
    if ((tipo === "compra_alimento" || original.tipo_actividad === "compra_alimento") && tipo !== original.tipo_actividad) return { error: "Para cambiar el tipo o importe de una compra, anúlala y registra una nueva actividad." };
    if (datos.has("precio") || datos.has("p_precio_total")) return { error: "El importe no puede corregirse. Anula la compra y registra una nueva." };
    const obligatorias = medidasActividad(unidad, tipo);
    const permitidas = obligatorias.length ? obligatorias : ["unidad", "kg", "g", "litro", "ml", "ramo"];
    const cantidad = cantidadTexto === "" ? null : Number(cantidadTexto);
    if ((obligatorias.length && cantidad === null) || (cantidad === null ? medida !== "" : !/^\d+(\.\d+)?$/.test(cantidadTexto) || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad >= 1e12 || !permitidas.includes(medida) || (obligatorias.includes("unidad") && !Number.isInteger(cantidad)))) return { error: "Revisa cantidad y unidad de medida; ambas deben estar completas y ser compatibles con la actividad." };
    correccion = { ...base, p_fecha_operativa: fecha, p_tipo_actividad: tipo, p_cantidad: cantidad, p_unidad_medida: medida || null, p_observaciones: observaciones || null };
  }
  try {
    const { error } = correccion ? await cliente.rpc("corregir_actividad_produccion", correccion) : await cliente.rpc("anular_actividad_produccion", base);
    if (error) {
      if (["VERSION_PRODUCCION_CONFLICTO", "ACTIVIDAD_ANULADA"].some(m => error.message.includes(m))) return { error: "La actividad cambió desde que abriste el detalle. Recarga para revisar su última versión antes de continuar.", conflicto: true };
      if (error.message.includes("CLAVE_IDEMPOTENCIA_EN_USO")) return { error: "La solicitud ya fue utilizada con otros datos. Consulta el detalle antes de iniciar otra operación.", conflicto: true };
      if (error.code === "42501") return { error: "La sesión no tiene autorización administrativa.", conflicto: true };
      if (["23514", "23502", "22003", "22007"].includes(error.code)) return { error: "La base rechazó los valores. Revisa los campos y el motivo." };
      return { error: "No pudimos confirmar el cambio. Reintenta la misma solicitud sin modificar los datos.", incierto: true };
    }
  } catch { return { error: "Se interrumpió la conexión. Reintenta la misma solicitud sin modificar los datos.", incierto: true }; }
  revalidatePath("/admin/produccion", "layout");
  return { exito: true };
}
