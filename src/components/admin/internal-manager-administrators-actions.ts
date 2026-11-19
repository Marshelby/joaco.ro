"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { exigirAdminReparto } from "@/lib/reparto/server";
import type { UsuarioGestorInterno } from "./internal-manager-user-search";

export async function buscarUsuariosAdministracion(consulta: string) {
  const db = await exigirAdminReparto();
  const busqueda = typeof consulta === "string" ? consulta.trim().slice(0, 100) : "";
  if (busqueda.length < 2) return { usuarios: [] };

  const { data, error } = await db.rpc("leer_gestion_administradores", { p_busqueda: busqueda });
  if (error || !data) return { error: "No se pudo buscar usuarios. Intenta nuevamente." };
  return { usuarios: data.usuarios as UsuarioGestorInterno[] };
}

const cambioPermiso = z.object({ usuario: z.uuid(), activo: z.boolean(), clave: z.uuid() });

export async function actualizarPermisoAdministrador(cambio: unknown) {
  const db = await exigirAdminReparto();
  const validado = cambioPermiso.safeParse(cambio);
  if (!validado.success) return { error: "La solicitud de cambio no es válida." };

  const { usuario, activo, clave } = validado.data;
  const { error } = await db.rpc("actualizar_permiso_administrador", {
    p_usuario: usuario,
    p_activo: activo,
    p_clave: clave,
  });

  if (error) {
    switch (error.message) {
      case "ADMINISTRADOR_PRINCIPAL_PENDIENTE":
        return { error: "Falta configurar el administrador principal." };
      case "ADMINISTRADOR_PRINCIPAL_PROTEGIDO":
        return { error: "El permiso del administrador principal está protegido." };
      case "AUTORREVOCACION_PROHIBIDA":
        return { error: "No puedes revocar tu propio permiso." };
      case "USUARIO_INVALIDO":
        return { error: "El usuario ya no tiene un perfil registrado." };
      default:
        return { error: "No se pudo confirmar el cambio. Intenta nuevamente." };
    }
  }

  revalidatePath("/admin/gestor-interno");
  return { error: null };
}
