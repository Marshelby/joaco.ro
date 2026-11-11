"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirAdminReparto } from "@/lib/reparto/server";
export async function gestionarReparto(f: FormData) {
  const db = await exigirAdminReparto();
  const accion = f.get("accion");
  const usuario = f.get("usuario");
  const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  if (accion !== "rol" || !uuid(usuario) || !["true", "false"].includes(String(f.get("activo")))) redirect("/admin/repartidores?resultado=invalido");
  // Sólo permisos de personas: las asignaciones conservan su contrato en la RPC
  // y se gestionarán desde rutas en una fase posterior.
  const { error } = await db.rpc("administrar_reparto", { p_accion: "rol", p_usuario: usuario, p_activo: f.get("activo") === "true" });
  if (error) redirect("/admin/repartidores?resultado=error");
  revalidatePath("/admin/repartidores");
  revalidatePath("/reparto");
  redirect("/admin/repartidores?resultado=ok");
}
