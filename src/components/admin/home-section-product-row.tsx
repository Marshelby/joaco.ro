"use client";

import { ChevronDown, ChevronUp, X } from "lucide-react";
import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";

import { moverProductoSeccionInicio, quitarProductoSeccionInicio } from "@/app/(admin)/admin/secciones-inicio/actions";
import { CatalogImage } from "@/components/media/catalog-image";
import { PendingButton } from "@/components/ui/pending-button";
import type { AdminHomeSectionProduct } from "@/lib/admin-home-sections";
import { SectionMoveButton } from "./section-move-button";

export function HomeSectionProductRow({ product, position, canMoveUp, canMoveDown }: { product: AdminHomeSectionProduct; position: number; canMoveUp: boolean; canMoveDown: boolean }) {
  const router = useRouter();
  const [estadoMovimiento, accionMovimiento, moviendo] = useActionState(moverProductoSeccionInicio, {});
  const [estadoQuitar, accionQuitar, quitando] = useActionState(quitarProductoSeccionInicio, {});
  const exito = estadoMovimiento.exito ?? estadoQuitar.exito;
  const error = estadoMovimiento.error ?? estadoQuitar.error;

  useEffect(() => {
    if (exito) router.refresh();
  }, [exito, router]);

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-4 sm:grid-cols-[2rem_4rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4 sm:p-5">
      <p className="hidden text-sm font-semibold text-muted-foreground sm:block" aria-label={`Posición ${position}`}>{position}.</p>
      <div className="relative size-14 overflow-hidden rounded-lg border border-border bg-muted sm:size-16">
        <CatalogImage image={product.rutaImagen ? { src: product.rutaImagen, alt: "", fit: "contain" } : undefined} fallback={product.imageFallback} sizes="(min-width: 640px) 64px, 56px" fallbackIconClassName="size-7" />
      </div>
      <div className="min-w-0 self-center">
        <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
        <p className="mt-1 text-sm text-muted-foreground">{product.category}{!product.activo ? " · Inactivo" : !product.disponible ? " · No disponible" : ""}</p>
      </div>
      <div className="col-span-2 flex flex-wrap items-center justify-end gap-2 border-t border-border pt-3 sm:col-span-1 sm:border-0 sm:pt-0">
        <form action={accionMovimiento} className="flex items-center gap-2">
          <input type="hidden" name="asignacionId" value={product.assignmentId} />
          <SectionMoveButton icon={ChevronUp} label={`Mover ${product.name} hacia arriba`} direction="arriba" disabled={!canMoveUp || moviendo || quitando} pending={moviendo} />
          <SectionMoveButton icon={ChevronDown} label={`Mover ${product.name} hacia abajo`} direction="abajo" disabled={!canMoveDown || moviendo || quitando} pending={moviendo} />
        </form>
        <form action={accionQuitar}>
          <input type="hidden" name="asignacionId" value={product.assignmentId} />
          <PendingButton type="submit" variant="ghost" className="h-11 px-3 text-destructive hover:text-destructive" aria-label={`Quitar ${product.name} de esta sección`} pending={quitando} pendingLabel="Quitando…" disabled={moviendo}> <X aria-hidden="true" />Quitar</PendingButton>
        </form>
        {error ? <p aria-live="polite" className="basis-full text-right text-sm text-destructive">{error}</p> : null}
      </div>
    </li>
  );
}
