import type { ReactNode } from "react";
import { bloqueJornada, cuadriculaDetalleJornada, encabezadoProductoJornada, importeJornada, presentacionProductoJornada, tonoJornada } from "@/components/admin/jornada-colores";
import { ChevronDown } from "lucide-react";
import { DeliveryObservation } from "@/components/admin/delivery-observation";
import type { ContextoEntrega } from "@/lib/admin/entrega-contexto";
import { formatearCantidadConUnidadEntrega, type EstadoPedidoAdmin } from "@/lib/admin/pedidos";
import type { ResultadoEntrega } from "@/lib/admin/resultado-entrega";
import { NOMBRE_REPARTIDOR_NO_REGISTRADO } from "@/lib/reparto/nombre";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

type Producto = ResultadoEntrega["productos"][number];
export type FalloEntrega = { motivo: string | null; observaciones: string | null; fecha: string | null; actor: string | null };
export type ResultadoVisual = keyof typeof estilos;

const estilos = {
  completa: { titulo: "Entrega completa", clase: "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30", etiqueta: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100" },
  parcial: { titulo: "Entrega parcial", clase: "border-amber-600/50 bg-amber-50 dark:bg-amber-950/30", etiqueta: "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-100" },
  diferencias: { titulo: "Entrega con diferencias", clase: "border-amber-600/50 bg-amber-50 dark:bg-amber-950/30", etiqueta: "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-100" },
  fallida: { titulo: "No entregado", clase: "border-red-600/45 bg-red-50 dark:bg-red-950/30", etiqueta: "bg-red-100 text-red-950 dark:bg-red-900 dark:text-red-100" },
  historica: { titulo: "Entrega registrada", clase: "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/30", etiqueta: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100" },
};

export function esResultadoEntrega(estado: EstadoPedidoAdmin): estado is "entregado" | "entrega_fallida" {
  return estado === "entregado" || estado === "entrega_fallida";
}

function diferenciaProducto(p: Producto) {
  return (p.cantidad_pedida != null && p.cantidad_entregada != null && p.cantidad_pedida !== p.cantidad_entregada) ||
    (p.importe_original != null && p.importe_definitivo != null && p.importe_original !== p.importe_definitivo);
}

export function presentarResultadoEntrega(estado: EstadoPedidoAdmin, original: number, resultado?: ResultadoEntrega | null, solicitados: readonly Producto[] = [], contexto?: ContextoEntrega) {
  const registrados = new Map(resultado?.productos.map(p => [p.item_pedido_id, p]));
  const entregados = new Map(contexto?.venta?.productos.map(p => [p.item_pedido_id, p]));
  const productos = solicitados.map(p => {
    const registro = registrados.get(p.item_pedido_id);
    const entrega = entregados.get(p.item_pedido_id);
    registrados.delete(p.item_pedido_id);
    return {
      ...p, ...registro,
      cantidad_pedida: registro?.cantidad_pedida ?? p.cantidad_pedida,
      cantidad_entregada: registro?.cantidad_entregada ?? entrega?.cantidad_entregada ?? null,
      importe_original: registro?.importe_original ?? p.importe_original,
      importe_definitivo: registro?.importe_definitivo ?? entrega?.importe_definitivo ?? null,
    };
  });
  productos.push(...registrados.values());
  const definitivo = resultado?.definitivo ?? contexto?.venta?.total ?? null;
  const diferencia = definitivo === null ? null : definitivo - original;
  const faltanCantidades = !productos.length || productos.some(p => p.cantidad_pedida == null || p.cantidad_entregada == null);
  const parcial = productos.some(p => p.cantidad_pedida != null && p.cantidad_entregada != null && p.cantidad_entregada < p.cantidad_pedida);
  const tipo: ResultadoVisual = estado === "entrega_fallida" ? "fallida" : parcial ? "parcial"
    : productos.some(diferenciaProducto) || (diferencia != null && diferencia !== 0) ? "diferencias"
    : faltanCantidades ? "historica" : "completa";
  return { tipo, productos, faltanCantidades, original, definitivo, diferencia, resultado };
}

export function productoSolicitado(id: string, nombre: string, presentacion: string | null, unidad: string, cantidad: number, importe: number | null = null): Producto {
  return { item_pedido_id: id, nombre_producto: nombre, nombre_presentacion: presentacion, unidad, cantidad_pedida: cantidad, cantidad_entregada: null, importe_original: importe, importe_definitivo: null };
}

type Presentacion = ReturnType<typeof presentarResultadoEntrega>;

export function importeResultado(datos: Presentacion, vigente?: number | null) {
  if (datos.tipo === "fallida") return { etiqueta: "Total original", valor: datos.original };
  if (vigente != null) return { etiqueta: "Importe definitivo vigente", valor: vigente };
  if (datos.definitivo != null) return { etiqueta: "Importe definitivo registrado", valor: datos.definitivo };
  return { etiqueta: "Total original", valor: datos.original };
}

type Resumen = { vistaRuta?: boolean; tipo: ResultadoVisual; cliente?: string; numero?: string; parada?: number; importe?: ReturnType<typeof importeResultado> };

export function DeliveryResultHeader({ tipo, cliente, numero, parada, importe, vistaRuta }: Resumen) {
  return <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2 text-left [overflow-wrap:anywhere]">
    {parada !== undefined && <span className="text-xs font-medium text-muted-foreground">Parada {parada}</span>}
    <span className={`rounded-md px-2 py-1 text-xs font-semibold ${estilos[tipo].etiqueta}`}>{estilos[tipo].titulo}</span>
    {(cliente || numero) && <span className="min-w-0 flex-1 basis-28">
      {cliente && <span className="block text-sm font-semibold">{cliente}</span>}
      {numero && <span className="block text-xs text-muted-foreground">Pedido {numero}</span>}
    </span>}
    {importe && <span className="min-w-0">
      <span className="block text-xs text-muted-foreground">{importe.etiqueta}</span>
      <span className={vistaRuta ? `${importeJornada} ${importe.etiqueta === "Total original" ? tonoJornada.informativo : tonoJornada.venta}` : "block text-sm font-semibold tabular-nums"}>{formatCLP(importe.valor)}</span>
    </span>}
  </span>;
}

export function claseResultadoEntrega(tipo: ResultadoVisual) {
  return estilos[tipo].clase;
}

export function DeliveryResult({ children, ...resumen }: Resumen & { children: ReactNode }) {
  return <details className={`group/resultado min-w-0 rounded-xl border ${claseResultadoEntrega(resumen.tipo)}`}>
    <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 rounded-xl px-3 py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
      <DeliveryResultHeader {...resumen} />
      <span className="sr-only">Detalles de la entrega</span>
      <ChevronDown className="size-4 shrink-0 group-open/resultado:rotate-180 motion-safe:transition-transform" aria-hidden="true" />
    </summary>
    <div className={resumen.vistaRuta ? "min-w-0 rounded-b-xl border-t border-border bg-card/80 px-2.5 py-2 wrap-anywhere sm:px-3" : "space-y-3 border-t border-border bg-card/80 p-3 text-sm [overflow-wrap:anywhere]"}>{children}</div>
  </details>;
}

function diferenciaFormateada(valor: number) {
  return `${valor > 0 ? "+" : ""}${formatCLP(valor)}`;
}

export function DeliveryResultDetails({ datos, contexto, fallo, responsableHistorico, ocultarOriginal = false, vistaRuta = false, children }: { datos: Presentacion; ocultarOriginal?: boolean; vistaRuta?: boolean; contexto?: ContextoEntrega; fallo?: FalloEntrega | null; responsableHistorico?: string; children?: ReactNode }) {
  const { tipo, productos, faltanCantidades, diferencia, original, resultado } = datos;
  const rol = resultado?.rol_actor;
  const actor = resultado?.actor;
  const repartidor = resultado?.repartidor;
  const tieneAfectados = productos.some(diferenciaProducto);
  const enviados = new Map(contexto?.salida?.map(p => [p.item_pedido_id, p.cantidad_preparada]));
  const estiloDato = (tono: keyof typeof tonoJornada, clase?: string) =>
    vistaRuta ? `${bloqueJornada} ${tonoJornada[tono]} ${clase ?? ""}` : clase;
  const valor = vistaRuta ? "font-semibold" : undefined;
  return <div className={vistaRuta ? "min-w-0 space-y-2 text-sm wrap-anywhere" : "space-y-3 text-sm [overflow-wrap:anywhere]"}>
    {fallo && <dl className={vistaRuta ? cuadriculaDetalleJornada : "grid gap-2 sm:grid-cols-2"}>
      {fallo.motivo && <div className={estiloDato("incidencia")}><dt className={vistaRuta ? "font-semibold" : "text-muted-foreground"}>Motivo</dt><dd>{fallo.motivo}</dd></div>}
      {fallo.fecha && <div><dt className="text-muted-foreground">Registro de no entrega</dt><dd>{formatDateTimeCL(fallo.fecha)}</dd></div>}
      {fallo.actor && <div><dt className="text-muted-foreground">Responsable del registro</dt><dd>{fallo.actor}</dd></div>}
      {fallo.observaciones && <div className={vistaRuta ? estiloDato("incidencia", "col-span-full") : "sm:col-span-2"}><dt className={vistaRuta ? "font-semibold" : "text-muted-foreground"}>Observaciones del registro</dt><dd className="whitespace-pre-wrap">{fallo.observaciones}</dd></div>}
    </dl>}
    {tipo !== "fallida" && repartidor && <p><strong>Repartidor que registró:</strong> {repartidor.nombre ?? NOMBRE_REPARTIDOR_NO_REGISTRADO}</p>}
    {tipo !== "fallida" && (resultado || responsableHistorico) && !repartidor && <p><strong>{rol === "admin" ? "Administrador que registró" : rol === "cliente" ? "Cliente que registró" : "Responsable del registro"}</strong> · {actor?.nombre ?? responsableHistorico ?? (rol === "sistema" ? "Sistema" : "Responsable no registrado")}</p>}
    {tipo !== "fallida" && diferencia != null && diferencia !== 0 && <dl className={vistaRuta ? cuadriculaDetalleJornada : "grid grid-cols-2 gap-2 tabular-nums"}>
      {!ocultarOriginal && <div className={estiloDato("informativo")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Total original</dt><dd className="font-semibold">{formatCLP(original)}</dd></div>}
      <div className={estiloDato(diferencia < 0 ? "incidencia" : "pendiente")}><dt className={vistaRuta ? undefined : "text-muted-foreground"}>Diferencia respecto del total original</dt><dd className="font-semibold">{diferenciaFormateada(diferencia)}</dd></div>
    </dl>}
    {productos.length > 0 && <div>
      <p className="font-semibold">{tieneAfectados ? "Productos y diferencias" : "Productos"}</p>
      <ul className="mt-1 divide-y divide-border">
        {productos.map(p => <li key={p.item_pedido_id} className={vistaRuta ? "grid min-w-0 items-start gap-1.5 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]" : "grid gap-1 py-2 sm:grid-cols-2"}>
          <div className={vistaRuta ? "min-w-0" : "contents"}>
            {vistaRuta && <div className={encabezadoProductoJornada}>
              <p className="text-sm font-semibold">{p.nombre_producto}</p>
              {p.nombre_presentacion && <p className={presentacionProductoJornada}>{p.nombre_presentacion}</p>}
            </div>}
            {(!vistaRuta || diferenciaProducto(p)) && <p className={vistaRuta ? "mt-0.5" : "font-medium"}>{!vistaRuta && [p.nombre_producto, p.nombre_presentacion].filter(Boolean).join(" · ")}{diferenciaProducto(p) && <span className="block text-xs font-semibold text-amber-800 dark:text-amber-300">Producto afectado</span>}</p>}
          </div>
          <dl className={vistaRuta ? cuadriculaDetalleJornada : "grid grid-cols-2 gap-2 text-xs tabular-nums"}>
            <div className={estiloDato(p.cantidad_pedida == null ? "informativo" : "planificado")}><dt>Solicitado</dt><dd className={valor}>{p.cantidad_pedida == null ? "Sin registro" : formatearCantidadConUnidadEntrega(p.cantidad_pedida, p.unidad)}</dd></div>
            <div className={estiloDato(p.cantidad_entregada == null ? "informativo" : "completado")}><dt>Entregado</dt><dd className={valor}>{p.cantidad_entregada == null ? "Sin registro" : formatearCantidadConUnidadEntrega(p.cantidad_entregada, p.unidad)}</dd></div>
            {enviados.has(p.item_pedido_id) && <div className={estiloDato("informativo")}><dt>Enviado</dt><dd className={valor}>{formatearCantidadConUnidadEntrega(enviados.get(p.item_pedido_id)!, p.unidad)}</dd></div>}
            {p.importe_original != null && p.importe_definitivo != null && p.importe_original !== p.importe_definitivo && <div className={estiloDato(p.importe_definitivo < p.importe_original ? "incidencia" : "pendiente", vistaRuta ? "col-span-full" : "col-span-2")}><dt>Diferencia de importe</dt><dd className={valor}>{diferenciaFormateada(p.importe_definitivo - p.importe_original)}</dd></div>}
          </dl>
        </li>)}
      </ul>
    </div>}
    {tipo === "fallida" && !fallo?.motivo && <p className="text-xs text-muted-foreground">Motivo sin registro disponible.</p>}
    {tipo !== "fallida" && faltanCantidades && <p className="text-xs text-muted-foreground">El historial disponible conserva un registro incompleto de las cantidades entregadas.</p>}
    {contexto && (!fallo?.observaciones || contexto.observacion?.texto !== fallo.observaciones) && <DeliveryObservation contexto={contexto} />}
    {children}
  </div>;
}
