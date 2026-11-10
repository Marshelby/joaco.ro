import type { ReactNode } from "react";
import { Bird, Droplets, Flower2, Leaf, Sprout, Warehouse } from "lucide-react";

export function IconoLugar({ tipo }: { tipo: string }) {
  const Icono = tipo === "gallinero" ? Bird : Warehouse;
  return <span className={`prod-icon ${tipo === "gallinero" ? "prod-tone-avicola" : "prod-tone-lechuga"}`}><Icono size={23} aria-hidden="true" /></span>;
}
export function IdentidadUnidad({ tipo, cultivo, children }: { tipo: string; cultivo?: string | null; children?: ReactNode }) {
  const tono = tipo === "meson" ? cultivo === "berro" ? "berro" : "lechuga" : tipo;
  const Icono = tono === "berro" ? Droplets : tono === "flores" ? Flower2 : tono === "suelo" ? Sprout : tono === "avicola" ? Bird : Leaf;
  return <span className={`prod-crop prod-tone-${tono}`}><Icono size={16} aria-hidden="true" />{children}</span>;
}
export function EstadoProduccion({ activo, children }: { activo: boolean; children?: ReactNode }) {
  return <span className={`prod-status ${activo ? "prod-status-active" : "prod-status-inactive"}`}><span aria-hidden="true" />{children ?? (activo ? "Activo" : "Inactivo")}</span>;
}
export function CabeceraProduccion({ etiqueta, titulo, descripcion, children }: { etiqueta: string; titulo: string; descripcion: string; children?: ReactNode }) {
  return <div className="prod-page-heading"><div><p className="prod-eyebrow">{etiqueta}</p><h1>{titulo}</h1><p className="prod-description">{descripcion}</p></div>{children && <div className="prod-heading-actions">{children}</div>}</div>;
}
