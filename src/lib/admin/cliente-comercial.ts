import "server-only";
import { z } from "zod";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function administradorComercial() {
  const db = await crearClienteSupabaseServidor();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new Error("NO_AUTORIZADO");
  const admin = await db.rpc("es_admin");
  if (admin.error || admin.data !== true) throw new Error("NO_AUTORIZADO");
  return db;
}
export async function leerFichaComercial(id: string) {
  const db = await administradorComercial();
  const { data, error } = await db.rpc("obtener_cliente_administrativo", { p_cliente_id: z.uuid().parse(id) });
  if (error) throw new Error(error.message);
  // Las filas completas incluyen columnas que no se deben reenviar como ownership.
  return z.object({ cliente: z.object({ id: z.uuid(), nombre: z.string(), telefono: z.string().nullable(), email: z.string().nullable(), observaciones: z.string().nullable(), activo: z.boolean() }), direcciones: z.array(
    z.object({ ambito: z.literal("comercial"), id: z.uuid(), nombre_ubicacion: z.string().nullable(), nombre: z.string().nullable(), destinatario: z.string().nullable(), telefono_contacto: z.string().nullable(),
      direccion: z.string().nullable(), comuna: z.string().nullable(), region: z.string().nullable(), zona_entrega_id: z.uuid().nullable(), referencia: z.string().nullable(),
      latitud: z.number().nullable(), longitud: z.number().nullable(), es_principal: z.boolean(), activa: z.boolean() }).transform(({ ambito, ...direccion }) => { void ambito; return direccion; })
  ), revision: z.string() }).parse(data);
}
export async function zonasComerciales() {
  const db = await administradorComercial();
  const { data, error } = await db.from("zonas_entrega").select("id,nombre").eq("activa", true).order("nombre");
  if (error) throw new Error("No fue posible cargar las zonas.");
  return (data ?? []) as { id: string; nombre: string }[];
}
