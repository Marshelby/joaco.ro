// Lista cerrada: nunca devolver mensajes, detalles ni hints del motor al cliente.
export function mensajeErrorEntrega(error: { code?: string; message?: string }, alternativa: string): string {
  if (["PGRST202", "PGRST203", "PGRST204", "PGRST205", "42883", "42703", "42P01"].includes(error.code ?? "")) {
    return "La confirmación de entrega con cobro no está disponible en esta instalación. Requiere revisión de compatibilidad; no uses la confirmación antigua.";
  }
  if (["42501", "PGRST301", "PGRST302"].includes(error.code ?? "")) return "Tu sesión o permisos no permiten esta operación. Inicia sesión nuevamente o solicita acceso.";
  const mensajes: Record<string, string> = {
    RUTA_CERRADA: "La ruta ya está cerrada. Actualiza para consultar el resultado.",
    NO_AUTORIZADO: "No tienes permisos para confirmar entregas.",
    REGIMEN_CONTABLE_NO_COMPATIBLE: "Este pedido es legado o usa un régimen incompatible. No admite Confirmar entrega con cobro.",
    VERSION_OPERATIVA_CONFLICTO: "La versión operativa cambió. Cierra y recarga el pedido antes de revisarlo nuevamente.",
    PREPARACION_NO_FINALIZADA: "Debes finalizar la preparación antes de confirmar la entrega.",
    PREPARACION_NO_CONFIRMADA: "La preparación tiene productos sin cantidad o importe confirmado. Revisa la preparación.",
    PRODUCTOS_PENDIENTES: "La preparación tiene productos pendientes de confirmación.",
    ESTADO_PEDIDO_INVALIDO: "El pedido debe estar en reparto y sin una venta definitiva previa. Recarga para revisar su estado.",
    CLAVE_IDEMPOTENCIA_EN_USO: "La clave corresponde a otra solicitud. Cierra y revisa el pedido antes de continuar.",
    ENTREGA_NO_COINCIDE_CON_PREPARACION: "La entrega no coincide con la preparación confirmada. Revisa las cantidades.",
    COBRO_EXPLICITO_REQUERIDO: "Debes revisar el cobro antes de confirmar la entrega.",
    COBRO_INVALIDO: "Revisa el método, los montos y la confirmación de Por pagar.",
    IMPORTES_RECIBIDOS_INVALIDOS: "Los montos recibidos deben ser enteros CLP válidos.",
    METODO_E_IMPORTES_INCOMPATIBLES: "Revisa el método y los montos recibidos.",
    APLICACIONES_PREVIAS_SUPERAN_VENTA: "Los abonos anteriores superan la venta. Requiere revisión contable.",
    TOTAL_ENTREGA_INVALIDO: "Los importes de entrega no coinciden con una preparación válida. Revisa el pedido.",
    TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA: "Esta cantidad requiere una regla de precio autorizada; el total administrativo no se puede prorratear.",
    ENTREGA_SIN_DIFERENCIAS: "No hay diferencias respecto de la preparación. Usa Todo correcto.",
    CANTIDAD_ENTREGADA_DEBE_SER_ENTERA: "Las unidades y presentaciones cerradas requieren cantidades enteras.",
    CANTIDAD_ENTREGADA_INVALIDA: "Revisa las cantidades: máximo tres decimales y valores menores a mil millones.",
    ITEMS_ENTREGA_INVALIDOS: "La lista de productos entregados no es válida. Revisa el pedido.",
    ITEMS_ENTREGA_NO_CORRESPONDEN: "Debes incluir todos los productos del pedido una sola vez.",
    FORMATO_UNIDAD_ENTREGA_INVALIDO: "El formato o la unidad de un producto requieren revisión.",
  };
  return mensajes[error.message ?? ""] ?? alternativa;
}
