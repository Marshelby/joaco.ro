import "server-only";
import { cache } from "react";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export type RolResponsable = "admin" | "repartidor" | "cliente" | "sistema";
type Referencia = { id?: string | null; rol?: RolResponsable; historico?: string | null };
type Identidad = { nombre: string | null; error?: true };
type Fuente = "perfiles" | "clientes";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function nombrePersonal(valor: unknown) {
  if (typeof valor !== "string") return null;
  const nombre = valor.trim();
  if (!nombre || uuid.test(nombre) || nombre.includes("@") ||
    /^(?:administrador(?:a)?|responsable|sistema|sin nombre(?: registrado)?|administrador (?:no disponible|sin nombre registrado)|responsable (?:no registrado|sin nombre disponible))$/i.test(nombre)) return null;
  return nombre;
}

export function rolResponsable(valor: unknown): RolResponsable | undefined {
  if (valor === "admin" || valor === "repartidor" || valor === "cliente" || valor === "sistema") return valor;
}

// La caché de React dura lo que dura la petición de render. Las acciones
// también agrupan los IDs de cada lectura con la sesión vigente.
const consultaActual = cache(() => ({
  perfiles: new Map<string, Promise<Identidad>>(),
  clientes: new Map<string, Promise<Identidad>>(),
}));

async function consultarLote(fuente: Fuente, ids: string[], db: ReturnType<typeof crearClienteSupabaseServidor>) {
  try {
    const { data, error } = await (await db).from(fuente).select("usuario_id,nombre").in("usuario_id", ids);
    if (error) throw error;
    const nombres = new Map<string, string>();
    for (const fila of data ?? []) {
      const nombre = nombrePersonal(fila.nombre);
      if (fila.usuario_id && nombre && !nombres.has(fila.usuario_id)) nombres.set(fila.usuario_id, nombre);
    }
    return nombres;
  } catch (error) {
    console.error("[responsables] Error de lectura", { fuente, error });
    return null;
  }
}

const fuenteDe = (rol?: RolResponsable): Fuente => rol === "cliente" || rol === "repartidor" ? "clientes" : "perfiles";

export async function obtenerNombresResponsables(referencias: readonly Referencia[]) {
  const estado = consultaActual();
  let db: ReturnType<typeof crearClienteSupabaseServidor> | undefined;
  const identidades = new Map<string, Identidad>();
  await Promise.all((["perfiles", "clientes"] as const).map(async fuente => {
    const ids = [...new Set(referencias.flatMap(({ id, rol, historico }) =>
      typeof id === "string" && uuid.test(id) && rol !== "sistema" && !nombrePersonal(historico) && fuenteDe(rol) === fuente
        ? [id.toLowerCase()] : []))];
    const pendientes = ids.filter(id => !estado[fuente].has(id));
    for (let i = 0; i < pendientes.length; i += 100) {
      const lote = pendientes.slice(i, i + 100);
      const consulta = consultarLote(fuente, lote, db ??= crearClienteSupabaseServidor());
      for (const id of lote) estado[fuente].set(id, consulta.then<Identidad>(nombres =>
        nombres ? { nombre: nombres.get(id) ?? null } : { nombre: null, error: true }));
    }
    await Promise.all(ids.map(async id => {
      const identidad = await estado[fuente].get(id);
      if (identidad) identidades.set(`${fuente}:${id}`, identidad);
    }));
  }));
  return ({ id, rol, historico }: Referencia) => {
    if (rol === "sistema") return "Sistema";
    const identidad = id && typeof id === "string" ? identidades.get(`${fuenteDe(rol)}:${id.toLowerCase()}`) : undefined;
    const nombre = nombrePersonal(historico) ?? identidad?.nombre;
    if (nombre) return rol ? nombre : `${nombre} · Rol del actor no determinado`;
    if (identidad?.error) return "No se pudo consultar el nombre del responsable";
    if (typeof id !== "string" || !uuid.test(id)) return "Responsable no registrado";
    if (rol === "admin") return "Administrador sin nombre registrado";
    if (rol === "repartidor") return "Repartidor sin nombre registrado";
    if (rol === "cliente") return "Cliente sin nombre registrado";
    return "Rol del actor no determinado";
  };
}

export const responsableAdmin = (id?: string | null, historico?: string | null): Referencia => ({ id, rol: "admin", historico });

export function responsableCarga(id: string | null | undefined, accion: unknown): Referencia {
  const administrativas = ["guardar", "confirmar", "reabrir", "salir", "resolver_sin_stock", "reprogramar", "recibir_reprogramado"];
  return { id, rol: typeof accion === "string" && administrativas.includes(accion) ? "admin" : undefined };
}

export function responsableRuta(id: string, accion: string): Referencia {
  const administrativas = ["crear", "seleccionar", "asignar", "preparar", "confirmar_preparacion",
    "autorizar_parcial", "salir", "ordenar", "incorporar", "resolver_sin_stock"];
  return { id, rol: accion === "confirmar" ? "repartidor" : administrativas.includes(accion) ? "admin" : undefined };
}

export function responsablePago(pago: { registrado_por?: string | null; clave_idempotencia?: string | null }): Referencia {
  // Las altas administrativas y sus reemplazos usan clave. El cobro al entregar
  // registra al actor autenticado sin esa clave en la fila de pago.
  return { id: pago.registrado_por, rol: pago.clave_idempotencia ? "admin" : undefined };
}

export function describirAccionRuta(accion: string) {
  const acciones: Record<string, string> = { confirmar_preparacion: "Preparación de la ruta confirmada", crear: "Ruta creada", seleccionar: "Selección de pedidos actualizada", asignar: "Repartidores asignados", preparar: "Preparación iniciada", autorizar_parcial: "Salida parcial autorizada", resolver_sin_stock: "No entregado — Sin stock · Retirado del reparto", salir: "Salida efectiva registrada", cerrar: "Ruta cerrada", ordenar: "Orden de paradas actualizado", incorporar: "Pedidos incorporados", entregar: "Entrega confirmada", fallida: "Intento de entrega fallido", guardar: "Selección de carga guardada", confirmar: "Carga confirmada", reabrir: "Carga reabierta" };
  return acciones[accion] ?? "Operación registrada";
}
