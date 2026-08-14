import type { EstadoPedidoAdmin } from "@/lib/admin/pedidos";

const etapas = ["confirmado", "preparando", "listo_despacho", "en_reparto", "entregado"] as const;
const etiquetas = {
  confirmado: "Confirmado",
  preparando: "Preparando",
  listo_despacho: "Listo",
  en_reparto: "En reparto",
  entregado: "Entregado",
} as const;

export function OrderOperationalProgress({ estado }: { estado: EstadoPedidoAdmin }) {
  const indiceActual = etapas.indexOf(estado as typeof etapas[number]);
  return (
    <section aria-label="Progreso operativo" className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-foreground">Progreso operativo</h2>
      <ol className="mt-4 grid gap-2 text-sm sm:grid-cols-5">
        {etapas.map((etapa, indice) => <li key={etapa} className={`rounded-lg px-3 py-2 ${indice <= indiceActual ? "bg-primary/10 font-medium text-primary" : "bg-muted text-muted-foreground"}`}>{etiquetas[etapa]}</li>)}
      </ol>
    </section>
  );
}
