import type { PreparacionEstado } from "@/lib/order-preparation";

export function PreparationStatusBadge({ estado }: { estado: PreparacionEstado | null }) {
  if (!estado) return null;
  const texto = estado === "completa" ? "Preparación completa" : estado === "incompleta" ? "Preparación incompleta" : "Preparación pendiente";
  const estilo = estado === "incompleta" ? "bg-destructive/10 text-destructive" : estado === "completa" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex min-h-7 items-center rounded-full px-2.5 text-xs font-semibold ${estilo}`}>{texto}</span>;
}
