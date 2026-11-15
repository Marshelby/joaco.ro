"use server";

import { revalidatePath } from "next/cache";
import { exigirAdminReparto } from "@/lib/reparto/server";

export async function guardarCompraDia(datos: FormData): Promise<{ error?: string; guardado?: boolean }> {
  const fecha = String(datos.get("fecha") ?? "");
  const clave = String(datos.get("clave") ?? "");
  const revision = String(datos.get("revision") ?? "");
  const versionTexto = String(datos.get("version") ?? "");
  const cantidadTexto = String(datos.get("cantidad") ?? "").trim();
  const precioTexto = String(datos.get("precio") ?? "").trim();
  const decimal = /^\d{1,9}(\.\d{1,3})?$/;
  const fechaReal = new Date(`${fecha}T12:00:00Z`);
  if (!Number.isFinite(fechaReal.getTime()) || fechaReal.toISOString().slice(0, 10) !== fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !/^[a-f0-9]{32}$/.test(clave) ||
      !/^[a-f0-9]{32}$/.test(revision) || !/^\d+$/.test(versionTexto) ||
      !Number.isSafeInteger(Number(versionTexto)) || Number(versionTexto) > 2147483646 ||
      !decimal.test(cantidadTexto) || !decimal.test(precioTexto)) {
    return { error: "Revisa los valores: hasta tres decimales y menos de mil millones." };
  }
  const db = await exigirAdminReparto();
  const { error } = await db.rpc("guardar_costo_producto_dia", {
    p_fecha: fecha, p_clave: clave, p_revision: revision, p_version: Number(versionTexto),
    p_cantidad: Number(cantidadTexto), p_precio: Number(precioTexto),
  });
  if (error) {
    const mensajes: Record<string, string> = {
      DEMANDA_OCUPADA: "Hay pedidos en modificación. Recarga y vuelve a intentar.",
      COMPRA_OCUPADA: "Otro guardado está en curso. Recarga para verificar el resultado.",
      AISLAMIENTO_NO_COMPATIBLE: "El SQL requiere transacciones READ COMMITTED. Revisa la configuración antes de reintentar.",
      FECHA_INVALIDA: "La fecha de entrega no es válida.",
      VERSION_CONFLICTO: "Esta compra ya cambió o fue guardada. Recarga antes de editar nuevamente.",
      DEMANDA_CAMBIO: "Los pedidos cambiaron. Recarga para revisar la cantidad requerida.",
      UNIDAD_NO_VERIFICADA: "La unidad histórica requiere revisión; no se guardó la compra.",
      CANTIDAD_ENTERA_REQUERIDA: "Esta presentación requiere una cantidad entera.",
      DATOS_INVALIDOS: "Ingresa cantidades y precios válidos, con hasta tres decimales.",
      NO_AUTORIZADO: "Se requieren permisos administrativos.",
    };
    return { error: mensajes[error.message] ?? "No se pudo guardar. Revisa la instalación del SQL de costos del día y recarga antes de reintentar." };
  }
  revalidatePath("/admin/rutas");
  return { guardado: true };
}
