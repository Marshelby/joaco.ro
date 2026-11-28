"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { actionLinkVariants } from "@/components/ui/action-link";
import { accionesPedido, filaPedido, tarjetaPedido } from "./order-list-row";

export function PossibleOrderDisclosure({ tarjeta, acciones, children }: {
  tarjeta: ReactNode;
  acciones: ReactNode;
  children: ReactNode;
}) {
  const id = useId();
  const [abierta, setAbierta] = useState(false);

  return <article>
    <div className={`${tarjetaPedido} ${filaPedido}`}>
      {tarjeta}
      <div className={accionesPedido}>
        <button type="button" id={`${id}-boton`} aria-expanded={abierta} aria-controls={id}
          className={actionLinkVariants({ variant: "quiet", className: "gap-1 px-2.5" })}
          onClick={() => setAbierta(!abierta)}>
          {abierta ? "Ocultar solicitud" : "Ver solicitud"}
          <ChevronDown aria-hidden="true" className={`size-4 motion-safe:transition-transform ${abierta ? "rotate-180" : ""}`} />
        </button>
        {acciones}
      </div>
    </div>
    <div id={id} role="region" aria-labelledby={`${id}-boton`} inert={!abierta} aria-hidden={!abierta}
      className={`grid motion-safe:transition-[grid-template-rows,opacity] motion-safe:duration-250 motion-safe:ease-in-out ${abierta ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden">
        {children}
      </div>
    </div>
  </article>;
}
