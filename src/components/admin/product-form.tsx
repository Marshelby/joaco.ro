"use client";

import { useActionState, useState } from "react";

import { guardarProductoAdmin, type EstadoGuardadoProducto } from "@/app/(admin)/admin/productos/actions";
import { ActionLink } from "@/components/ui/action-link";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { ROUTES } from "@/config/routes";
import type { CategoriaAdmin, ProductoAdmin } from "@/lib/admin/catalogo";

const inicial: EstadoGuardadoProducto = {};
const campo = "mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function crearSlug(nombre: string) {
  return nombre
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-CL")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function precioConIva(valor: string) {
  const precioNeto = Number(valor);
  return Number.isFinite(precioNeto) && precioNeto >= 0 ? String(Math.round(precioNeto * 1.19)) : "";
}

export function ProductForm({ product, categorias }: { product?: ProductoAdmin; categorias: CategoriaAdmin[] }) {
  const [estado, accion, pendiente] = useActionState(guardarProductoAdmin, inicial);
  const [nombre, setNombre] = useState(product?.nombre ?? "");
  const [slugCreado, setSlugCreado] = useState("");
  const [precioNeto, setPrecioNeto] = useState(String(product?.presentacion.precioNeto ?? 0));
  const [precioFinal, setPrecioFinal] = useState(String(product?.presentacion.precioFinal ?? 0));
  const [precioFinalManual, setPrecioFinalManual] = useState(() => product ? product.presentacion.precioFinal !== Math.round(product.presentacion.precioNeto * 1.19) : false);
  const [errorCliente, setErrorCliente] = useState<string>();
  const presentacion = product?.presentacion;
  const slug = product?.slug ?? slugCreado;

  const actualizarNombre = (valor: string) => {
    setNombre(valor);
    if (!product) setSlugCreado(crearSlug(valor));
  };

  const actualizarPrecioNeto = (valor: string) => {
    setPrecioNeto(valor);
    if (!precioFinalManual) setPrecioFinal(precioConIva(valor));
  };

  const recalcularIva = () => {
    setPrecioFinal(precioConIva(precioNeto));
    setPrecioFinalManual(false);
  };

  const validarEnvio = (event: React.FormEvent<HTMLFormElement>) => {
    const neto = Number(precioNeto);
    const final = Number(precioFinal);
    const cantidad = Number(new FormData(event.currentTarget).get("cantidad"));
    if (!Number.isFinite(cantidad) || cantidad <= 0) {
      event.preventDefault();
      setErrorCliente("La cantidad de la presentación debe ser mayor que cero.");
      return;
    }
    if (!Number.isInteger(neto) || !Number.isInteger(final) || neto < 0 || final < neto) {
      event.preventDefault();
      setErrorCliente("Ingresa precios enteros no negativos y un precio final igual o mayor que el neto.");
      return;
    }
    setErrorCliente(undefined);
  };

  return (
    <form action={accion} onSubmit={validarEnvio} className="space-y-5" aria-label="Formulario de producto">
      <input name="id" type="hidden" value={product?.id ?? ""} />
      <input name="slug" type="hidden" value={slug} />
      <input name="rutaImagen" type="hidden" value={product?.rutaImagen ?? ""} />

      {estado.error || errorCliente ? <p role="alert" className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">{errorCliente ?? estado.error}</p> : null}

      <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold text-foreground">Información</h2><p className="mt-1 text-sm text-muted-foreground">Datos principales para identificar el producto.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label className="sm:col-span-2">Nombre<input required name="nombre" value={nombre} onChange={(event) => actualizarNombre(event.target.value)} className={campo} /></label>
          <label className="sm:col-span-2">Descripción<textarea name="descripcion" defaultValue={product?.descripcion ?? ""} className="mt-2 min-h-28 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50" /></label>
          <label>Categoría<select required name="categoriaId" defaultValue={product?.categoriaId ?? ""} className={campo}><option value="">Selecciona una categoría</option>{categorias.map((categoria) => <option key={categoria.id} value={categoria.id}>{categoria.nombre}</option>)}</select></label>
          <div className="self-end text-sm text-muted-foreground">{product ? <>Slug: <span className="font-mono text-foreground">{product.slug}</span></> : <>Slug generado: <span className="font-mono text-foreground">{slug || "se generará desde el nombre"}</span></>}</div>
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold text-foreground">Comercial</h2><p className="mt-1 text-sm text-muted-foreground">Presentación principal y precios de referencia.</p></div>
        <div className="grid gap-5 sm:grid-cols-2">
          <label>Nombre de presentación<input required name="presentacionNombre" defaultValue={presentacion?.nombre ?? "1 unidad"} className={campo} /></label>
          <label>Cantidad<input required min="0.001" step="0.001" name="cantidad" type="number" defaultValue={presentacion?.cantidad ?? 1} className={campo} /></label>
          <label>Unidad<select required name="unidad" defaultValue={presentacion?.unidad ?? "UND"} className={campo}><option value="KG">KG</option><option value="GR">GR</option><option value="UND">UND</option></select></label>
          <div className="hidden sm:block" aria-hidden="true" />
          <label>Precio neto CLP<input required min="0" step="1" inputMode="numeric" name="precioNeto" type="number" value={precioNeto} onChange={(event) => actualizarPrecioNeto(event.target.value)} className={campo} /></label>
          <div>
            <label htmlFor="precio-final">Precio final con IVA</label>
            <input required id="precio-final" min="0" step="1" inputMode="numeric" name="precioFinal" type="number" value={precioFinal} onChange={(event) => { setPrecioFinal(event.target.value); setPrecioFinalManual(true); }} className={campo} />
            <div className="mt-2 flex flex-wrap items-center gap-2"><p className="text-xs text-muted-foreground">{precioFinalManual ? "Ajuste manual" : "Calculado con IVA 19%"}</p><Button type="button" variant="ghost" size="sm" onClick={recalcularIva}>Recalcular IVA 19%</Button></div>
          </div>
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
        <div><h2 className="text-lg font-semibold text-foreground">Visibilidad</h2><p className="mt-1 text-sm text-muted-foreground">Controla la disponibilidad y las etiquetas comerciales.</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          {[["activo", product?.activo ?? true, "Activo"], ["disponible", product?.disponible ?? true, "Disponible"], ["destacado", product?.destacado ?? false, "Destacado"], ["masVendido", product?.masVendido ?? false, "Más vendido"], ["nuevo", product?.nuevo ?? false, "Nuevo"]].map(([name, checked, label]) => <label key={String(name)} className="flex min-h-11 items-center gap-2 text-sm text-foreground"><input name={String(name)} type="checkbox" defaultChecked={Boolean(checked)} />{String(label)}</label>)}
          <label className="sm:col-span-2 sm:max-w-xs">Orden de visualización<input required min="0" name="orden" type="number" defaultValue={product?.orden ?? 0} className={campo} /></label>
        </div>
      </section>

      <footer className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end"><ActionLink href={ROUTES.adminProducts} variant="secondary">Cancelar</ActionLink><PendingButton type="submit" pending={pendiente} pendingLabel="Guardando…">Guardar producto</PendingButton></footer>
    </form>
  );
}
