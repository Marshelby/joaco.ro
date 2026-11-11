"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { operarReparto, type SolicitudReparto } from "./actions";
export type Jornada = { ruta?: string; nombre?: string; fecha: string; asignacion: number; estado: string; pedidos: {
  id: string; numero: string; cliente: string; direccion: string | null; telefono: string | null;
  referencia: string | null; preparacion?: "sin_preparar" | "parcial" | "listo"; estado: string; version: number; posicion: number | null;
  productos: { nombre: string; cantidad: number; solicitada?: number; faltante?: number; unidad: string }[];
}[] };
const boton = "min-h-12 rounded-lg border px-4 py-3 font-medium disabled:opacity-50";
export function RepartoMovil({ jornadas, consultaFallida = false }: { jornadas: Jornada[]; consultaFallida?: boolean }) {
  const router = useRouter();
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
  return <div className="space-y-5">
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
    {!consultaFallida && !jornadas.length && <p>No tienes jornadas activas asignadas.</p>}
    {jornadas.map(j => {
      const resueltos = j.pedidos.filter(p => ["entregado", "entrega_fallida"].includes(p.estado)).length;
      return <section key={j.ruta ?? `${j.fecha}-${j.asignacion}`} className="space-y-4">
        <h2 className="text-xl font-semibold">{j.nombre ?? "Ruta"} · {j.fecha}</h2>
        {j.ruta && <p className="text-sm">Preparación · Sin preparar: {j.pedidos.filter(p => p.preparacion === "sin_preparar").length} · Parcial: {j.pedidos.filter(p => p.preparacion === "parcial").length} · Listo: {j.pedidos.filter(p => p.preparacion === "listo").length}</p>}
        <p className="text-sm">En reparto: {j.pedidos.filter(p => p.estado === "en_reparto").length} · Entregados: {j.pedidos.filter(p => p.estado === "entregado").length} · No entregados: {j.pedidos.filter(p => p.estado === "entrega_fallida").length}</p>
        <p>{resueltos} de {j.pedidos.length} pedidos resueltos</p>
        <progress className="w-full" value={resueltos} max={j.pedidos.length || 1} aria-label="Progreso de ruta" />
        {j.pedidos.map(p => <article key={p.id} className="min-w-0 space-y-3 rounded-xl border p-4 [overflow-wrap:anywhere]">
          <h3 className="font-semibold">{p.posicion ? `${p.posicion}. ` : ""}{p.numero} · {p.cliente}</h3>
          <p>{p.direccion || "Dirección pendiente: consulta a administración"}</p><p>{p.referencia}</p>
          {p.telefono && <a className="inline-block min-h-12 py-3 underline" href={`tel:${p.telefono.replace(/[^+\d]/g, "")}`}>Llamar: {p.telefono}</a>}
          <ul>{p.productos.map((i, n) => <li key={n}>{i.cantidad} {i.unidad}{j.ruta ? " preparados" : ""} · {i.nombre}{i.solicitada !== undefined && <> · Solicitados: {i.solicitada} · Faltantes: {i.faltante ?? 0}</>}</li>)}</ul>
          {p.preparacion && <p className={`inline-flex rounded-md px-2 py-1 text-sm font-semibold ${p.preparacion === "listo" ? "bg-emerald-100 text-emerald-900" : "bg-muted"}`}>Preparación: {p.preparacion === "listo" ? "✓ Listo" : p.preparacion === "parcial" ? "Parcial" : "Sin preparar"}</p>}
          <p>Entrega: {p.estado === "entrega_fallida" ? "No entregado" : p.estado === "entregado" ? "Entregado" : p.estado === "en_reparto" ? "En reparto" : "Pendiente de entrega"}</p>
          {p.estado === "en_reparto" && <div className="space-y-3">
            <button className={boton} disabled={pendiente || !!solicitud} onClick={() => { setCierre(null); setIncierta(false); setSolicitud({ ruta: j.ruta, fecha: j.fecha, asignacion: j.asignacion, accion: "entregar", pedido: p.id, version: p.version, clave: crypto.randomUUID() }); }}>Todo entregado</button>
            <form className="space-y-3" onSubmit={e => {
              e.preventDefault(); const f = new FormData(e.currentTarget);
              if (f.get("motivo") === "Otro" && !String(f.get("observaciones") ?? "").trim()) { setMensaje("Describe el motivo Otro antes de continuar."); return; }
              setCierre(null); setIncierta(false);
              setSolicitud({ ruta: j.ruta, fecha: j.fecha, asignacion: j.asignacion, accion: "fallida", pedido: p.id, version: p.version, clave: crypto.randomUUID(), motivo: String(f.get("motivo")), observaciones: String(f.get("observaciones")) });
            }}>
              <label className="block">Motivo del intento fallido<select name="motivo" required className="block min-h-12 w-full rounded border p-2" disabled={pendiente || !!solicitud}>{["Cliente ausente", "Cliente rechazó pedido", "Dirección incorrecta", "Problema de acceso", "Otro"].map(m => <option key={m}>{m}</option>)}</select></label>
              <label className="block">Observaciones (obligatorias para Otro)<textarea name="observaciones" maxLength={1900} className="block w-full rounded border p-2" disabled={pendiente || !!solicitud} /></label>
              <button className={boton} disabled={pendiente || !!solicitud}>Revisar intento fallido</button>
            </form>
          </div>}
        </article>)}
        <button className={boton} disabled={pendiente || !!solicitud || !j.pedidos.length || resueltos !== j.pedidos.length} onClick={() => {
          if (j.ruta) { setIncierta(false); setSolicitud({ ruta: j.ruta, fecha: j.fecha, asignacion: j.asignacion, accion: "cerrar", clave: crypto.randomUUID() }); }
          else ejecutar({ fecha: j.fecha, asignacion: j.asignacion, accion: "revisar_cierre" });
        }}>Revisar y terminar ruta</button>
      </section>;
    })}
  </div>;
}
