"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdminReparto } from "@/lib/reparto/server";
export async function gestionarReparto(f: FormData) {
  const db = await exigirAdminReparto();
  const accion = f.get("accion");
  const usuario = f.get("usuario");
  const ruta = f.get("ruta");
  const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if (!["rol", "asignar"].includes(String(accion)) || !uuid(usuario) || (accion === "asignar" && !uuid(ruta)) || (accion === "rol" && !["true", "false"].includes(String(f.get("activo"))))) redirect("/admin/repartidores?resultado=invalido");
  const { error } = await db.rpc("administrar_reparto", { p_accion: accion, p_usuario: usuario, p_activo: accion === "rol" ? f.get("activo") === "true" : null, p_ruta: accion === "asignar" ? ruta : null });
  if (error) redirect("/admin/repartidores?resultado=error");
  revalidatePath("/admin/repartidores");
  revalidatePath("/reparto");
  redirect("/admin/repartidores?resultado=ok");
}
