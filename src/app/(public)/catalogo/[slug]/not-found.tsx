import { PackageSearch } from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ActionLink } from "@/components/ui/action-link";
import { Container } from "@/components/layout/container";
import { ROUTES } from "@/config/routes";

export default function ProductNotFound() {
  return (
    <Container className="py-10 sm:py-16">
      <EmptyState
        headingLevel="h1"
        icon={PackageSearch}
        title="Producto no encontrado"
        description="No pudimos encontrar el producto que buscas."
        action={<div className="flex flex-wrap justify-center gap-3">
          <ActionLink href={ROUTES.catalog}>Volver al catálogo</ActionLink>
          <ActionLink href={ROUTES.home} variant="secondary">Volver al inicio</ActionLink>
        </div>}
      />
    </Container>
  );
}
