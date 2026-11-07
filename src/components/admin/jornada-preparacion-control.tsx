"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarPedidoPreparando, guardarPreparacionItemPedido, finalizarPreparacionPedidoAction } from "@/app/(admin)/admin/pedidos/actions";
import type { PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { Button } from "@/components/ui/button";

type Paso = { tipo: "inicio" | "producto" | "cierre"; datos: FormData };

export function JornadaPreparacionControl({ pedidos, habilitada }: { pedidos: PedidoEntregaAdmin[]; habilitada: boolean }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [pendiente, iniciar] = useTransition();
  // Mantener payload, versión y clave de cada paso ante una respuesta perdida.
  const cola = useRef<Paso[] | null>(null);
  const ejecutando = useRef(false);
  const [iniciada, setIniciada] = useState(false);
  const [cantidades, setCantidades] = useState<Record<string, string>>({});
  const activos = pedidos.filter(p => p.estado === "confirmado" || p.estado === "preparando");
  const bloqueada = pedidos.some(p => p.estado === "recibido");
  return <section className="rounded-xl border bg-card p-4 space-y-3">
    <Button disabled={!habilitada || bloqueada || activos.length === 0 || pendiente} onClick={() => { if (document.querySelector('[data-preparacion-pendiente="true"]')) { setMensaje("Guarda o cancela los cambios pendientes antes de revisar la jornada."); return; } setMensaje(""); setAbierto(true); }}>Todos los pedidos preparados</Button>
    {bloqueada ? <p className="text-sm">Hay pedidos recibidos pendientes de aceptación. Resuélvelos antes de confirmar la jornada.</p> : null}
    {abierto ? <form className="space-y-4" onSubmit={e => {
      e.preventDefault();
      if (ejecutando.current) return;
      if (!cola.current && document.querySelector('[data-preparacion-pendiente="true"]')) { setMensaje("Guarda o cancela los cambios pendientes antes de confirmar."); return; }
      if (!cola.current) {
        const formulario = new FormData(e.currentTarget);
        const pasos: Paso[] = [];
        for (const pedido of activos) {
          let version = pedido.versionPreparacion;
          const datosPedido = () => { const d = new FormData(); d.set("pedidoId", pedido.id); d.set("version", String(version)); d.set("clave", crypto.randomUUID()); return d; };
          if (pedido.estado === "confirmado") pasos.push({ tipo: "inicio", datos: datosPedido() });
          for (const item of pedido.items) {
            const d = datosPedido();
            d.set("itemPedidoId", item.id);
            d.set("cantidadPreparada", String(formulario.get(`cantidad-${item.id}`)));
            d.set("importe", String(formulario.get(`importe-${item.id}`) ?? ""));
            d.set("motivo", "Confirmación explícita general de preparación de la jornada");
            pasos.push({ tipo: "producto", datos: d });
            version += 1;
          }
          pasos.push({ tipo: "cierre", datos: datosPedido() });
        }
        cola.current = pasos;
      }
      ejecutando.current = true;
      setIniciada(true);
      iniciar(async () => {
        try {
          while (cola.current?.length) {
            const paso = cola.current[0];
            const resultado = paso.tipo === "inicio" ? await marcarPedidoPreparando({}, paso.datos) : paso.tipo === "producto" ? await guardarPreparacionItemPedido({}, paso.datos) : await finalizarPreparacionPedidoAction({}, paso.datos);
            if (resultado.error) { setMensaje(`${resultado.error} Los pasos completados se conservan. Reintenta o recarga para revisar la jornada.`); return; }
            cola.current.shift();
          }
          setMensaje("Todos los pedidos preparados. Ahora confirma la carga física de la camioneta.");
          setAbierto(false);
          setIniciada(false);
          cola.current = null;
          router.refresh();
        } catch { setMensaje("Respuesta no recibida. Reintenta para recuperar la misma operación sin duplicarla."); }
        finally { ejecutando.current = false; }
      });
    }}>
      <p className="text-sm">Revisa todos los productos de la jornada. Puedes resolver faltantes con cantidades menores o cero; cada cantidad distinta de la solicitada exige un importe total manual, también con cero. Guarda primero los avances pendientes en las filas.</p>
      <fieldset disabled={pendiente || iniciada} className="space-y-3">
        {activos.map(p => <div key={p.id} className="space-y-2"><h3 className="font-semibold">{p.nombreClienteSnapshot} · {p.numeroPedido}</h3>{p.items.map(item => {
          const cantidad = cantidades[item.id] ?? String(item.cantidadPreparada ?? 0);
          const distinta = Number(cantidad) !== item.cantidad;
          return <div key={item.id} className="flex flex-wrap items-end gap-3 rounded border p-2 text-sm"><span>{item.nombreProducto} · {item.nombrePresentacion} · Solicitado: {item.cantidad}</span><label>Cantidad preparada<input name={`cantidad-${item.id}`} type="number" required min="0" max="999999999.999" step={resolverModoCantidadPreparacion(item) === "kg_fraccionable" ? "0.001" : "1"} value={cantidad} onChange={e => setCantidades(v => ({ ...v, [item.id]: e.target.value }))} className="ml-2 w-24 rounded border bg-background p-2" /></label>{distinta ? <label>Importe total manual (CLP)<input key={cantidad} name={`importe-${item.id}`} type="number" required min="0" max="9007199254740991" step="1" className="ml-2 w-32 rounded border bg-background p-2" /></label> : null}</div>;
        })}</div>)}
      </fieldset>
      <p className="text-sm font-medium">Confirmar registra explícitamente todos estos productos y cierra la preparación de los pedidos. Después deberás confirmar la carga física antes de salir a ruta.</p>
      <div className="flex gap-2"><Button type="button" variant="outline" disabled={pendiente || iniciada} onClick={() => setAbierto(false)}>Cancelar</Button><Button type="submit" disabled={pendiente}>{pendiente ? "Confirmando…" : iniciada ? "Reintentar confirmación" : "Confirmar todos los productos y cerrar preparación"}</Button></div>
    </form> : null}
    <p role="status" className="text-sm">{mensaje}</p>
  </section>;
}
