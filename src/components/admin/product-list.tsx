"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Search, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Button } from "@/components/ui/button";
import { DiscardChangesDialog, useConfirmation } from "@/components/ui/confirmation-dialog";
import type { CategoriaAdmin, ProductoAdmin } from "@/lib/admin/catalogo";

import { ProductForm } from "./product-form";
import { ProductListItem } from "./product-list-item";

export function ProductList({ products, categorias }: { products: readonly ProductoAdmin[]; categorias?: CategoriaAdmin[] }) {
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<{ product: ProductoAdmin; categorias: CategoriaAdmin[] }>();
  const [aviso, setAviso] = useState("");
  const disparador = useRef<HTMLButtonElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const cambios = useRef(false);
  const guardando = useRef(false);
  const [ocupado, setOcupado] = useState(false);
  const descarte = useConfirmation();

  function cerrar() {
    setEditor(undefined);
    requestAnimationFrame(() => {
      (disparador.current?.isConnected ? disparador.current : buscador.current)?.focus();
    });
  }

  function solicitarCierre() {
    if (guardando.current) return false;
    if (cambios.current) {
      descarte.ask(cerrar);
      return false;
    }
    cerrar();
    return true;
  }

  const filteredProducts = useMemo(() => products.filter((product) => `${product.nombre} ${product.categoria}`.toLocaleLowerCase("es-CL").includes(query.toLocaleLowerCase("es-CL"))), [products, query]);

  return (
    <section aria-labelledby="product-list-title" className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 id="product-list-title" className="text-2xl font-semibold tracking-tight text-foreground">Listado de productos</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{filteredProducts.length} {filteredProducts.length === 1 ? "producto" : "productos"}</p></div>
        <form role="search" onSubmit={(event) => event.preventDefault()} className="w-full sm:max-w-xs">
          <label className="sr-only" htmlFor="admin-product-search">Buscar productos</label>
          <div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" /><input ref={buscador} id="admin-product-search" value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="Buscar productos" className="h-11 w-full rounded-lg border border-input bg-background py-2 pl-10 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" /></div>
        </form>
      </div>
      <p role="status" className={aviso ? "rounded-lg bg-muted p-3 text-sm" : "sr-only"}>{aviso}</p>
      {filteredProducts.length > 0 ? (
        <ul className="space-y-3" aria-label="Productos">
          {filteredProducts.map((product) => (
            <ProductListItem key={product.id} product={product} onEdit={categorias ? (event) => {
              disparador.current = event.currentTarget;
              cambios.current = false;
              setAviso("");
              setEditor({ product, categorias });
            } : undefined} />
          ))}
        </ul>
      ) : <EmptyState title="No encontramos productos" description="Prueba con otro nombre o categoría." />}
      {editor && (
        <Dialog.Root open disablePointerDismissal onOpenChange={(open, details) => {
          if (!open && !solicitarCierre()) details.cancel();
        }}>
          <Dialog.Portal>
            <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
            <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
              <Dialog.Popup className="motion-dialog-content flex min-h-0 max-h-[calc(100dvh_-_1rem)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl outline-none sm:max-h-[min(85dvh,calc(100dvh_-_2rem))]">
                <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-2">
                  <div className="min-w-0">
                    <Dialog.Title className="text-lg font-semibold">Editar producto</Dialog.Title>
                    <Dialog.Description className="break-words text-sm text-muted-foreground">{editor.product.nombre}</Dialog.Description>
                  </div>
                  <Dialog.Close render={<Button variant="ghost" className="size-11 p-0" />} disabled={ocupado} aria-label="Cerrar editor">
                    <X aria-hidden="true" />
                  </Dialog.Close>
                </header>
                <ProductForm product={editor.product} categorias={editor.categorias} modal={{
                  onChange: () => { cambios.current = true; },
                  onCancel: solicitarCierre,
                  onSaving: (saving) => { guardando.current = saving; setOcupado(saving); },
                  onSaved: () => { setAviso("Producto guardado."); cerrar(); },
                }} />
                <DiscardChangesDialog confirmation={descarte} />
              </Dialog.Popup>
            </Dialog.Viewport>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </section>
  );
}
