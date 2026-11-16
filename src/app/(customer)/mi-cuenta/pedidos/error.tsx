"use client";

import { ErrorState } from "@/components/feedback/error-state";

export default function CustomerOrdersError({ unstable_retry }: { unstable_retry: () => void }) {
  return <ErrorState
    headingLevel="h1"
    title="No pudimos cargar tu pedido"
    description="Ocurrió un problema al consultar tus pedidos. Inténtalo nuevamente."
    action={<button type="button" onClick={() => unstable_retry()} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Reintentar</button>}
  />;
}
