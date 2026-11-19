"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { HomeSectionCard } from "@/components/admin/home-section-card";
import { HomeSectionDialog } from "@/components/admin/home-section-dialog";
import { Button } from "@/components/ui/button";
import type { AdminHomeSection, AdminHomeSectionCandidate } from "@/lib/admin-home-sections";

type SeccionEditable = Pick<AdminHomeSection, "slug" | "title" | "description" | "icon">;

export type HomeSectionModal =
  | { type: "crear" }
  | { type: "editar" | "eliminar"; section: SeccionEditable };

export function HomeSectionLoadError() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
      <p role="alert" className="text-sm text-destructive">No se pudieron cargar las secciones de inicio y sus productos.</p>
      <Button variant="outline" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
        {pending ? "Cargando…" : "Reintentar"}
      </Button>
    </div>
  );
}

export function HomeSectionEditor({ sections, products }: { sections: readonly AdminHomeSection[]; products: readonly AdminHomeSectionCandidate[] }) {
  const [modal, setModal] = useState<HomeSectionModal | null>(null);
  const [notice, setNotice] = useState("");
  const trigger = useRef<HTMLElement | null>(null);
  const createButton = useRef<HTMLButtonElement | null>(null);

  function openModal(next: HomeSectionModal, element: HTMLElement) {
    trigger.current = element;
    setNotice("");
    setModal(next);
  }

  return (
    <div className="space-y-5">
      <Button ref={createButton} onClick={(event) => openModal({ type: "crear" }, event.currentTarget)}>
        <Plus aria-hidden="true" /> Nueva sección
      </Button>
      <p role="status" className={notice ? "rounded-lg bg-muted p-3 text-sm" : "sr-only"}>{notice}</p>
      {sections.length === 0 && (
        <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Todavía no hay secciones de inicio.</p>
      )}
      {sections.map((section, index) => (
        <HomeSectionCard
          key={section.slug}
          section={section}
          allProducts={products}
          canMoveUp={index > 0}
          canMoveDown={index < sections.length - 1}
          openModal={openModal}
        />
      ))}
      {modal && (
        <HomeSectionDialog
          modal={modal}
          close={() => setModal(null)}
          complete={(message) => {
            setNotice(message);
            setModal(null);
          }}
          finalFocus={() => trigger.current?.isConnected ? trigger.current : createButton.current}
        />
      )}
    </div>
  );
}
