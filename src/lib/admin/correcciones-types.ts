export type LineaCorreccion = {
  item_pedido_id: string; nombre_producto: string; nombre_presentacion?: string;
  unidad: string; modo_cantidad: string | null; cantidad_pedida: number;
  cantidad_preparada: number; cantidad_entregada: number; importe_definitivo: number;
  precio_final_unitario_referencia: number;
};
export type SnapshotVenta = { productos: LineaCorreccion[]; total: number; costo_entrega: number; descuento: number };
export type SnapshotPago = {
  pago: { id: string; cliente_id: string; monto: number; metodo_pago: string; referencia: string | null; estado: string };
  aplicaciones: { id: string; pedido_id: string; monto_aplicado: number; activa: boolean }[];
};
export type ReemplazoPago = { monto: number; metodo: string; referencia: string | null; aplicaciones: { pedido_id: string; monto: number }[] };
export type HistorialCorreccion = { id: string; fecha: string; actor_id: string; motivo: string; anteriores: unknown; nuevos: unknown; resultado?: unknown; diferencia?: number };
export type ContextoCorreccion =
  | { tipo: "venta"; id: string; clienteId: string; version: number; original: SnapshotVenta; vigente: SnapshotVenta;
      reglas: { id: string; total_linea: number; total_final_administrativo: number | null; preparacion: number }[];
      historial: HistorialCorreccion[]; saldo: unknown }
  | { tipo: "pago"; id: string; snapshot: SnapshotPago; versiones: Record<string, number>; historial: HistorialCorreccion[] };
export type SolicitudCorreccion = { contexto: ContextoCorreccion; clave: string; motivo: string; confirmado: boolean;
  items?: { item_pedido_id: string; cantidad_entregada: number }[]; reemplazos?: ReemplazoPago[] };
