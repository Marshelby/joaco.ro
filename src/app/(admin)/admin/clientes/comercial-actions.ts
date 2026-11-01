"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { administradorComercial, leerFichaComercial } from "@/lib/admin/cliente-comercial";
import { documentoComercialSchema, type DocumentoComercial, type EstadoComercial, type CoincidenciaComercial } from "@/lib/admin/cliente-comercial-contrato";
import { fasePosiblesPedidosHabilitada } from "@/lib/posibles-pedidos/configuracion";

export async function cargarFichaComercial(id: string) { return leerFichaComercial(id); }

export async function guardarFichaComercial(entrada: DocumentoComercial, confirmacion?: string): Promise<EstadoComercial> {
  const validado = documentoComercialSchema.safeParse(entrada);
  if (!validado.success) return { error: validado.error.issues[0]?.message ?? "Datos inválidos." };
  const d = validado.data;
  if (Buffer.byteLength(JSON.stringify(d.cliente)) > 16384 || Buffer.byteLength(JSON.stringify(d.direcciones)) > 131072) return { error: "El documento supera el límite permitido." };
  if (d.posibleId && !fasePosiblesPedidosHabilitada()) return { error: "La integración de posibles pedidos no está habilitada." };
  let enviado = false;
  try {
    const db = await administradorComercial();
    if (!d.clienteId) {
      // La creación rápida no acepta direcciones completas ni valores derivados del navegador.
      d.cliente.activo = true;
      if (d.direcciones.length) return { error: "Para crear usa únicamente la dirección simplificada." };
      if (d.direccionRapida) {
        // La RPC deriva la región dentro de la operación idempotente, sin inventar datos.
        d.direcciones = [{ id: null, nombre: null, destinatario: null, telefono_contacto: null,
          direccion: d.direccionRapida.direccion, comuna: d.direccionRapida.comuna, region: null, zona_entrega_id: null,
          referencia: null, latitud: null, longitud: null, activa: true, es_principal: true }];
      }

      // Incluye inactivos y compara exactamente como SQL, sin inferir país.
      const coincidencias: CoincidenciaComercial[] = [];
      const tel = d.cliente.telefono?.replace(/\D/g, "");
      for (let desde = 0; ; desde += 500) {
        const { data, error } = await db.from("clientes").select("id,nombre,telefono,email").order("id").range(desde, desde + 499);
        if (error || !data) return { error: "No pudimos comprobar coincidencias. Vuelve a intentar." };
        for (const c of data) {
          const por_telefono = !!tel && (c.telefono ?? "").replace(/\D/g, "") === tel;
          const por_email = !!d.cliente.email && (c.email ?? "").trim().toLowerCase() === d.cliente.email;
          if (por_telefono || por_email) coincidencias.push({ cliente_id: c.id, nombre: c.nombre, por_telefono, por_email });
        }
        if (data.length < 500) break;
      }
      const huella = createHash("sha256").update(JSON.stringify({ d, coincidencias })).digest("hex");
      if (coincidencias.length && confirmacion !== huella) return { coincidencias, confirmacion: huella };
    }
    const argumentos = { p_clave_operacion: d.clave, p_cliente_id: d.clienteId, p_revision_esperada: d.revision,
      p_cliente: d.cliente, p_direcciones: d.direcciones, p_posible_pedido_id: d.posibleId, p_version_posible_pedido: d.version };
    enviado = true;
    let resultado = await db.rpc("guardar_cliente_administrativo", argumentos);
    // Solo reintentar fallos de transporte con los mismos argumentos y UUID.
    const transporteIncierto = !!resultado.error && !resultado.error.code;
    if (transporteIncierto) resultado = await db.rpc("guardar_cliente_administrativo", argumentos);
    if (resultado.error) {
      const mensaje = resultado.error.message;
      if (resultado.error.code === "PGRST202" || (resultado.error.code === "42883" && /guardar_cliente_administrativo/.test(mensaje))) {
        return transporteIncierto
          ? { error: "No se pudo confirmar el primer guardado y la RPC guardar_cliente_administrativo no está disponible para reintentarlo. Recarga para revisar el estado.", incierto: true }
          : { error: "La función guardar_cliente_administrativo no está disponible en la base de datos. No se ejecutó el guardado. Se requiere habilitar la RPC existente." };
      }
      if (/CLIENTE_DESACTUALIZADO|POSIBLE_PEDIDO_DESACTUALIZADO/.test(mensaje) || resultado.error.code === "40001") return { conflicto: true, error: "La ficha o solicitud cambió. Recarga antes de volver a editar; no se sobrescribieron los cambios." };
      const errores: Record<string, string> = {
        NO_AUTORIZADO: "Tu sesión no tiene autorización administrativa.", CLAVE_OPERACION_EN_USO: "La clave ya fue usada con otros datos. Recarga la ficha.",
        ZONA_INVALIDA: "Una zona seleccionada ya no está activa. Recarga la ficha.", CLIENTE_NO_ENCONTRADO: "El cliente ya no está disponible.",
        POSIBLE_PEDIDO_CERRADO: "La solicitud ya está cerrada. Recarga la página.",
      };
      const incierto = !/^(P0001|40001|42501|22|23)/.test(resultado.error.code ?? "");
      return { error: errores[mensaje] ?? (incierto ? "No se pudo confirmar si el cliente quedó guardado. Reintenta con los mismos datos o recarga para revisar el estado." : "No fue posible guardar el cliente. Revisa los datos y vuelve a intentar."), incierto };
    }
    const id = resultado.data?.cliente_id;
    if (typeof id !== "string") return { error: "Respuesta inesperada. Reintenta sin cambiar los datos.", incierto: true };
    for (const ruta of ["/admin", "/admin/clientes", `/admin/clientes/${id}`, "/admin/posibles-pedidos"]) revalidatePath(ruta);
    revalidatePath("/admin/posibles-pedidos/[id]", "page");
    if (d.posibleId) revalidatePath(`/admin/posibles-pedidos/${d.posibleId}`);
    return { clienteId: id, coincidencias: resultado.data.coincidencias ?? [] };
  } catch {
    return { error: enviado ? "No se pudo confirmar el resultado. Reintenta con los mismos datos." : "No fue posible acceder. Revisa tu sesión administrativa.", incierto: enviado };
  }
}
