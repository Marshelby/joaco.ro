import type { ReactNode } from "react";

import type { PedidoAdminListado } from "@/lib/admin/pedidos";

export function OrderIdentity({ pedido, heading = "h3", customerAction }: {
  pedido: Pick<PedidoAdminListado, "nombreClienteSnapshot" | "nombreUbicacionSnapshot" | "numeroPedido">;
  heading?: "h1" | "h3";
  customerAction?: ReactNode;
}) {
  const Heading = heading;

  return (
    <div className="min-w-0 space-y-2">
      <Heading className={`break-words font-semibold tracking-tight text-foreground [&_button]:max-w-full [&_button]:break-words [&_button]:text-xl [&_button]:font-semibold [&_button]:leading-snug ${heading === "h1" ? "text-3xl leading-tight sm:text-4xl" : "text-xl leading-snug"}`}>
        {customerAction ?? pedido.nombreClienteSnapshot}
      </Heading>
      {pedido.nombreUbicacionSnapshot?.trim() ? <p className="break-words text-sm leading-6 text-foreground"><span className="text-muted-foreground">Ubicación comercial: </span>{pedido.nombreUbicacionSnapshot}</p> : null}
      <p className="break-words text-xs font-medium tracking-wide text-muted-foreground"><span className="sr-only">Pedido </span>{pedido.numeroPedido}</p>
    </div>
  );
}
