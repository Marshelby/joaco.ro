import { cultivos } from "./cultivos";
import type { Unidad } from "./contrato";
export const etiquetasActividad = { colecta_huevos: "Colecta de huevos", alimentacion: "Alimentación", compra_alimento: "Compra de alimento", plantacion: "Plantación", cosecha: "Cosecha", perdidas: "Pérdidas", fertilizacion: "Fertilización", riego: "Riego", tratamiento: "Tratamiento", libre: "Actividad libre" };
export type TipoActividad = keyof typeof etiquetasActividad;
export const actividadesUnidad: Record<Unidad["tipo"], TipoActividad[]> = {
  avicola: ["colecta_huevos", "alimentacion", "compra_alimento", "libre"],
  meson: ["plantacion", "cosecha", "perdidas", "fertilizacion", "riego", "libre"],
  flores: ["cosecha", "riego", "tratamiento", "libre"], suelo: [],
};
export function medidasActividad(unidad: Unidad["tipo"], actividad: TipoActividad, cultivo: string = "lechuga"): string[] {
  if (actividad === "alimentacion" || actividad === "compra_alimento") return ["kg", "g"];
  if (unidad === "meson" && ["plantacion", "cosecha", "perdidas"].includes(actividad)) return [cultivos[cultivo]?.medida ?? ""];
  if (actividad === "colecta_huevos") return ["unidad"];
  if (unidad === "flores" && actividad === "cosecha") return ["unidad", "ramo"];
  return [];
}
export type ActividadDiaria = { cultivo?: string | null; id: string; actividad_id: string; tipo_unidad: Unidad["tipo"]; fecha_operativa: string; tipo_actividad: TipoActividad; cantidad: number | null; unidad_medida: string | null; observaciones: string | null; fecha_registro: string; produccion_actividades: { unidad_id: string }; precio_total?: number };
export type VersionActividad = ActividadDiaria & {
  numero_version: number;
  evento: "registro" | "correccion" | "anulacion";
  motivo: string | null;
  autor_id: string;
};
export function registroVisible(fecha: string) {
  return new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" }).format(new Date(fecha));
}
