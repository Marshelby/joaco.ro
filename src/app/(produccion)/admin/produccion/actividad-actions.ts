"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { administradorProduccion } from "@/lib/produccion/servidor";
import { fechaValida, type Unidad } from "@/lib/produccion/contrato";
import { actividadesUnidad, medidasActividad, type TipoActividad } from "@/lib/produccion/actividades";
export type EstadoActividad = { error?: string; exito?: boolean; incierto?: boolean };
const esquema = z.object({ clave: z.string().uuid(), lugar: z.string().uuid(), unidad: z.string().uuid(), fecha: z.string().refine(fechaValida), tipo: z.string(), cantidad: z.string(), medida: z.string(), precio: z.string(), observaciones: z.string().trim().max(2000) });
export async function registrarActividad(_: EstadoActividad, datos: FormData): Promise<EstadoActividad> {
  const cliente = await administradorProduccion();
  const r = esquema.safeParse(Object.fromEntries(datos));
  if (!r.success) return { error: "Revisa fecha, lugar, unidad y observaciones (máximo 2000 caracteres)." };
  const v = r.data;
  const { data: unidad, error: consulta } = await cliente.from("produccion_unidades").select("tipo,lugar_id").eq("id", v.unidad).maybeSingle();
  if (consulta || !unidad || unidad.lugar_id !== v.lugar) return { error: "Selecciona una unidad disponible del lugar elegido." };
  const tipoUnidad = unidad.tipo as Unidad["tipo"];
  const tipo = v.tipo as TipoActividad;
  if (!actividadesUnidad[tipoUnidad]?.includes(tipo)) return { error: "Esta actividad no es compatible con la unidad seleccionada." };
  const medidas = medidasActividad(tipoUnidad, tipo);
  let cantidad: number | null = null;
  if (medidas.length) {
    cantidad = Number(v.cantidad);
    if (!/^\d+(\.\d+)?$/.test(v.cantidad) || !Number.isFinite(cantidad) || cantidad <= 0 || cantidad >= 1e12 || !medidas.includes(v.medida)) return { error: "Ingresa una cantidad mayor que cero y menor que un billón, con una unidad válida." };
    if (medidas.includes("unidad") && !Number.isInteger(cantidad)) return { error: "La cantidad de huevos, lechugas o flores debe ser entera." };
  } else if (v.cantidad || v.medida) return { error: "Esta actividad solo requiere observaciones." };
  if (tipo === "libre" && !v.observaciones) return { error: "Describe la actividad realizada." };
  const compra = tipo === "compra_alimento";
  const precio = Number(v.precio);
  if (compra && (!/^\d+(\.\d{1,2})?$/.test(v.precio) || !Number.isFinite(precio) || precio <= 0 || precio >= 1e12)) return { error: "Ingresa un precio total en pesos mayor que cero y menor que un billón, con hasta dos decimales." };
  if (!compra && v.precio) return { error: "El precio corresponde solamente a compras de alimento." };
  try {
    const parametros = { p_clave_idempotencia: v.clave, p_unidad_id: v.unidad, p_fecha_operativa: v.fecha, p_tipo_actividad: tipo, p_cantidad: cantidad, p_unidad_medida: medidas.length ? v.medida : null, p_observaciones: v.observaciones || null };
    const { error } = await cliente.rpc("registrar_actividad_produccion", compra ? { ...parametros, p_precio_total: precio } : parametros);
    if (error) {
      if (error.message.includes("PRODUCCION_INACTIV")) return { error: "El lugar o unidad está inactivo. Actívalo desde Configuración para registrar nuevas actividades." };
      if (error.code === "PGRST202" || error.code === "42883") return { error: "La compra requiere aplicar el complemento SQL local de Fase 3 para guardar el precio total. Las otras actividades están disponibles." };
      if (error.message.includes("CLAVE_IDEMPOTENCIA_EN_USO")) return { error: "Esta solicitud ya se utilizó con otros datos. Reintenta con los datos originales o consulta el día antes de iniciar otro registro.", incierto: true };
      if (error.code === "42501") return { error: "Tu sesión no tiene permisos administrativos para registrar actividades." };
      if (error.code === "23514" || error.code === "23502" || error.code === "22003") return { error: "La base rechazó los valores. Revisa cantidad, unidad y descripción." };
      return { error: "No pudimos confirmar el registro. Reintenta con los mismos datos y la misma solicitud.", incierto: true };
    }
  } catch { return { error: "Se interrumpió la conexión. Reintenta con los mismos datos para evitar duplicados.", incierto: true }; }
  revalidatePath("/admin/produccion");
  revalidatePath("/admin/produccion/historial");
  return { exito: true };
}
