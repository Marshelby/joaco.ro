"use client";

import { useActionState } from "react";
import { guardarProductoAdmin, type EstadoGuardadoProducto } from "@/app/(admin)/admin/productos/actions";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import type { CategoriaAdmin, ProductoAdmin } from "@/lib/admin/catalogo";

const inicial: EstadoGuardadoProducto = {};
export function ProductForm({ product, categorias }: { product?: ProductoAdmin; categorias: CategoriaAdmin[] }) {
  const [estado, accion, pendiente] = useActionState(guardarProductoAdmin, inicial);
  const p = product?.presentacion;
  const campo = "mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm";
  return <form action={accion} className="space-y-5" aria-label="Formulario de producto"><input name="id" type="hidden" value={product?.id ?? ""} />
    {estado.error ? <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{estado.error}</p> : null}
    <section className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"><label>Nombre<input required name="nombre" defaultValue={product?.nombre} className={campo} /></label><label>Slug<input required name="slug" defaultValue={product?.slug} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={campo} /></label><label className="sm:col-span-2">Descripción<textarea name="descripcion" defaultValue={product?.descripcion ?? ""} className="mt-2 min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm" /></label><label>Categoría<select required name="categoriaId" defaultValue={product?.categoriaId ?? ""} className={campo}><option value="">Selecciona una categoría</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}{categoria.activa ? "" : " (inactiva)"}</option>)}</select></label><label>Orden<input required min="0" name="orden" type="number" defaultValue={product?.orden ?? 0} className={campo} /></label><label className="sm:col-span-2">Ruta de imagen<input name="rutaImagen" defaultValue={product?.rutaImagen ?? ""} className={campo} placeholder="/products/... (opcional)" /></label></section>
    <section className="grid gap-5 rounded-xl border border-border bg-card p-5 sm:grid-cols-2"><h2 className="sm:col-span-2 text-lg font-semibold">Presentación principal y precios</h2><label>Nombre presentación<input required name="presentacionNombre" defaultValue={p?.nombre ?? "1 UND"} className={campo} /></label><label>Cantidad<input required min="0.001" step="0.001" name="cantidad" type="number" defaultValue={p?.cantidad ?? 1} className={campo} /></label><label>Unidad<input required name="unidad" defaultValue={p?.unidad ?? "UND"} className={campo} /></label><label>Precio neto CLP<input required min="0" step="1" name="precioNeto" type="number" defaultValue={p?.precioNeto ?? 0} className={campo} /></label><label>Precio final CLP<input required min="0" step="1" name="precioFinal" type="number" defaultValue={p?.precioFinal ?? 0} className={campo} /></label></section>
    <section className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold">Estado editorial</h2><div className="mt-4 grid gap-3 sm:grid-cols-2">{[["activo",product?.activo ?? true,"Activo"],["disponible",product?.disponible ?? true,"Disponible"],["destacado",product?.destacado ?? false,"Destacado"],["masVendido",product?.masVendido ?? false,"Más vendido"],["nuevo",product?.nuevo ?? false,"Nuevo"],["presentacionActiva",p?.activa ?? true,"Presentación activa"]].map(([name, checked, label]) => <label key={String(name)} className="flex gap-2 text-sm"><input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} />{String(label)}</label>)}</div></section>
    <footer className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><ActionLink href={ROUTES.adminProducts} variant="secondary">Cancelar</ActionLink><Button disabled={pendiente} type="submit">{pendiente ? "Guardando..." : "Guardar producto"}</Button></footer>
  </form>;
}
