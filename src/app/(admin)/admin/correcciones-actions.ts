"use server";

import { revalidatePath } from "next/cache";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { ContextoCorreccion, HistorialCorreccion, SolicitudCorreccion } from "@/lib/admin/correcciones-types";

async function administrador() {
  const db = await crearClienteSupabaseServidor();
  const { data: usuario, error } = await db.auth.getUser();
  const { data: admin, error: permiso } = await db.rpc("es_admin");
  if (error || !usuario.user || permiso || admin !== true) throw new Error("NO_AUTORIZADO");
  return db;
}

async function historialVenta(db: Awaited<ReturnType<typeof administrador>>, id: string) {
  const filas: HistorialCorreccion[] = [];
  for (;;) {
    const { data, error } = await db.from("correcciones_venta_entregada")
      .select("id,fecha,actor_id,motivo,anteriores,nuevos,diferencia")
      .eq("pedido_id", id).order("version", { ascending: false }).range(filas.length, filas.length + 199);
    if (error) throw error;
    if (!data.length) return { data: filas, error: null };
    filas.push(...data);
  }
}

export async function cargarCorreccion(tipo: "venta" | "pago", id: string): Promise<{ contexto?: ContextoCorreccion; error?: string }> {
  try {
    const db = await administrador();
    if (tipo === "pago") {
      const { data, error } = await db.rpc("leer_correccion_pago_administrativo", { p_pago_id: id });
      if (error) throw error;
      return { contexto: { tipo, id, ...data } as ContextoCorreccion };
    }
    const [pedido, version, historial, items, preparacion, saldo] = await Promise.all([
      db.from("pedidos").select("cliente_id,estado,regimen_contable,venta_definitiva_snapshot").eq("id", id).single(),
      db.rpc("leer_preparacion_explicita", { p_pedido_id: id }),
      historialVenta(db, id),
      db.from("items_pedido").select("id,total_linea,total_final_administrativo").eq("pedido_id", id),
      db.from("preparacion_items_pedido").select("item_pedido_id,importe_linea_operativo").eq("pedido_id", id),
      db.from("v_saldos_pedidos").select("total_pedido,total_pagado,saldo_pendiente").eq("pedido_id", id).maybeSingle(),
    ]);
    for (const respuesta of [pedido, version, historial, items, preparacion, saldo]) if (respuesta.error) throw respuesta.error;
    if (pedido.data?.estado !== "entregado" || pedido.data.regimen_contable !== "entrega_v1" || !pedido.data.venta_definitiva_snapshot) return { error: "Esta venta no admite correcciones administrativas." };
    return { contexto: { tipo, id, clienteId: pedido.data.cliente_id, version: version.data.version,
      original: pedido.data.venta_definitiva_snapshot, vigente: historial.data?.[0]?.nuevos ?? pedido.data.venta_definitiva_snapshot,
      reglas: (items.data ?? []).map(i => ({ ...i, preparacion: preparacion.data?.find(p => p.item_pedido_id === i.id)?.importe_linea_operativo })),
      historial: historial.data ?? [], saldo: saldo.data } as ContextoCorreccion };
  } catch { return { error: "No se pudo consultar la corrección. Comprueba tu sesión administrativa; si persiste, solicita habilitar la integración administrativa." }; }
}

export async function guardarCorreccion(s: SolicitudCorreccion): Promise<{ error?: string; resultado?: unknown }> {
  try {
    const db = await administrador();
    if (s.confirmado !== true || !s.motivo.trim() || s.motivo.length > 2000 || !/^[0-9a-f-]{36}$/i.test(s.clave)) return { error: "Confirma explícitamente e indica un motivo de hasta 2000 caracteres." };
    const c = s.contexto;
    // No releer ni sustituir expectativas antes de escribir: la RPC detecta conflictos.
    const { data, error } = c.tipo === "venta"
      ? await db.rpc("corregir_venta_entregada_administrativo", { p_pedido_id: c.id, p_version_esperada: c.version, p_clave: s.clave, p_items: s.items, p_motivo: s.motivo })
      : await db.rpc("corregir_pago_administrativo", { p_pago_id: c.id, p_clave: s.clave, p_anteriores_esperados: c.snapshot, p_versiones: c.versiones, p_reemplazos: s.reemplazos, p_motivo: s.motivo });
    if (error) {
      if (/CONFLICTO|CONCURRENCIA/.test(error.message)) return { error: "Los datos cambiaron. Cierra la corrección y vuelve a consultar antes de revisar otra propuesta." };
      const mensajes: Record<string, string> = {
        NO_AUTORIZADO: "Tu sesión no tiene acceso administrativo.",
        PAGO_NO_CORREGIBLE: "El pago ya no está confirmado. Vuelve a consultar su estado.",
        VENTA_NO_CORREGIBLE: "Esta venta ya no admite correcciones administrativas.",
        CORRECCION_SIN_CAMBIOS: "La propuesta no contiene cambios respecto de la venta vigente.",
        CLAVE_IDEMPOTENCIA_EN_USO: "La clave corresponde a otra solicitud. Vuelve a consultar y revisar la corrección.",
        PEDIDO_FUERA_DEL_PAGO_ORIGINAL: "Sólo puedes aplicar reemplazos a pedidos con aplicación original activa.",
        TOTAL_ADMINISTRATIVO_SIN_REGLA_PARA_CANTIDAD_ENTREGADA: "La cantidad propuesta no tiene una regla de importe autorizada.",
      };
      return { error: mensajes[error.message] ?? `No se guardó la corrección: ${error.message}` };
    }
    for (const path of ["/admin", "/admin/clientes", "/admin/pedidos", "/admin/rutas", "/mi-cuenta"]) revalidatePath(path, "layout");
    return { resultado: data };
  } catch { return { error: "No se pudo confirmar el resultado. Reintenta la misma solicitud: conserva su clave y valores para evitar duplicados." }; }
}
