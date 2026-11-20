export { esFechaCalendario as fechaValida, hoySantiago } from "@/lib/operational-date";

export type Lugar = { activo: boolean; version: number; id: string; tipo: "nave" | "gallinero"; nombre: string; observaciones: string | null };
export type Unidad = { cultivo?: string | null; activo: boolean; version: number; id: string; lugar_id: string; tipo: "meson" | "flores" | "suelo" | "avicola"; nombre: string; observaciones: string | null };
export type Configuracion = { cultivo?: string | null; capacidad?: number | null; id: string; unidad_id: string; vigente_desde: string; capacidad_lechugas: number | null; cantidad_gallinas: number | null; observaciones: string | null };
export const nombresUnidad = { meson: "Mesón", flores: "Sector de flores", suelo: "Cultivo de suelo", avicola: "Gallinas" };
export function fechaVisible(fecha: string) { return fecha.split("-").reverse().join("/"); }
