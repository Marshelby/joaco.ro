"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { administradorComercial } from "@/lib/admin/cliente-comercial";
import { camposFacturacion } from "@/lib/admin/cliente-facturacion";

export async function guardarDatosFacturacion(clienteId: string, formulario: FormData) {
  if (!z.uuid().safeParse(clienteId).success) return { error: "Cliente inválido." };

  const argumentos: Record<string, string> = { p_cliente_id: clienteId };
  for (const campo of camposFacturacion) {
    const entrada = formulario.get(campo.nombre);
    const valor = typeof entrada === "string" ? entrada.trim() : "";
    if (!valor || valor.length > campo.maximo || /[\u0000-\u001f\u007f-\u009f]/.test(valor)) {
      return { error: `Revisa el campo ${campo.etiqueta}.` };
    }
    argumentos[`p_${campo.nombre}`] = valor;
  }

  try {
    const db = await administradorComercial();
    const { error } = await db.rpc("guardar_datos_facturacion_cliente", argumentos);
    if (error) {
      if (error.message === "RUT_INVALIDO") return { error: "Ingresa un RUT chileno válido." };
      if (error.code === "23503") return { error: "El cliente ya no está disponible." };
      if (error.code === "42501") return { error: "Se requiere una sesión administrativa." };
      if (error.code === "23514" && error.message.includes("correo_facturacion")) {
        return { error: "Ingresa un correo de facturación válido." };
      }
      return { error: "No se pudo guardar la ficha. Revisa los datos y vuelve a intentar." };
    }
  } catch {
    return { error: "No se pudo confirmar el guardado. Revisa tu sesión y vuelve a intentar." };
  }

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${clienteId}`);
  return { error: null };
}
