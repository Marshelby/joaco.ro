"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import { useActionState } from "react";

import { gestionarSeccionInicio, type EstadoSeccionInicio } from "@/app/(admin)/admin/secciones-inicio/actions";
import type { HomeSectionModal } from "@/components/admin/home-section-editor";
import { HomeSectionProductRow } from "@/components/admin/home-section-product-row";
import { HomeSectionToolbar } from "@/components/admin/home-section-toolbar";
import { SectionMoveButton } from "@/components/admin/section-move-button";
import { Button } from "@/components/ui/button";
import { PendingButton } from "@/components/ui/pending-button";
import type { AdminHomeSection, AdminHomeSectionCandidate } from "@/lib/admin-home-sections";
import { HOME_SECTION_ICONS } from "@/lib/home-section-icons";

export function HomeSectionCard({ section, allProducts, canMoveUp, canMoveDown, openModal }: {
  section: AdminHomeSection;
  allProducts: readonly AdminHomeSectionCandidate[];
  canMoveUp: boolean;
  canMoveDown: boolean;
  openModal: (modal: HomeSectionModal, element: HTMLElement) => void;
}) {
  const [state, action, pending] = useActionState(async (_previous: EstadoSeccionInicio, data: FormData): Promise<EstadoSeccionInicio> => {
    try {
      return await gestionarSeccionInicio({}, data);
    } catch {
      return { error: "No pudimos confirmar el cambio. Recarga la pestaña para comprobar el resultado." };
    }
  }, {});
  const { Icon } = HOME_SECTION_ICONS[section.icon];

  return (
    <section aria-labelledby={`home-section-${section.slug}`} className="overflow-visible rounded-xl border border-border bg-card">
      <header className="space-y-4 border-b border-border p-4 sm:p-6">
        <div className="flex min-w-0 items-start gap-3">
          <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
          <div className="min-w-0 space-y-1">
            <h2 id={`home-section-${section.slug}`} className="break-words text-lg font-semibold tracking-tight">{section.title}</h2>
            {section.description && <p className="max-w-2xl break-words text-sm leading-6 text-muted-foreground">{section.description}</p>}
            <p className="text-sm text-muted-foreground">{section.active ? "Activa" : "Inactiva"}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form action={action} className="flex gap-2">
            <input type="hidden" name="operacion" value="mover" />
            <input type="hidden" name="seccionSlug" value={section.slug} />
            <SectionMoveButton icon={ArrowUp} label={`Subir sección ${section.title}`} direction="arriba" disabled={!canMoveUp} pending={pending} />
            <SectionMoveButton icon={ArrowDown} label={`Bajar sección ${section.title}`} direction="abajo" disabled={!canMoveDown} pending={pending} />
          </form>
          <form action={action}>
            <input type="hidden" name="operacion" value="visibilidad" />
            <input type="hidden" name="seccionSlug" value={section.slug} />
            <input type="hidden" name="activa" value={String(!section.active)} />
            <PendingButton type="submit" variant="outline" pending={pending} pendingLabel="Actualizando…"
              aria-label={`${section.active ? "Desactivar" : "Activar"} ${section.title}`}>
              {section.active ? "Desactivar" : "Activar"}
            </PendingButton>
          </form>
          <Button variant="outline" disabled={pending} aria-label={`Editar ${section.title}`}
            onClick={(event) => openModal({ type: "editar", section }, event.currentTarget)}>
            <Pencil aria-hidden="true" /> Editar
          </Button>
          <Button variant="destructive" disabled={pending} aria-label={`Eliminar ${section.title}`}
            onClick={(event) => openModal({ type: "eliminar", section }, event.currentTarget)}>
            <Trash2 aria-hidden="true" /> Eliminar
          </Button>
          <HomeSectionToolbar products={allProducts} sectionSlug={section.slug} assignedProductIds={section.products.map((product) => product.productId)} />
        </div>
        {state.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
        {state.exito && <p role="status" className="sr-only">{state.exito}</p>}
      </header>
      {section.products.length > 0 ? (
        <ol className="divide-y divide-border">
          {section.products.map((product, index) => (
            <HomeSectionProductRow key={product.assignmentId} product={product} position={index + 1} canMoveUp={index > 0} canMoveDown={index < section.products.length - 1} />
          ))}
        </ol>
      ) : <p className="p-4 text-sm text-muted-foreground sm:p-6">Esta sección aún no tiene productos.</p>}
    </section>
  );
}
