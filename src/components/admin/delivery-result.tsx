import { useId } from "react";

import { formatearCantidadConUnidadEntrega } from "@/lib/admin/pedidos";
import type { ResultadoEntrega } from "@/lib/admin/resultado-entrega";
import { formatCLP } from "@/lib/formatters";

const sinRegistro = "No registrado";
const dinero = (valor: number | null) => valor === null ? sinRegistro : formatCLP(valor);

export function DeliveryResult({ resultado, original }: {
  resultado?: ResultadoEntrega | null;
  original: number;
}) {
  const titulo = useId();
  const definitivo = resultado?.definitivo ?? null;
  const diferencia = definitivo === null ? null : definitivo - original;
  const productos = resultado?.productos ?? [];
  const menorCantidad = productos.some(p => p.cantidad_pedida != null && p.cantidad_entregada != null && p.cantidad_entregada < p.cantidad_pedida);
  const afectados = productos.filter(p =>
    (p.cantidad_entregada != null && p.cantidad_pedida != null && p.cantidad_entregada !== p.cantidad_pedida) ||
    (p.importe_definitivo != null && p.importe_original != null && p.importe_definitivo !== p.importe_original));
  const diferencias = afectados.length > 0 || (diferencia !== null && diferencia !== 0);
  const faltanCantidades = !productos.length || productos.some(p => p.cantidad_pedida == null || p.cantidad_entregada == null);
  const rol = resultado?.rol_actor;
  const nombre = resultado?.actor?.nombre ?? sinRegistro;

  return (
    <section aria-labelledby={titulo} className={diferencias
      ? "space-y-3 rounded-xl border-2 border-amber-500/60 bg-amber-500/10 p-4 text-sm [overflow-wrap:anywhere]"
      : "space-y-1 rounded-lg border px-3 py-2 text-xs [overflow-wrap:anywhere]"}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h2 id={titulo} className={diferencias ? "text-base font-semibold" : "font-semibold"}>Resultado de la entrega</h2>
        {diferencias && <span className="rounded-md bg-amber-200 px-2 py-1 font-bold text-amber-950">
          {menorCantidad ? "Entrega parcial" : "Entrega con diferencias"}
        </span>}
      </div>
      {diferencias && <>
        <dl className="grid gap-2 sm:grid-cols-3">
          <div><dt>Importe original</dt><dd className="font-semibold tabular-nums">{dinero(original)}</dd></div>
          <div><dt>Importe definitivo</dt><dd className="font-semibold tabular-nums">{dinero(definitivo)}</dd></div>
          <div><dt>Diferencia económica</dt><dd className="font-semibold tabular-nums">{diferencia !== null && diferencia > 0 ? "+" : ""}{dinero(diferencia)}</dd></div>
        </dl>
        {afectados.length > 0 && <div>
          <h3 className="font-semibold">Productos afectados</h3>
          <ul className="mt-1 divide-y divide-border">
            {afectados.map(p => (
              <li key={p.item_pedido_id} className="grid gap-1 py-2 sm:grid-cols-2">
                <p className="font-medium">{[p.nombre_producto, p.nombre_presentacion].filter(Boolean).join(" · ") || sinRegistro}</p>
                <dl className="grid grid-cols-2 gap-2">
                  <div><dt>Solicitado</dt><dd>{p.cantidad_pedida == null ? sinRegistro : formatearCantidadConUnidadEntrega(p.cantidad_pedida, p.unidad)}</dd></div>
                  <div><dt>Entregado</dt><dd>{p.cantidad_entregada == null ? sinRegistro : formatearCantidadConUnidadEntrega(p.cantidad_entregada, p.unidad)}</dd></div>
                </dl>
              </li>
            ))}
          </ul>
        </div>}
      </>}
      {!diferencias && definitivo === null && <p className="text-muted-foreground">Importe definitivo: {sinRegistro}.</p>}
      {faltanCantidades && <p className="text-muted-foreground">Cantidades de entrega: {sinRegistro}. El historial disponible no conserva el detalle necesario para verificar todos los productos.</p>}
      <dl className="space-y-1">
        <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium">Repartidor que confirmó la entrega</dt>
          <dd>{rol === "repartidor" ? nombre : sinRegistro}</dd>
        </div>
        {rol === "admin" && <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium">Administrador que registró la entrega</dt><dd>{nombre}</dd>
        </div>}
        {!rol && resultado?.actor && <div className="flex flex-wrap gap-x-2">
          <dt className="font-medium">Persona que registró la entrega (rol histórico sin verificar)</dt><dd>{nombre}</dd>
        </div>}
      </dl>
      {rol !== "repartidor" && <p className="text-muted-foreground">
        {rol === "admin" ? "El historial acredita un registro administrativo." : "El historial disponible no acredita una confirmación por un repartidor."}
        {" "}La asignación de ruta identifica a las personas programadas para el reparto.
      </p>}
      {resultado?.actor && !resultado.actor.nombre && <p className="text-muted-foreground">El historial conserva la cuenta del actor, pero su nombre no está disponible.</p>}
    </section>
  );
}
