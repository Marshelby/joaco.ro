import { getClosedPresentationKind } from "@/lib/cart-quantity";
import type { ResumenProductoEntrega } from "@/lib/admin/pedidos";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";

type DeliveryProductsSummaryProps = {
  productos: readonly ResumenProductoEntrega[];
  variant?: "full" | "compact";
};

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("es-CL");
}

function mostrarPresentacion(item: ResumenProductoEntrega) {
  if (!item.presentacion) return false;

  const presentacion = normalizarTexto(item.presentacion);
  if (presentacion === normalizarTexto(item.producto)) return false;
  if (getClosedPresentationKind(item.presentacion)) return true;

  return !["unidad", "unidades", "und", "kg", "kilogramo", "kilogramos"].includes(presentacion);
}

function ListaProductosNecesarios({ productos }: Pick<DeliveryProductsSummaryProps, "productos">) {
  if (productos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay productos para preparar en esta jornada.</p>;
  }

  return (
    <ul className="grid gap-x-5 sm:grid-cols-2 xl:grid-cols-3">
      {productos.map((item) => (
        <li key={item.clave} className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-3">
          <div className="min-w-0">
            <h3 className="break-words text-sm font-medium text-foreground">{item.producto}</h3>
            {mostrarPresentacion(item) ? <p className="mt-0.5 break-words text-xs text-muted-foreground">{item.presentacion}</p> : null}
          </div>
          <p className="shrink-0 text-sm font-semibold text-foreground">
            {formatearCantidadPreparacionEntrega(item.cantidadTotal, item.presentacion, item.unidad)}
          </p>
        </li>
      ))}
    </ul>
  );
}

export function DeliveryProductsSummary({ productos, variant = "full" }: DeliveryProductsSummaryProps) {
  if (variant === "compact") return <ListaProductosNecesarios productos={productos} />;

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="productos-necesarios-title">
      <div>
        <h2 id="productos-necesarios-title" className="text-lg font-semibold tracking-tight text-foreground">Productos necesarios</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {productos.length} {productos.length === 1 ? "línea de preparación" : "líneas de preparación"}
        </p>
      </div>
      <div className="mt-3">
        <ListaProductosNecesarios productos={productos} />
      </div>
    </section>
  );
}
