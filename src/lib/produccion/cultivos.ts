import type { Configuracion, Unidad } from "./contrato";
// Registro extensible: al añadir cultivos, agregar también su definición al catálogo SQL.
export const cultivos: Record<string, { nombre: string; medida: string; entero: boolean }> = Object.assign(Object.create(null), {
  lechuga: { nombre: "Lechuga", medida: "unidad", entero: true },
  berro: { nombre: "Berro", medida: "kg", entero: false },
});
export function nombreCultivo(cultivo?: string | null) { return cultivos[cultivo ?? "lechuga"]?.nombre ?? cultivo; }
export function cultivoEnFecha(unidad: Unidad, configuraciones: Configuracion[], fecha: string) {
  const vigente = configuraciones.filter(c => c.unidad_id === unidad.id && c.vigente_desde <= fecha)
    .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde))[0];
  return vigente ? vigente.cultivo ?? "lechuga" : unidad.cultivo ?? "lechuga";
}
export function capacidadVisible(c: Configuracion) {
  const cultivo = c.cultivo ?? "lechuga";
  return `${nombreCultivo(cultivo)} · Capacidad máxima: ${Number(c.capacidad ?? c.capacidad_lechugas).toLocaleString("es-CL", { maximumFractionDigits: 12 })} ${cultivos[cultivo]?.medida ?? ""}`;
}
