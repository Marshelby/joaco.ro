"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";

// Ambas vistas vuelven a consultar su contrato autorizado; no se copian pedidos
// entre usuarios ni se reemplaza el estado de formularios abiertos.
export function RutaActualizacion() {
  const router = useRouter();
  const [, iniciar] = useTransition();
  useEffect(() => {
    const actualizar = () => {
      if (document.visibilityState !== "visible" || document.querySelector('[role="dialog"], [data-ruta-operacion="true"]')) return;
      if (document.activeElement?.matches("input, textarea, select")) return;
      iniciar(() => router.refresh());
    };
    const intervalo = window.setInterval(actualizar, 15_000);
    window.addEventListener("focus", actualizar);
    document.addEventListener("visibilitychange", actualizar);
    return () => {
      window.clearInterval(intervalo);
      window.removeEventListener("focus", actualizar);
      document.removeEventListener("visibilitychange", actualizar);
    };
  }, [router, iniciar]);
  return null;
}
