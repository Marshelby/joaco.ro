"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { agregarProductoSeccionInicio } from "@/app/(admin)/admin/secciones-inicio/actions";
import { buttonVariants } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import { cn } from "@/lib/utils";
import type { AdminHomeSectionCandidate, HomeSectionSlug } from "@/lib/admin-home-sections";

export function HomeSectionToolbar({ products, sectionSlug, assignedProductIds }: { products: readonly AdminHomeSectionCandidate[]; sectionSlug: HomeSectionSlug; assignedProductIds: readonly string[] }) {
  const router = useRouter();
  const [estado, accion, pendiente] = useActionState(agregarProductoSeccionInicio, {});
  const candidates = products.filter((product) => !assignedProductIds.includes(product.id));

  useEffect(() => {
    if (estado.exito) router.refresh();
  }, [estado.exito, router]);

  return (
    <details className="group relative">
      <summary className={cn(buttonVariants(), "flex cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
        <Plus aria-hidden="true" />Agregar producto
      </summary>
      <form action={accion} className="absolute right-0 z-10 mt-2 w-full min-w-72 rounded-xl border border-border bg-card p-4 shadow-lg sm:w-80">
        <input type="hidden" name="seccionSlug" value={sectionSlug} />
        <label htmlFor={`home-section-selector-${sectionSlug}`} className="text-sm font-medium text-foreground">Seleccionar producto</label>
        <select required id={`home-section-selector-${sectionSlug}`} name="productoId" defaultValue="" disabled={candidates.length === 0 || pendiente} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="">Elige un producto</option>
          {candidates.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
        </select>
        <div className="mt-3 flex items-center justify-between gap-3"><p className="text-xs leading-5 text-muted-foreground">{candidates.length > 0 ? "Se agregará al final de esta sección." : "Todos los productos disponibles ya están asignados."}</p><PendingButton type="submit" pending={pendiente} pendingLabel="Agregando…" disabled={candidates.length === 0}>Agregar</PendingButton></div>
        {estado.error ? <p aria-live="polite" className="mt-3 text-sm text-destructive">{estado.error}</p> : null}
      </form>
    </details>
  );
}
