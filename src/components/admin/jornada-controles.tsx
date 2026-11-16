"use client";

import { useEffect, useId, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function JornadaControles({ crear, productos, contabilidad, utilidad }: { crear?: ReactNode; productos: ReactNode; contabilidad: ReactNode; utilidad?: ReactNode }) {
  const [abierto, setAbierto] = useState<number | null>(null);
  const id = useId();
  const router = useRouter();
  const [actualizando, startTransition] = useTransition();

  useEffect(() => {
    if (abierto !== 2 && abierto !== 3) return;
    const actualizar = () => {
      if (document.visibilityState === "visible") startTransition(() => router.refresh());
    };
    actualizar();
    const intervalo = window.setInterval(actualizar, 30_000);
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", actualizar);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [abierto, router, startTransition]);
  const controles = [
    { titulo: "Crear ruta", contenido: crear },
    { titulo: "Productos del día", contenido: productos },
    { titulo: "Resumen contable", contenido: contabilidad },
    { titulo: "Utilidad del día", contenido: utilidad },
  ];
  return <div className="min-w-0 space-y-2 [overflow-anchor:none]">
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {controles.map((control, n) => <button key={control.titulo} type="button" id={`${id}-control-${n}`} aria-expanded={abierto === n} aria-controls={`${id}-panel-${n}`} disabled={!control.contenido} onClick={() => setAbierto(abierto === n ? null : n)} className={`min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50 sm:text-sm ${abierto === n ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted"}`}>{control.titulo}<span aria-hidden="true" className="ml-1">{abierto === n ? "⌃" : "⌄"}</span></button>)}
    </div>
    {controles.map((control, n) => <div key={control.titulo} id={`${id}-panel-${n}`} role="region" aria-labelledby={`${id}-control-${n}`} hidden={abierto !== n} aria-busy={(n === 2 || n === 3) && actualizando} className="min-w-0 rounded-lg border bg-card p-3">{control.contenido ?? <p className="text-xs text-muted-foreground">La jornada histórica conserva su operación original.</p>}</div>)}
  </div>;
}
