"use client";

import { useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { titulo: string; mensaje: string; preparacion: ReactNode; ruta: ReactNode; salida?: ReactNode };

export function JornadaModos({ titulo, mensaje, preparacion, ruta, salida }: Props) {
  const [modo, setModo] = useState<"preparacion" | "ruta">("preparacion");
  const encabezado = useRef<HTMLDivElement>(null);

  function cambiarModo(siguiente: typeof modo) {
    if (siguiente === modo) return;
    setModo(siguiente);
    encabezado.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return <>
    <div ref={encabezado} className="scroll-mt-24 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{titulo}</h2>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Modo de la jornada">
          <Button type="button" variant={modo === "preparacion" ? "default" : "outline"} aria-pressed={modo === "preparacion"} aria-controls="jornada-preparacion" onClick={() => cambiarModo("preparacion")}>Preparación</Button>
          <Button type="button" variant={modo === "ruta" ? "default" : "outline"} aria-pressed={modo === "ruta"} aria-controls="jornada-ruta" onClick={() => cambiarModo("ruta")}>Ruta del día</Button>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{mensaje}</p>
    </div>
    <div id="jornada-preparacion" hidden={modo !== "preparacion"} className="space-y-6">{preparacion}<div className="rounded-xl border bg-card p-4"><Button type="button" onClick={() => cambiarModo("ruta")}>Ir a ver ruta</Button><p className="mt-2 text-xs text-muted-foreground">Revisa las paradas y el despacho en la vista de ruta.</p></div></div>
    <div id="jornada-ruta" hidden={modo !== "ruta"} className="space-y-4">{salida}{ruta}</div>
  </>;
}
