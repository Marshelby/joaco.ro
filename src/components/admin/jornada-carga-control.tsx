"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { operarCargaAction } from "@/app/(admin)/admin/pedidos/carga-actions";
import type { CargaJornada } from "@/lib/admin/cargas";
import { OrderIdentity } from "@/components/admin/order-identity";
import { Button } from "@/components/ui/button";

type Props = { fecha: string; carga: CargaJornada; habilitada: boolean; identidades?: Record<string, { nombreClienteSnapshot: string; nombreUbicacionSnapshot: string | null; numeroPedido: string }> };

export function JornadaCargaControl(props: Props) {
  // Una revisión persistida nueva descarta borradores basados en la versión anterior.
  return <ControlCarga key={`${props.fecha}:${props.carga.version}`} {...props} />;
}

function ControlCarga({ fecha, carga, habilitada, identidades = {} }: Props) {
  const router = useRouter();
  const [cambios, setCambios] = useState<Record<string, { incluido: boolean; motivo: string }>>({});
  // Reconciliar por ID en cada render: conserva borradores al reordenar y muestra
  // pedidos nuevos sin seleccionarlos. Nunca envía IDs que dejaron de existir.
  const seleccion = carga.pedidos.map((p) => ({ id: p.id, ...(cambios[p.id] ?? { incluido: p.incluido ?? false, motivo: p.motivo ?? "" }) }));
  const porId = new Map(seleccion.map((p) => [p.id, p]));
  const sucia = carga.pedidos.some((p) => cambios[p.id] !== undefined);
  function cambiar(id: string, cambio: Partial<{ incluido: boolean; motivo: string }>) {
    const actual = porId.get(id)!;
    setCambios((previos) => ({ ...previos, [id]: { incluido: actual.incluido, motivo: actual.motivo, ...cambio } }));
  }
  const [motivo, setMotivo] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  // Una respuesta de red incierta conserva clave y payload al reintentar.
  const intento = useRef<{ firma: string; clave: string } | null>(null);
  const lista = carga.estado === "lista";
  const salio = carga.estado === "en_ruta" || carga.estado === "cerrada";
  const incompletos = carga.pedidos.filter((p) => p.incluido && (p.pendientes > 0 || p.estado !== "listo_despacho"));

  function operar(accion: "guardar" | "confirmar" | "salir" | "reabrir") {
    const solicitud = { fecha, version: carga.version, accion, pedidos: accion === "guardar" ? [...seleccion].sort((a, b) => a.id.localeCompare(b.id)) : null, motivo: accion === "reabrir" ? motivo : null };
    const firma = JSON.stringify(solicitud);
    if (intento.current?.firma !== firma) intento.current = { firma, clave: crypto.randomUUID() };
    const clave = intento.current.clave;
    iniciar(async () => {
      try {
        const resultado = await operarCargaAction({ ...solicitud, clave });
        if (resultado.error) { setMensaje(resultado.error); return; }
        setMensaje("Operación registrada. Actualizando la jornada…");
        router.refresh();
      } catch { setMensaje("No se recibió respuesta. Reintenta la misma acción para recuperar el resultado sin duplicarla."); }
    });
  }

  return <section className="space-y-4 rounded-xl border border-border bg-card p-4 sm:p-6" aria-labelledby="carga-title">
    <div><h2 id="carga-title" className="text-xl font-semibold">Carga de camioneta</h2><p className="mt-1 text-sm">Estado de la carga: <strong>{carga.estado === "cerrada" ? "Cerrada" : lista ? "Lista para salir" : salio ? "En ruta" : "En preparación"}</strong> · Revisión {carga.version}</p></div>
    <p className="text-sm text-muted-foreground">Guarda los pedidos incluidos y los motivos de exclusión. Pedidos listos confirma que todos los productos ya están preparados y físicamente cargados en la camioneta. Los pedidos conservan su estado individual hasta Salir a ruta.</p>
    <fieldset disabled={pendiente || !habilitada || lista || salio} className="space-y-3">
      <legend className="sr-only">Pedidos de la carga</legend>
      {carga.pedidos.map((p) => <div key={p.id} className="space-y-2 rounded-lg border p-3 sm:grid sm:grid-cols-2 sm:gap-3">
        <label className="flex min-h-11 items-center gap-3"><input type="checkbox" checked={porId.get(p.id)!.incluido} disabled={p.estado === "cancelado" && !porId.get(p.id)!.incluido} onChange={(e) => cambiar(p.id, { incluido: e.target.checked })} /><span><span className="block font-semibold">{identidades[p.id] ? "Incluir en la carga" : p.cliente}</span>{!identidades[p.id] ? <span className="block text-xs text-muted-foreground">{p.numero}</span> : null}<span className="block text-sm text-muted-foreground">Pedido: {p.estado} · {p.pendientes} productos pendientes{p.incluido === null ? " · Sin decisión guardada" : ""}</span></span></label>
        {identidades[p.id] ? <OrderIdentity pedido={identidades[p.id]} /> : null}
        <details className="text-sm sm:col-span-2"><summary className="min-h-11 cursor-pointer py-2">Revisar productos de {p.numero}</summary><ul className="space-y-1">{p.productos.map((producto) => <li key={producto.id}>{producto.nombre} · {producto.confirmado ? `Preparado: ${producto.cantidad} · Importe: $${producto.importe}` : "Pendiente de confirmación"}</li>)}</ul><Link className="inline-block min-h-11 py-2 text-primary underline" href={`/admin/pedidos/${p.id}`}>Ver pedido completo</Link></details>
        {!porId.get(p.id)!.incluido && <label className="block text-sm">Motivo obligatorio de exclusión<input className="mt-1 min-h-11 w-full rounded border bg-background px-3" maxLength={2000} value={porId.get(p.id)!.motivo} onChange={(e) => cambiar(p.id, { motivo: e.target.value })} /></label>}
      </div>)}
    </fieldset>
    {!lista && !salio && carga.pedidos.some((p) => p.incluido === null) && <p className="text-sm">Hay pedidos sin decisión guardada. Revisa su inclusión o indica un motivo de exclusión y guarda antes de confirmar.</p>}
    {sucia && <p className="text-sm">Hay cambios sin guardar. Guarda la selección antes de confirmar.</p>}
    {incompletos.length > 0 && !salio && <p className="text-sm text-destructive">{incompletos.length} pedidos incluidos requieren completar productos o cerrar su preparación.</p>}
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {!lista && !salio && <><Button disabled={pendiente || !habilitada || seleccion.length === 0 || seleccion.some((p) => !p.incluido && !p.motivo.trim())} onClick={() => operar("guardar")}>Guardar selección de carga</Button><Button disabled={pendiente || !habilitada || sucia || carga.pedidos.some((p) => p.incluido === null) || incompletos.length > 0 || !carga.pedidos.some((p) => p.incluido)} onClick={() => operar("confirmar")}>Pedidos listos · Confirmar carga física</Button></>}
      {lista && <Button disabled={pendiente || !habilitada} onClick={() => operar("salir")}>Salir a ruta</Button>}
    </div>
    {lista && <div className="space-y-2 border-t pt-3"><label className="block text-sm">Motivo para volver a preparación<textarea className="mt-1 block min-h-20 w-full rounded border bg-background p-3" maxLength={2000} value={motivo} onChange={(e) => setMotivo(e.target.value)} disabled={pendiente || !habilitada} /></label><Button variant="secondary" disabled={pendiente || !habilitada || !motivo.trim()} onClick={() => operar("reabrir")}>Volver a preparación conservando cantidades e importes</Button></div>}
    {salio && <p className="text-sm">{carga.estado === "cerrada" ? "Ruta cerrada. Consulta su resultado desde Rutas." : "Salida registrada. Consulta el resultado y termina la ruta desde Rutas."}</p>}
    <p role="status" className="text-sm">{pendiente ? "Registrando operación…" : mensaje}</p>
    {carga.historial.length > 0 && <details><summary className="cursor-pointer text-sm">Auditoría de carga</summary><ol className="space-y-2 pt-3 text-sm">{carga.historial.map((h) => <li key={h.version} className="break-words">Revisión {h.version} · {h.solicitud.accion} · {h.instante} · Actor {h.actor}{h.solicitud.motivo ? ` · ${h.solicitud.motivo}` : ""}</li>)}</ol></details>}
  </section>;
}
