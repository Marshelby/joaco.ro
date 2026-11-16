"use client";
import { RutaActualizacion } from "@/components/admin/ruta-actualizacion";
import { RutaDiaMap } from "@/app/(admin)/admin/rutas/ruta-dia-map";
import { AccionesEntregaReparto } from "./acciones-entrega";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { operarReparto, type SolicitudReparto } from "./actions";
export type Jornada = { ruta?: string; nombre?: string; fecha: string; asignacion: number; estado: string; pedidos: {
  id: string; numero: string; cliente: string; direccion: string | null; telefono: string | null;
  latitude?: number | null; longitude?: number | null; referencia: string | null; preparacion?: "sin_preparar" | "parcial" | "listo"; estado: string; version: number; posicion: number | null;
  productos: { nombre: string; cantidad: number; solicitada?: number; faltante?: number; enviada?: number; unidad: string }[];
}[] };
const boton = "min-h-12 rounded-lg border px-4 py-3 font-medium disabled:opacity-50";
export function RepartoMovil({ jornadas, consultaFallida = false }: { jornadas: Jornada[]; consultaFallida?: boolean }) {
  const router = useRouter();
  const [seleccion, setSeleccion] = useState("");
  const identificador = (j: Jornada) => j.ruta ?? `${j.fecha}-${j.asignacion}`;
  const activa = jornadas.find(j => identificador(j) === seleccion) ?? jornadas[0];
  const ejecutando = useRef(false);
  const [pendiente, iniciar] = useTransition();
  const [solicitud, setSolicitud] = useState<SolicitudReparto | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [incierta, setIncierta] = useState(false);
  const [cierre, setCierre] = useState<{ fecha: string; asignacion: number; version: number; huella: string } | null>(null);
  function ejecutar(s: SolicitudReparto) {
    if (ejecutando.current) return;
    ejecutando.current = true;
    iniciar(async () => {
      try {
        const r = await operarReparto(s);
        if (r.error) { setMensaje(r.error); setIncierta(true); return; }
        setSolicitud(null); setIncierta(false);
        if (r.cierre && s.accion === "revisar_cierre" && r.cierre.estado !== "cerrada") {
          setCierre({ fecha: s.fecha, asignacion: s.asignacion, version: r.cierre.version, huella: r.cierre.huella });
          setMensaje("Revisión lista. Confirma el cierre de la jornada.");
        } else { setCierre(null); setMensaje("Operación confirmada."); router.refresh(); }
      } catch { setMensaje("Respuesta no recibida. Reintenta la misma solicitud."); setIncierta(true); }
      finally { ejecutando.current = false; }
    });
  }
  return <div className="space-y-5" data-ruta-operacion={!!solicitud || !!cierre || pendiente}>
    <RutaActualizacion />
    <button className={boton} disabled={pendiente || !!solicitud} onClick={() => { setCierre(null); router.refresh(); }}>Actualizar rutas</button>
    <p role="status" aria-live="polite">{mensaje}</p>
    {solicitud && <section className="min-w-0 space-y-3 rounded-xl border p-4 [overflow-wrap:anywhere]">
      <p>{solicitud.accion === "entregar" ? "Confirmo que entregué todos los productos preparados. No se registrará un cobro." : solicitud.accion === "fallida" ? `Registrar intento fallido: ${solicitud.motivo}. ${solicitud.observaciones}` : "Confirmo el cierre definitivo de esta ruta."}</p>
      <button className={boton} disabled={pendiente} onClick={() => ejecutar(solicitud)}>{pendiente ? "Procesando…" : incierta ? "Reintentar la misma solicitud" : "Confirmar"}</button>
      {!incierta && <button className={boton} disabled={pendiente} onClick={() => setSolicitud(null)}>Volver</button>}
      {incierta && <button className={boton} disabled={pendiente} onClick={() => { setSolicitud(null); setIncierta(false); setCierre(null); router.refresh(); }}>Consultar estado actualizado</button>}
      {incierta && <p className="text-sm">Se conserva la clave y el contenido mientras esta página siga abierta. Si debes recargar, consulta primero el estado actualizado.</p>}
    </section>}
    {cierre && !solicitud && <button className={boton} disabled={pendiente} onClick={() => setSolicitud({ ...cierre, accion: "cerrar", clave: crypto.randomUUID() })}>Confirmar cierre de {cierre.fecha}</button>}
    {!consultaFallida && !jornadas.length && <section className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold text-foreground">No tienes rutas activas asignadas</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Tus rutas aparecerán aquí cuando administración las asigne y habilite su salida. Puedes volver a consultar con Actualizar rutas.</p></section>}
    {jornadas.length > 1 && <label className="block text-sm font-medium">Ruta asignada<select className="mt-1 min-h-11 w-full rounded-lg border bg-background p-3" value={activa ? identificador(activa) : ""} disabled={pendiente || !!solicitud || !!cierre} onChange={e => setSeleccion(e.target.value)}>{jornadas.map(j => <option key={identificador(j)} value={identificador(j)}>{j.nombre ?? "Ruta"} · {j.fecha}</option>)}</select></label>}
    {(activa ? [activa] : []).map(j => {
      const resueltos = j.pedidos.filter(p => ["entregado", "entrega_fallida"].includes(p.estado)).length;
      return <section key={j.ruta ?? `${j.fecha}-${j.asignacion}`} className="space-y-4">
        <h2 className="text-xl font-semibold">{j.nombre ?? "Ruta"} · {j.fecha}</h2>
        {j.ruta && <p className="text-sm">Preparación · Sin preparar: {j.pedidos.filter(p => p.preparacion === "sin_preparar").length} · Parcial: {j.pedidos.filter(p => p.preparacion === "parcial").length} · Listo: {j.pedidos.filter(p => p.preparacion === "listo").length}</p>}
        <p className="text-sm">En reparto: {j.pedidos.filter(p => p.estado === "en_reparto").length} · Entregados: {j.pedidos.filter(p => p.estado === "entregado").length} · No entregados: {j.pedidos.filter(p => p.estado === "entrega_fallida").length}</p>
        <p>{resueltos} de {j.pedidos.length} pedidos resueltos</p>
        <progress className="w-full" value={resueltos} max={j.pedidos.length || 1} aria-label="Progreso de ruta" />
        <RutaDiaMap key={identificador(j)} fecha={j.fecha} rutaId={j.ruta} versionRuta={j.asignacion} soloLectura cerrada paradas={[...j.pedidos].sort((a, b) => (a.posicion ?? Number.MAX_SAFE_INTEGER) - (b.posicion ?? Number.MAX_SAFE_INTEGER)).map((p, n) => ({
          id: p.id, numero: n + 1, cliente: p.cliente, ubicacion: p.direccion, pedido: p.numero,
          latitude: p.latitude ?? null, longitude: p.longitude ?? null, entregado: p.estado === "entregado", fallida: p.estado === "entrega_fallida",
          detalle: <article className="min-w-0 space-y-3 border-t p-3 [overflow-wrap:anywhere]">
          <h3 className="font-semibold">{p.posicion ? `${p.posicion}. ` : ""}{p.numero} · {p.cliente}</h3>
          <p>{p.direccion || "Dirección pendiente: consulta a administración"}</p><p>{p.referencia}</p>
          {p.telefono && <a className="inline-block min-h-12 py-3 underline" href={`tel:${p.telefono.replace(/[^+\d]/g, "")}`}>Llamar: {p.telefono}</a>}
          <details className="rounded-xl border bg-muted/30 px-3"><summary className="min-h-12 cursor-pointer py-3 font-semibold text-primary">Ver productos · {p.productos.length}</summary><ul className="divide-y">{p.productos.map((i, n) => <li key={n} className="space-y-2 py-3 text-sm"><p className="font-semibold">{i.nombre}</p><dl className="grid grid-cols-2 gap-2 sm:grid-cols-4"><div><dt className="text-muted-foreground">Solicitado</dt><dd>{i.solicitada === undefined ? "Sin dato" : `${i.solicitada} ${i.unidad}`}</dd></div><div><dt className="text-muted-foreground">Preparado</dt><dd>{i.cantidad} {i.unidad}</dd></div><div><dt className="text-muted-foreground">Enviado</dt><dd>{i.enviada === undefined ? "Sin dato de salida" : `${i.enviada} ${i.unidad}`}</dd></div><div><dt className="text-muted-foreground">Diferencia preparada</dt><dd>{i.solicitada === undefined ? "Sin dato" : `${i.cantidad - i.solicitada} ${i.unidad}`}</dd></div></dl></li>)}</ul></details>
          {p.preparacion && <p className={`inline-flex rounded-md px-2 py-1 text-sm font-semibold ${p.preparacion === "listo" ? "bg-emerald-100 text-emerald-900" : "bg-muted"}`}>Preparación: {p.preparacion === "listo" ? "✓ Listo" : p.preparacion === "parcial" ? "Parcial" : "Sin preparar"}</p>}
          <p>Entrega: {p.estado === "entrega_fallida" ? "No entregado" : p.estado === "entregado" ? "Entregado" : p.estado === "en_reparto" ? "En reparto" : "Pendiente de entrega"}</p>
          {["en_reparto", "entregado"].includes(p.estado) && <AccionesEntregaReparto ruta={j.ruta} fecha={j.fecha} asignacion={j.asignacion}
            pedido={p} habilitada={j.estado === "en_ruta" && p.estado === "en_reparto" && !pendiente && !solicitud} />}
        </article>
        }))} />
        <button className={boton} disabled={j.estado !== "en_ruta" || pendiente || !!solicitud || !j.pedidos.length || resueltos !== j.pedidos.length} onClick={() => {
          if (j.ruta) { setIncierta(false); setSolicitud({ ruta: j.ruta, fecha: j.fecha, asignacion: j.asignacion, accion: "cerrar", clave: crypto.randomUUID() }); }
          else ejecutar({ fecha: j.fecha, asignacion: j.asignacion, accion: "revisar_cierre" });
        }}>Revisar y terminar ruta</button>
      </section>;
    })}
  </div>;
}
