export type Lugar = { activo: boolean; version: number; id: string; tipo: "nave" | "gallinero"; nombre: string; observaciones: string | null };
export type Unidad = { activo: boolean; version: number; id: string; lugar_id: string; tipo: "meson" | "flores" | "suelo" | "avicola"; nombre: string; observaciones: string | null };
export type Configuracion = { id: string; unidad_id: string; vigente_desde: string; capacidad_lechugas: number | null; cantidad_gallinas: number | null; observaciones: string | null };
export const nombresUnidad = { meson: "Mesón", flores: "Sector de flores", suelo: "Cultivo de suelo", avicola: "Gallinas" };
export function fechaValida(fecha: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || fecha < "0001-01-01" || fecha > "9999-12-31") return false;
  const instante = new Date(`${fecha}T12:00:00Z`);
  return Number.isFinite(instante.getTime()) && instante.toISOString().slice(0, 10) === fecha;
}
export function hoySantiago() {
  const partes = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Santiago", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(tipo => partes.find(p => p.type === tipo)!.value).join("-");
}
export function fechaVisible(fecha: string) { return fecha.split("-").reverse().join("/"); }
