"use client";
export default function ErrorProduccion({ reset }: { reset: () => void }) {
  return <div role="alert" className="space-y-4 rounded-xl border bg-card p-6"><h1 className="text-xl font-semibold">No pudimos cargar Producción</h1><p className="text-muted-foreground">Revisa tu conexión e intenta nuevamente. Si el problema continúa, verifica el acceso administrativo y la disponibilidad de la base de datos.</p><button onClick={reset} className="min-h-11 rounded-lg bg-primary px-4 font-semibold text-primary-foreground">Reintentar</button></div>;
}
