import "server-only";
import { administradorProduccion } from "./servidor";
import type { VersionActividad } from "./actividades";

// Leer todas las versiones antes de filtrar: fecha y actividad pueden cambiar.
// En detalle solo se consulta la actividad solicitada. RLS y sesión administrativa siempre activas.
export async function consultarVersionesProduccion(actividadId?: string) {
  const cliente = await administradorProduccion();
  const versiones: VersionActividad[] = [];
  for (let inicio = 0; ; inicio += 500) {
    let consulta = cliente.from("produccion_actividad_versiones")
      .select("id,actividad_id,tipo_unidad,numero_version,evento,fecha_operativa,tipo_actividad,cantidad,unidad_medida,observaciones,motivo,autor_id,fecha_registro,produccion_actividades!inner(unidad_id)");
    if (actividadId) consulta = consulta.eq("actividad_id", actividadId);
    const { data, error } = await consulta.order("id").range(inicio, inicio + 499);
    if (error) throw new Error("No fue posible consultar el historial de producción. Intenta nuevamente.");
    versiones.push(...data as unknown as VersionActividad[]);
    if (data.length < 500) break;
  }
  const compras = versiones.filter(v => v.tipo_actividad === "compra_alimento");
  for (let inicio = 0; inicio < compras.length; inicio += 100) {
    const lote = compras.slice(inicio, inicio + 100);
    const { data, error } = await cliente.from("produccion_compra_importes").select("version_id,precio_total").in("version_id", lote.map(v => v.id));
    if (error) throw new Error("No fue posible consultar los importes históricos de las compras.");
    const importes = new Map((data ?? []).map(i => [i.version_id, Number(i.precio_total)]));
    for (const version of lote) version.precio_total = importes.get(version.id);
  }
  return versiones.sort((a, b) => b.numero_version - a.numero_version);
}
