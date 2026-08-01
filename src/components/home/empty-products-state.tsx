import { PackageOpen } from "lucide-react";
import { EmptyState } from "@/components/feedback/empty-state";

export function EmptyProductsState() {
  return <EmptyState icon={PackageOpen} title="Aún no hay productos disponibles" description="Vuelve más tarde para revisar la selección." />;
}
