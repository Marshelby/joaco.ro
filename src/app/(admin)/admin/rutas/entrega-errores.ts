// Mensajes conocidos e identificadores de negocio seguros; sin SQL, detalles ni hints.
export function mensajeErrorEntrega(error: { code?: string; message?: string }, alternativa: string): string {
  if (["PGRST202", "PGRST203", "PGRST204", "PGRST205", "42883", "42703", "42P01"].includes(error.code ?? "")) {
    return "La confirmación de entrega con cobro no está disponible en esta instalación. Requiere revisión de compatibilidad; no uses la confirmación antigua.";
  }
  if (["42501", "PGRST301", "PGRST302"].includes(error.code ?? "")) return "Tu sesión o permisos no permiten esta operación. Inicia sesión nuevamente o solicita acceso.";
  const mensajes: Record<string, string> = {
    ENTREGA_PERSISTIDA_INCONSISTENTE: "Existe evidencia de entrega que no coincide con el pedido o su cobro. Requiere revisión contable; no vuelvas a cobrar.",
    CLIENTE_INVALIDO: "El cliente del pedido no es válido o cambió durante la operación.",
    IMPORTE_ENTREGA_INVALIDO: "Un importe definitivo de producto no es un entero CLP válido.",
    OPERACION_INVALIDA: "La solicitud operativa está incompleta o no es válida.",
    PEDIDO_NO_ENCONTRADO: "El pedido solicitado no existe o ya no está disponible.",
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
  const conocido = mensajes[error.message ?? ""];
  if (conocido) return conocido;
  // Identificador de negocio cerrado a ASCII; nunca exponer detalles, SQL ni PII.
  if (/^[A-Z][A-Z0-9_]{2,100}$/.test(error.message ?? "")) return `La operación fue rechazada: ${error.message}. Requiere revisar esta causa antes de modificar la solicitud.`;
  if (error.code === "55P03" || error.code === "40P01" || error.code === "40001") return "Otra operación está modificando el pedido o su contabilidad. Reintenta con la misma solicitud.";
  if (error.code === "23505") return "Existe un registro con la misma referencia única. Es necesario verificar el comprobante antes de volver a cobrar.";
  if (error.code === "23514") return "La entrega o el cobro incumplen una restricción de integridad contable. Requiere revisión de la instalación.";
  const codigo = /^[A-Z0-9]{5,10}$/.test(error.code ?? "") ? ` Código: ${error.code}.` : "";
  return alternativa + codigo;
}
