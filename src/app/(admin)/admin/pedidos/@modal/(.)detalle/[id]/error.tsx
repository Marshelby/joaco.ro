"use client";

export default function Error({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-3 p-4 text-sm">
    <p>No se pudo cargar el pedido. Puedes volver a intentarlo o cerrar el detalle.</p>
    <button type="button" onClick={reset} className="min-h-11 rounded-lg border border-border px-4 font-semibold focus-visible:ring-3 focus-visible:ring-ring/50">Reintentar</button>
  </div>;
}
