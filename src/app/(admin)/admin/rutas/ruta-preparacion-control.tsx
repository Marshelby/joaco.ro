"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DetalleEntregaAdmin } from "@/lib/admin/pedidos";
import type { RutaMultiple } from "./multiple-types";
import { confirmarPreparacionRuta } from "./preparacion-actions";
import { formatCLP } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";

type Props = {
  ruta: Pick<RutaMultiple, "id" | "nombre" | "version" | "pedidos">;
  fecha?: string;
  // El resumen consulta la colección readonly entregada por administración.
  pedidos: DetalleEntregaAdmin["pedidos"];
  habilitada: boolean;
};

export function RutaPreparacionControl({ ruta, pedidos, habilitada, fecha }: Props) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  const [enviada, setEnviada] = useState(false);
  const solicitud = useRef<FormData | null>(null);
  const ejecutando = useRef(false);
  const pendientes = pedidos.length !== ruta.pedidos.length || !pedidos.length || pedidos.some(p => !p.items.length || !["preparando", "listo_despacho"].includes(p.estado) || p.items.some(i => i.cantidadPreparada === null));
  const excepciones = pedidos.flatMap(p => p.estado === "listo_despacho" ? [] : p.items.filter(i => i.cantidadPreparada !== null && i.importeCalculado == null).map(i => `${p.numeroPedido} · ${i.nombreProducto} · ${i.nombrePresentacion ?? i.unidad}`));
  return <section className="space-y-3 rounded-xl border bg-card p-4">
    <Button disabled={!habilitada || pendiente} onClick={() => {
      if (document.querySelector('[data-preparacion-pendiente="true"]')) { setMensaje("Guarda las cantidades editadas antes de revisar la ruta."); return; }
      setMensaje(""); setAbierto(true);
    }}>Productos de la ruta preparados</Button>
    {abierto && <form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      if (ejecutando.current || pendientes || excepciones.length) return;
      if (!solicitud.current) {
        if (document.querySelector('[data-preparacion-pendiente="true"]')) { setMensaje("Guarda las cantidades editadas antes de confirmar."); return; }
        const datos = new FormData(e.currentTarget);
        datos.set("ruta", ruta.id); if (fecha) datos.set("fecha", fecha); datos.set("version", String(ruta.version)); datos.set("clave", crypto.randomUUID());
        datos.set("pedidos", JSON.stringify(pedidos.map(p => ({ id: p.id, version: p.versionPreparacion, sin_stock: datos.get(`sin-stock-${p.id}`) === "si", items: p.items.map(i => ({ id: i.id, cantidad: i.cantidadPreparada })) }))));
        solicitud.current = datos;
      }
      ejecutando.current = true; setEnviada(true);
      iniciar(async () => {
        try {
          const resultado = await confirmarPreparacionRuta(solicitud.current!);
          if (resultado.error) { setMensaje(resultado.error); return; }
          setAbierto(false); setMensaje("Preparación de la ruta confirmada. Puedes registrar la salida efectiva."); router.refresh();
        } catch { setMensaje("Respuesta no recibida. Reintenta la misma confirmación para recuperar el resultado sin duplicar operaciones."); }
        finally { ejecutando.current = false; }
      });
    }}>
      <h2 className="font-semibold">Resumen de toda la ruta · {ruta.nombre}</h2>
      {pendientes && <p role="alert" className="text-sm text-destructive">Hay pedidos pendientes de preparación, vacíos o sin aceptar. Guarda todas las cantidades, incluso cero. Los pedidos vacíos requieren revisión; no se consideran sin stock.</p>}
      {excepciones.length > 0 && <div role="alert" className="rounded-lg border border-amber-300 p-3 text-sm"><p className="font-semibold">Excepción comercial: no se puede confirmar esta preparación.</p><p>Estas líneas tienen un total cerrado sin regla de precio para la cantidad cargada. Se necesita una regla comercial autorizada; no se prorratea ni se inventa un precio.</p><ul className="mt-2 list-disc pl-5">{excepciones.map(linea => <li key={linea}>{linea}</li>)}</ul></div>}
      <fieldset disabled={pendiente || enviada} className="space-y-3">
        {pedidos.map(p => {
          const sinTrabajar = !p.items.length || p.items.some(i => i.cantidadPreparada === null);
          const cero = !sinTrabajar && p.items.every(i => i.cantidadPreparada === 0);
          const estado = sinTrabajar ? "PENDIENTE DE PREPARACIÓN" : cero ? "SIN STOCK · requiere declaración expresa" : p.items.every(i => i.cantidadPreparada === i.cantidad) ? "COMPLETO" : "PARCIAL";
          return <section key={p.id} className="rounded-lg border p-3">
            <h3 className="text-sm font-semibold">{p.numeroPedido} · {p.nombreClienteSnapshot} · {estado}</h3>
            <ul className="divide-y">{p.items.map(i => {
              const formato = (n: number) => formatearCantidadPreparacionEntrega(n, i.nombrePresentacion, i.unidad, i.modoCantidadSnapshot);
              return <li key={i.id} className="space-y-2 py-3 text-sm"><p>{i.nombreProducto} · {i.nombrePresentacion}</p><p className="text-xs">Solicitado: {formato(i.cantidad)} · Preparado: {i.cantidadPreparada === null ? "Sin preparar" : formato(i.cantidadPreparada)} · Enviado: {formato(0)} · Diferencia: {i.cantidadPreparada === null ? "Pendiente" : formato(i.cantidadPreparada - i.cantidad)}</p>
                <p className="text-xs">Importe: {p.estado === "listo_despacho" && i.importeOperativo !== null ? formatCLP(i.importeOperativo) : i.importeCalculado != null ? formatCLP(Number(i.importeCalculado)) : i.cantidadPreparada === null ? "Pendiente de cantidad" : "Excepción comercial indicada en el resumen"}</p>
              </li>;
            })}</ul>
            {cero && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" name={`sin-stock-${p.id}`} value="si" required />Confirmo que no se cargó absolutamente nada: No entregado — Sin stock, sin venta, deuda ni cobro.</label>}
          </section>;
        })}
        <input type="hidden" name="motivo" value="Cantidades reales aceptadas en la confirmación única de preparación de la ruta" />
      </fieldset>
      <p className="text-sm text-muted-foreground">La confirmación registra el cierre, los importes calculados y la autorización de diferencias en una única transacción. La salida efectiva se registra después.</p>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={!habilitada || pendientes || excepciones.length > 0 || pendiente}>{pendiente ? "Confirmando…" : "Confirmar preparación de la ruta"}</Button><Button type="button" variant="outline" disabled={pendiente} onClick={() => { solicitud.current = null; setEnviada(false); setAbierto(false); router.refresh(); }}>Volver a cantidades</Button></div>
    </form>}
    <p role="status" className="text-sm">{mensaje}</p>
  </section>;
}
