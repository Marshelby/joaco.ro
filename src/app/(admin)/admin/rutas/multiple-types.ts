export type RutaMultiple = {
  id: string; nombre: string; estado: "planificacion" | "preparacion" | "en_reparto" | "cerrada";
  version: number; pedidos: string[]; repartidores: string[];
  autorizaciones: { pedido: string; version: number; motivo: string; actor: string; cantidades: { item: string; solicitada: number; preparada: number; diferencia: number }[] }[];
  historial: { clave: string; actor: string; instante: string; accion: string; motivo: string | null; pedido: string | null; resultado: { ok: boolean; version: number; modalidad?: string; pedidos_agregados?: string[] } }[];
  contadores: { sin_preparar: number; parciales: number; pendientes_entrega: number; preparados: number; en_reparto: number; entregados: number; no_entregados: number; pendientes: number };
};
export type RutasMultiples = {
  contrato: 3; legado: boolean; rutas: RutaMultiple[];
  repartidores: { usuario_id: string; nombre: string }[];
};
export type SolicitudRutaMultiple = {
  accion: "crear" | "incorporar" | "seleccionar" | "asignar" | "preparar" | "autorizar_parcial" | "salir" | "cerrar" | "ordenar";
  ruta: string; fecha: string; version: number; clave: string;
  nombre?: string; pedidos?: string[]; repartidores?: string[]; pedido?: string; version_pedido?: number; motivo?: string;
};
