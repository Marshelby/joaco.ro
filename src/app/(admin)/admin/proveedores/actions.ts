"use server";

import { revalidatePath } from "next/cache";
import { clienteAdminProveedores, type ProveedorDetalle } from "@/lib/admin/proveedores";

type Resultado<T> = { ok: true; dato: T } | { ok: false; error: string; corregible?: boolean };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function esRechazoConfirmado(error: unknown) {
  const texto = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  return ["ABONO_SUPERA_SALDO", "DATOS_INVALIDOS", "NO_AUTORIZADO", "PROVEEDOR_NO_ENCONTRADO"].some((codigo) => texto.includes(codigo));
}
function mensaje(error: unknown) {
  const texto = error && typeof error === "object" && "message" in error ? String(error.message) : "";
  if (texto.includes("ABONO_SUPERA_SALDO")) return "El abono supera el saldo pendiente. No se admiten saldos a favor.";
  if (texto.includes("NO_AUTORIZADO")) return "Solo los administradores pueden realizar esta acción.";
  if (texto.includes("CLAVE_REUTILIZADA")) return "La confirmación ya se utilizó con otros datos. Recupera el proveedor antes de continuar.";
  if (texto.includes("PROVEEDOR_NO_ENCONTRADO")) return "Proveedor no encontrado.";
  if (texto.includes("DATOS_INVALIDOS")) return "Revisa los datos y el monto ingresado.";
  return "No se pudo completar la operación. Reintenta con los mismos datos. Si el módulo aún no está habilitado, falta instalar el SQL manual de proveedores.";
}

export async function verProveedor(id: string): Promise<Resultado<ProveedorDetalle>> {
  try {
    if (!uuid.test(id)) return { ok: false, error: "Proveedor inválido." };
    const supabase = await clienteAdminProveedores();
    const { data, error } = await supabase.rpc("obtener_proveedor_administrativo", { p_proveedor_id: id });
    if (error) throw error;
    if (!data) return { ok: false, error: "Proveedor no encontrado." };
    const detalle = data as ProveedorDetalle;
    return { ok: true, dato: { ...detalle, saldo_actual: Number(detalle.saldo_actual), movimientos: detalle.movimientos.map((m) => ({ ...m, monto: Number(m.monto) })) } };
  } catch (error) { return { ok: false, error: mensaje(error), corregible: esRechazoConfirmado(error) }; }
}

export async function crearProveedor(clave: string, nombre: string, descripcion: string, telefono: string, direccion: string): Promise<Resultado<string>> {
  try {
    const supabase = await clienteAdminProveedores();
    if (!uuid.test(clave) || !nombre.trim() || nombre.trim().length > 200 || descripcion.length > 2000) return { ok: false, corregible: true, error: "Ingresa un nombre de hasta 200 caracteres y una descripción de hasta 2000." };
    const errorContacto = validarContacto(telefono, direccion);
    if (errorContacto) return { ok: false, corregible: true, error: errorContacto };
    const { data, error } = await supabase.rpc("crear_proveedor_administrativo", { p_clave: clave, p_nombre: nombre.trim(), p_descripcion: descripcion.trim(), p_telefono: telefono ? `+569${telefono}` : null, p_direccion: direccion.trim() || null });
    if (error) throw error;
    revalidatePath("/admin/proveedores");
    return { ok: true, dato: String(data) };
  } catch (error) { return { ok: false, error: mensaje(error), corregible: esRechazoConfirmado(error) }; }
}

function validarContacto(telefono: string, direccion: string) {
  if (telefono !== "" && (telefono.length !== 8 || !/^[0-9]{8}$/.test(telefono))) return "Ingresa exactamente 8 dígitos después de +569 o deja el teléfono vacío.";
  if (direccion.length > 2000) return "La dirección admite hasta 2000 caracteres.";
  return null;
}

export async function actualizarProveedor(id: string, nombre: string, descripcion: string, telefono: string, direccion: string): Promise<Resultado<string>> {
  try {
    const supabase = await clienteAdminProveedores();
    if (!uuid.test(id) || !nombre.trim() || nombre.trim().length > 200 || descripcion.length > 2000) return { ok: false, corregible: true, error: "Ingresa un nombre de hasta 200 caracteres y una descripción de hasta 2000." };
    const errorContacto = validarContacto(telefono, direccion);
    if (errorContacto) return { ok: false, corregible: true, error: errorContacto };
    const { data, error } = await supabase.rpc("actualizar_proveedor_administrativo", { p_proveedor_id: id, p_nombre: nombre.trim(), p_descripcion: descripcion.trim(), p_telefono: telefono ? `+569${telefono}` : null, p_direccion: direccion.trim() || null });
    if (error) throw error;
    revalidatePath("/admin/proveedores");
    return { ok: true, dato: String(data) };
  } catch (error) { return { ok: false, error: mensaje(error), corregible: esRechazoConfirmado(error) }; }
}

export async function registrarMovimientoProveedor(clave: string, id: string, tipo: "deuda" | "abono", monto: string, comentario: string): Promise<Resultado<string>> {
  try {
    const supabase = await clienteAdminProveedores();
    if (!uuid.test(clave) || !uuid.test(id) || !["deuda", "abono"].includes(tipo) || !/^\d{1,12}$/.test(monto) || Number(monto) <= 0 || !comentario.trim() || comentario.trim().length > 2000) return { ok: false, corregible: true, error: "Ingresa un monto positivo en pesos enteros y un comentario de hasta 2000 caracteres." };
    const { data, error } = await supabase.rpc("registrar_movimiento_proveedor_administrativo", { p_clave: clave, p_proveedor_id: id, p_tipo: tipo, p_monto: Number(monto), p_comentario: comentario.trim() });
    if (error) throw error;
    revalidatePath("/admin/proveedores");
    return { ok: true, dato: String(data) };
  } catch (error) { return { ok: false, error: mensaje(error), corregible: esRechazoConfirmado(error) }; }
}
