"use client";

import { useState, useTransition } from "react";
import { cargarCorreccion, guardarCorreccion } from "@/app/(admin)/admin/correcciones-actions";
import type { ContextoCorreccion, ReemplazoPago, SolicitudCorreccion } from "@/lib/admin/correcciones-types";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { Button } from "@/components/ui/button";

const campo = "mt-1 block min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2";
const entero = (n: number) => Number.isSafeInteger(n) && n > 0;

export function AdministrativeCorrection({ tipo, id }: { tipo: "venta" | "pago"; id: string }) {
  const [contexto, setContexto] = useState<ContextoCorreccion>();
  const [error, setError] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [pendiente, iniciar] = useTransition();
  return <section className="mt-4 rounded-xl border border-border p-4">
    <Button variant="secondary" disabled={pendiente} onClick={() => {
      if (abierto) { setAbierto(false); setContexto(undefined); return; }
      iniciar(async () => {
        const r = await cargarCorreccion(tipo, id);
        setError(r.error ?? ""); setContexto(r.contexto); setAbierto(true);
      });
    }}>{pendiente ? "Consultando…" : abierto ? "Cerrar corrección" : tipo === "venta" ? "Consultar / corregir venta entregada" : "Consultar / corregir pago"}</Button>
    {error ? <p role="alert" className="mt-3 text-destructive">{error}</p> : null}
    {abierto && contexto ? <EditorCorreccion contexto={contexto} /> : null}
  </section>;
}

function EditorCorreccion({ contexto: c }: { contexto: ContextoCorreccion }) {
  const [cantidades, setCantidades] = useState(c.tipo === "venta" ? c.vigente.productos.map(p => String(p.cantidad_entregada)) : []);
  const [reemplazos, setReemplazos] = useState<ReemplazoPago[]>(c.tipo === "pago" && c.snapshot.pago.estado === "confirmado" ? [{
    monto: Number(c.snapshot.pago.monto), metodo: ["efectivo", "transferencia"].includes(c.snapshot.pago.metodo_pago) ? c.snapshot.pago.metodo_pago : "efectivo",
    referencia: c.snapshot.pago.referencia, aplicaciones: c.snapshot.aplicaciones.filter(a => a.activa).map(a => ({ pedido_id: a.pedido_id, monto: Number(a.monto_aplicado) })),
  }] : []);
  const [motivo, setMotivo] = useState("");
  const [revision, setRevision] = useState<{ solicitud: SolicitudCorreccion; detalle: string[] }>();
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState("");
  const [resultado, setResultado] = useState<unknown>();
  const [historial, setHistorial] = useState(c.historial);
  const [pendiente, iniciar] = useTransition();
  const [enviado, setEnviado] = useState(false);
  const corregible = c.tipo === "venta" || c.snapshot.pago.estado === "confirmado";
  const destinos = c.tipo === "pago" ? [...new Set(c.snapshot.aplicaciones.filter(a => a.activa).map(a => a.pedido_id))] : [];

  function revisar() {
    setError("");
    if (!motivo.trim() || motivo.trim().length > 2000) { setError("Indica un motivo de hasta 2000 caracteres."); return; }
    const solicitud: SolicitudCorreccion = { contexto: c, motivo: motivo.trim(), clave: crypto.randomUUID(), confirmado: true };
    const detalle: string[] = [];
    if (c.tipo === "venta") {
      let subtotal = 0, cambio = false;
      solicitud.items = [];
      for (const [indice, p] of c.vigente.productos.entries()) {
        const cantidad = Number(cantidades[indice]);
        const modo = p.modo_cantidad ?? (/(saco|malla|caja|paquete|docena)/i.test(p.nombre_presentacion ?? "") ? "presentacion_cerrada" : p.unidad.trim().toUpperCase() === "KG" ? "kg_fraccionable" : "unidad");
        if (!cantidades[indice].trim() || !Number.isFinite(cantidad) || cantidad < 0 || cantidad >= 1e9 || Math.abs(cantidad * 1000 - Math.round(cantidad * 1000)) > 0.00001 || (modo !== "kg_fraccionable" && !Number.isInteger(cantidad))) {
          setError(`Cantidad inválida para ${p.nombre_producto}. Sólo KG fraccionable admite hasta tres decimales.`); return;
        }
        const regla = c.reglas.find(r => r.id === p.item_pedido_id);
        if (!regla || regla.preparacion == null) { setError("Falta la preparación autorizada de este producto."); return; }
        let importe: number;
        if (cantidad === 0) importe = 0;
        else if (cantidad === Number(p.cantidad_preparada)) importe = Number(regla.preparacion);
        else if (cantidad === Number(p.cantidad_pedida)) importe = Number(regla.total_linea);
        else if (regla.total_final_administrativo !== null) { setError(`No existe una regla autorizada para esa cantidad de ${p.nombre_producto}.`); return; }
        else {
          const precio = Number(p.precio_final_unitario_referencia);
          if (!Number.isSafeInteger(precio) || precio < 0) { setError("Precio de referencia fuera del rango permitido."); return; }
          // Misma regla round(numeric) de la RPC, sin redondeo binario del producto.
          importe = Number((BigInt(Math.round(cantidad * 1000)) * BigInt(precio) + BigInt(500)) / BigInt(1000));
        }
        if (!Number.isSafeInteger(importe) || importe < 0) { setError("Importe fuera del rango permitido."); return; }
        subtotal += importe;
        cambio ||= cantidad !== Number(p.cantidad_entregada) || importe !== Number(p.importe_definitivo);
        solicitud.items.push({ item_pedido_id: p.item_pedido_id, cantidad_entregada: cantidad });
        detalle.push(`${p.nombre_producto}: ${p.cantidad_entregada} → ${cantidad} ${p.unidad} (diferencia ${cantidad - Number(p.cantidad_entregada)}); ${formatCLP(p.importe_definitivo)} → ${formatCLP(importe)} (diferencia ${formatCLP(importe - Number(p.importe_definitivo))})`);
      }
      const total = subtotal + Number(c.original.costo_entrega) - Number(c.original.descuento);
      if (!cambio || !Number.isSafeInteger(total) || total < 0) { setError("La propuesta debe contener cambios y un total válido."); return; }
      detalle.push(`Total vigente ${formatCLP(c.vigente.total)} → propuesto ${formatCLP(total)}. Diferencia: ${formatCLP(total - Number(c.vigente.total))}. Despacho ${formatCLP(c.original.costo_entrega)}; descuento ${formatCLP(c.original.descuento)}.`);
    } else {
      let total = 0;
      for (const r of reemplazos) {
        if (!entero(r.monto) || !["efectivo", "transferencia"].includes(r.metodo) || r.aplicaciones.some(a => !Number.isSafeInteger(a.monto) || a.monto < 0 || !destinos.includes(a.pedido_id)) || r.aplicaciones.reduce((s, a) => s + a.monto, 0) > r.monto) {
          setError("Usa importes enteros positivos y aplicaciones que no superen cada reemplazo."); return;
        }
        total += r.monto;
      }
      if (!Number.isSafeInteger(total)) { setError("El total supera el rango permitido."); return; }
      solicitud.reemplazos = reemplazos.map(r => ({ ...r, referencia: r.referencia?.trim() || null, aplicaciones: r.aplicaciones.filter(a => a.monto > 0) }));
      detalle.push(`Se anulará el pago original de ${formatCLP(c.snapshot.pago.monto)}. Reemplazos: ${formatCLP(total)}. Diferencia: ${formatCLP(total - c.snapshot.pago.monto)}.`);
      if (!reemplazos.length) detalle.push("Reverso puro: sin pagos de reemplazo.");
      solicitud.reemplazos.forEach((r, i) => {
        const aplicado = r.aplicaciones.reduce((s, a) => s + a.monto, 0);
        detalle.push(`Reemplazo ${i + 1}: ${formatCLP(r.monto)}, ${r.metodo}, referencia ${r.referencia ?? "sin referencia"}; sin aplicar ${formatCLP(r.monto - aplicado)}.`);
        r.aplicaciones.forEach(a => detalle.push(`Pedido ${a.pedido_id}: aplicar ${formatCLP(a.monto)}.`));
      });
      destinos.forEach(id => {
        const anterior = c.snapshot.aplicaciones.filter(a => a.activa && a.pedido_id === id).reduce((s, a) => s + Number(a.monto_aplicado), 0);
        const nuevo = reemplazos.flatMap(r => r.aplicaciones).filter(a => a.pedido_id === id).reduce((s, a) => s + a.monto, 0);
        detalle.push(`Aplicación al pedido ${id}: ${formatCLP(anterior)} → ${formatCLP(nuevo)}; diferencia ${formatCLP(nuevo - anterior)}.`);
      });
    }
    setRevision({ solicitud, detalle }); setConfirmado(false);
  }

  return <div className="mt-4 space-y-4 text-sm">
    {c.tipo === "venta" ? <>
      <h3 className="font-semibold">Venta original y vigente</h3>
      <p>Total original: {formatCLP(c.original.total)} · Total vigente: {formatCLP(c.vigente.total)} · Versión {c.version}</p>
      <fieldset disabled={!!revision || pendiente || resultado !== undefined} className="space-y-3">
        {c.vigente.productos.map((p, i) => <label key={p.item_pedido_id} className="block">{p.nombre_producto} · {p.nombre_presentacion} · {p.unidad}
          <span className="block text-muted-foreground">Original entregado: {c.original.productos.find(o => o.item_pedido_id === p.item_pedido_id)?.cantidad_entregada}; vigente: {p.cantidad_entregada}. Importe vigente: {formatCLP(p.importe_definitivo)}.</span>
          Cantidad corregida<input aria-label={`Cantidad corregida de ${p.nombre_producto}`} type="number" min="0" step="any" value={cantidades[i]} onChange={e => setCantidades(cantidades.map((v, n) => n === i ? e.target.value : v))} className={campo} />
        </label>)}
      </fieldset>
      <p>La revisión aplica las prioridades de importe de la RPC. La base de datos valida la operación y determina el resultado definitivo.</p>
      <Datos titulo="Saldo vigente del pedido" valor={c.saldo} />
    </> : <>
      <h3 className="font-semibold">Pago original</h3>
      <p>{formatCLP(c.snapshot.pago.monto)} · {c.snapshot.pago.metodo_pago} · {c.snapshot.pago.referencia ?? "Sin referencia"} · {c.snapshot.pago.estado}</p>
      <ul>{c.snapshot.aplicaciones.map(a => <li key={a.id}>Pedido {a.pedido_id}: {formatCLP(a.monto_aplicado)} · {a.activa ? "Activa" : "Histórica / anulada"}</li>)}</ul>
      <p>Se conserva el pago original anulado. Los reemplazos usan aplicaciones explícitas a sus pedidos originales activos. El excedente queda sin aplicar.</p>
      {corregible ? <fieldset disabled={!!revision || pendiente || resultado !== undefined} className="space-y-4">
        {reemplazos.map((r, i) => <div key={i} className="space-y-3 rounded-lg border border-border p-3">
          <h4 className="font-medium">Reemplazo {i + 1}</h4>
          <label className="block">Monto CLP<input className={campo} type="number" min="1" step="1" value={r.monto || ""} onChange={e => setReemplazos(reemplazos.map((v, n) => n === i ? { ...v, monto: Number(e.target.value) } : v))} /></label>
          <label className="block">Método<select className={campo} value={r.metodo} onChange={e => setReemplazos(reemplazos.map((v, n) => n === i ? { ...v, metodo: e.target.value } : v))}><option value="efectivo">Efectivo</option><option value="transferencia">Transferencia</option></select></label>
          <label className="block">Referencia<input className={campo} value={r.referencia ?? ""} onChange={e => setReemplazos(reemplazos.map((v, n) => n === i ? { ...v, referencia: e.target.value } : v))} /></label>
          {destinos.map(id => <label key={id} className="block">Aplicar al pedido {id} (0 = sin aplicación)<input className={campo} type="number" min="0" step="1" value={r.aplicaciones.find(a => a.pedido_id === id)?.monto ?? 0} onChange={e => setReemplazos(reemplazos.map((v, n) => n === i ? { ...v, aplicaciones: [...v.aplicaciones.filter(a => a.pedido_id !== id), { pedido_id: id, monto: Number(e.target.value) }] } : v))} /></label>)}
          <Button variant="secondary" onClick={() => setReemplazos(reemplazos.filter((_, n) => n !== i))}>Quitar reemplazo</Button>
        </div>)}
        <Button variant="secondary" onClick={() => setReemplazos([...reemplazos, { monto: 0, metodo: "efectivo", referencia: null, aplicaciones: [] }])}>Agregar reemplazo</Button>
        <p>Quita todos los reemplazos para realizar un reverso puro. Para pago mixto, agrega uno por método.</p>
      </fieldset> : <p>Este pago ya no admite correcciones.</p>}
    </>}
    {corregible && resultado === undefined ? <>
      <label className="block">Motivo obligatorio<textarea className={campo} required maxLength={2000} disabled={!!revision || pendiente} value={motivo} onChange={e => setMotivo(e.target.value)} /></label>
      {!revision ? <Button onClick={revisar}>Revisar diferencias</Button> : <div className="space-y-3 rounded-lg border border-border p-4">
        <h3 className="font-semibold">Revisión antes de guardar</h3>
        <ul className="space-y-2">{revision.detalle.map((d, i) => <li key={i}>{d}</li>)}</ul>
        <p>Motivo: {revision.solicitud.motivo}</p>
        <label className="flex items-center gap-2"><input type="checkbox" checked={confirmado} disabled={pendiente || enviado} onChange={e => setConfirmado(e.target.checked)} />Confirmo las diferencias y autorizo guardar esta corrección contable.</label>
        <div className="flex flex-wrap gap-3">
          {!enviado ? <Button variant="secondary" disabled={pendiente} onClick={() => setRevision(undefined)}>Volver a editar</Button> : null}
          <Button disabled={!confirmado || pendiente} onClick={() => iniciar(async () => {
            setEnviado(true); setError("");
            try {
              const r = await guardarCorreccion(revision.solicitud);
              setError(r.error ?? "");
              if (r.resultado !== undefined) {
                setResultado(r.resultado);
                const actualizado = await cargarCorreccion(c.tipo, c.id);
                if (actualizado.contexto) setHistorial(actualizado.contexto.historial);
                else setError("La corrección fue guardada, pero no se pudo actualizar el historial. Cierra y consulta nuevamente.");
              }
            } catch { setError("Resultado desconocido. Reintenta esta misma solicitud para conservar la idempotencia."); }
          })}>{pendiente ? "Guardando…" : enviado ? "Reintentar misma confirmación" : "Confirmar y guardar"}</Button>
        </div>
        {enviado ? <p>La solicitud conserva su clave y expectativas para reintentos seguros. Si hubo conflicto, cierra y consulta nuevamente.</p> : null}
      </div>}
    </> : null}
    {error ? <p role="alert" className="text-destructive">{error}</p> : null}
    {resultado !== undefined ? <div role="status"><p className="font-semibold">Corrección guardada. La cuenta y los pedidos se han actualizado.</p><Datos titulo="Resultado contable" valor={resultado} /></div> : null}
    <h3 className="font-semibold">Historial de correcciones</h3>
    {historial.length ? historial.map(h => <article key={h.id} className="space-y-2 border-t border-border pt-3">
      <p>{formatDateTimeCL(h.fecha)} · Administrador {h.actor_id}</p><p className="whitespace-pre-wrap">Motivo: {h.motivo}</p>
      {h.diferencia !== undefined ? <p>Diferencia: {formatCLP(h.diferencia)}</p> : null}
      <Datos titulo="Valores anteriores" valor={h.anteriores} /><Datos titulo="Valores nuevos" valor={h.nuevos} />
      {h.resultado ? <Datos titulo="Resultado" valor={h.resultado} /> : null}
    </article>) : <p>Sin correcciones registradas.</p>}
  </div>;
}

function Datos({ titulo, valor }: { titulo: string; valor: unknown }) {
  return <details><summary className="cursor-pointer font-medium">{titulo}</summary><div className="mt-2 max-h-96 overflow-auto rounded-lg bg-muted p-3"><Valores valor={valor} /></div></details>;
}

const etiquetas: Record<string, string> = {
  pago: "Pago", aplicaciones: "Aplicaciones", original: "Original", reemplazos: "Reemplazos", pedidos: "Pedidos",
  total_corregido: "Total corregido", saldo_cuenta: "Saldo de cuenta", saldo_pedido: "Saldo del pedido",
  deuda: "Deuda", deuda_pedido: "Deuda del pedido", saldo_a_favor: "Saldo a favor",
  credito_por_sobreaplicacion: "Crédito por sobreaplicación", pagos_reemplazo: "Pagos de reemplazo",
  actor_id: "Administrador", registrado_por: "Registrado por", motivo_anulacion: "Motivo de anulación",
};
const importes = /^(monto|monto_aplicado|importe_definitivo|total|subtotal|costo_entrega|descuento|diferencia|total_corregido|saldo_cuenta|saldo_pedido|saldo_pendiente|total_pedido|total_pagado|deuda|deuda_pedido|saldo_a_favor|credito_por_sobreaplicacion)$/;
function Valores({ valor, nombre = "" }: { valor: unknown; nombre?: string }) {
  if (valor === null || valor === undefined) return <span>Sin registro</span>;
  if (Array.isArray(valor)) return valor.length ? <ol className="space-y-2">{valor.map((v, i) => <li key={i} className="border-l border-border pl-3"><Valores valor={v} /></li>)}</ol> : <span>Sin registros</span>;
  if (typeof valor === "object") return <dl className="space-y-2">{Object.entries(valor).map(([k, v]) => <div key={k}><dt className="font-medium">{etiquetas[k] ?? k.replaceAll("_", " ")}</dt><dd className="break-words pl-3"><Valores valor={v} nombre={k} /></dd></div>)}</dl>;
  return <span>{typeof valor === "boolean" ? valor ? "Sí" : "No" : importes.test(nombre) ? formatCLP(Number(valor)) : String(valor)}</span>;
}
