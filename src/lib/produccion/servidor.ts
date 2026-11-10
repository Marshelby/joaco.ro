import "server-only";
import { redirect } from "next/navigation";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { Lugar, Unidad, Configuracion } from "./contrato";

export async function administradorProduccion() {
  const cliente = await crearClienteSupabaseServidor();
  const { data, error } = await cliente.auth.getUser();
  if (error || !data.user) redirect("/iniciar-sesion");
  const { data: admin, error: permiso } = await cliente.rpc("es_admin");
  if (permiso || admin !== true) redirect("/");
  return cliente;
}

export async function consultarProduccion() {
  const cliente = await administradorProduccion();
  // Paginación explícita para no truncar silenciosamente el historial por el límite de PostgREST.
  async function leer<T>(tabla: string, columnas: string): Promise<T[]> {
    const filas: T[] = [];
    for (let desde = 0; ; desde += 500) {
      const { data, error } = await cliente.from(tabla).select(columnas).order("id").range(desde, desde + 499);
      if (error && ["42P01", "PGRST205"].includes(error.code)) throw new Error("Falta aplicar el SQL complementario local de Producción Fase 5: supabase/manual/produccion_fase5_complemento.sql.");
      if (error) throw new Error("No fue posible cargar la configuración de producción. Intenta nuevamente.");
      filas.push(...(data as unknown as T[]));
      if (data.length < 500) return filas;
    }
  }
  const [lugares, unidades, configuraciones] = await Promise.all([
    leer<Lugar>("produccion_lugares_actuales", "id,tipo,nombre,observaciones,activo,version"),
    leer<Unidad>("produccion_unidades_actuales", "id,lugar_id,tipo,nombre,observaciones,activo,version"),
    leer<Configuracion>("produccion_configuraciones_unidad", "id,unidad_id,vigente_desde,capacidad_lechugas,cantidad_gallinas,observaciones"),
  ]);
  lugares.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  unidades.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  configuraciones.sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde));
  return { lugares, unidades, configuraciones };
}

export async function consultarActividadesDia(fecha: string) {
  const { fechaValida } = await import("./contrato");
  if (!fechaValida(fecha)) throw new Error("Fecha de producción inválida.");
  const cliente = await administradorProduccion();
  type Version = import("./actividades").ActividadDiaria & { numero_version: number; evento: string };
  const actuales = new Map<string, Version>();
  // Resolver la última versión antes de filtrar fecha: una corrección puede mover el día.
  for (let desde = 0; ; desde += 500) {
    const { data, error } = await cliente.from("produccion_actividad_versiones")
      .select("id,actividad_id,tipo_unidad,numero_version,evento,fecha_operativa,tipo_actividad,cantidad,unidad_medida,observaciones,fecha_registro,produccion_actividades!inner(unidad_id)")
      .order("id").range(desde, desde + 499);
    if (error) throw new Error("No fue posible cargar las actividades del día. Intenta nuevamente.");
    for (const fila of data as unknown as Version[]) {
      const previa = actuales.get(fila.actividad_id);
      if (!previa || fila.numero_version > previa.numero_version) actuales.set(fila.actividad_id, fila);
    }
    if (data.length < 500) break;
  }
  const actividades = [...actuales.values()].filter(v => v.fecha_operativa === fecha && v.evento !== "anulacion").sort((a, b) => b.fecha_registro.localeCompare(a.fecha_registro));
  const compras = actividades.filter(v => v.tipo_actividad === "compra_alimento");
  for (let inicio = 0; inicio < compras.length; inicio += 100) {
    const lote = compras.slice(inicio, inicio + 100);
    const { data, error } = await cliente.from("produccion_compra_importes").select("version_id,precio_total").in("version_id", lote.map(v => v.id));
    // La base original no incluye importes: permitir consultar registros anteriores.
    if (error && !["42P01", "PGRST205"].includes(error.code)) throw new Error("No fue posible consultar los precios de las compras. Intenta nuevamente.");
    for (const importe of data ?? []) {
      const actividad = lote.find(v => v.id === importe.version_id);
      if (actividad) actividad.precio_total = Number(importe.precio_total);
    }
  }
  return actividades;
}
