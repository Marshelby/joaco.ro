"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarPedidoPreparando, guardarPreparacionItemPedido, finalizarPreparacionPedidoAction } from "@/app/(admin)/admin/pedidos/actions";
import type { PedidoEntregaAdmin } from "@/lib/admin/pedidos";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { Button } from "@/components/ui/button";

type Paso = { tipo: "inicio" | "producto" | "cierre"; datos: FormData };

export function JornadaPreparacionControl({ pedidos, habilitada }: { pedidos: readonly PedidoEntregaAdmin[]; habilitada: boolean }) {
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
  const clientes = new Map<string, { nombre: string; pedidos: PedidoEntregaAdmin[] }>();
  for (const pedido of activos) {
    const claveCliente = pedido.clienteId ?? pedido.nombreClienteSnapshot;
    const grupo = clientes.get(claveCliente) ?? { nombre: pedido.nombreClienteSnapshot, pedidos: [] };
    grupo.pedidos.push(pedido);
    clientes.set(claveCliente, grupo);
  }
  const productos = activos.flatMap(p => p.items);
  const faltantes = productos.filter(item => Number(cantidades[item.id] ?? item.cantidadPreparada ?? 0) < item.cantidad).length;
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h2 className="text-base font-semibold">Resumen de preparación</h2>
          <p className="mt-1 text-xs text-muted-foreground">Revisa las cantidades y los importes antes de confirmar la jornada.</p>
        </div>
        <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">{clientes.size} clientes · {productos.length} productos</span>
      </div>
      {faltantes > 0 ? <div role="status" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="font-semibold">Revisar antes de confirmar: {faltantes} {faltantes === 1 ? "producto con faltantes" : "productos con faltantes"}</p>
        <p className="mt-1 text-xs">Puedes confirmar cantidades parciales o cero. Revisa el importe manual de cada diferencia, también cuando se prepare más de lo solicitado.</p>
      </div> : null}
      <fieldset disabled={pendiente || iniciada} className="min-w-0 space-y-3">
        <legend className="sr-only">Productos preparados por cliente</legend>
        {Array.from(clientes, ([id, cliente]) => <section key={id} className="overflow-hidden rounded-xl border bg-background">
          <div className="flex flex-wrap items-center justify-between gap-2 bg-muted/50 px-3 py-2">
            <h3 className="min-w-0 break-words text-sm font-semibold">{cliente.nombre}</h3>
            <span className="text-xs text-muted-foreground">{cliente.pedidos.length} {cliente.pedidos.length === 1 ? "pedido" : "pedidos"}</span>
          </div>
          {cliente.pedidos.map(p => <div key={p.id}>
            <p className="border-t px-3 py-1.5 text-[11px] font-medium text-muted-foreground">Pedido {p.numeroPedido}</p>
            <div className="divide-y">{p.items.map(item => {
              const cantidad = cantidades[item.id] ?? String(item.cantidadPreparada ?? 0);
              const valor = Number(cantidad);
              const valida = cantidad !== "" && Number.isFinite(valor) && valor >= 0;
              const distinta = valor !== item.cantidad;
              const falta = valida && valor < item.cantidad;
              const estado = !valida ? "Revisar cantidad" : valor === 0 ? "Sin unidades" : falta ? "Parcial" : valor > item.cantidad ? "Cantidad superior" : "Completo";
              const color = !valida ? "bg-muted text-muted-foreground" : valor === 0 ? "bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-200" : falta ? "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200" : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";
              const formato = (n: number) => formatearCantidadPreparacionEntrega(n, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);
              return <div key={item.id} className="grid min-w-0 grid-cols-2 items-center gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1fr)_7rem_8rem]">
                <div className="col-span-2 min-w-0 sm:col-span-1">
                  <p className="break-words text-sm font-medium">{item.nombreProducto}</p>
                  {item.nombrePresentacion ? <p className="text-xs text-muted-foreground">{item.nombrePresentacion}</p> : null}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`rounded-md px-2 py-0.5 text-[11px] font-medium ${color}`}>{estado}</span>
                    {falta ? <span className="text-xs font-medium text-amber-800 dark:text-amber-200">Faltan {formato(item.cantidad - valor)}</span> : null}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">Solicitado<span className="mt-1 block font-semibold tabular-nums text-foreground">{formato(item.cantidad)}</span></div>
                <label className="text-xs text-muted-foreground" htmlFor={`revision-cantidad-${item.id}`}>Preparado
                  <input id={`revision-cantidad-${item.id}`} name={`cantidad-${item.id}`} type="number" inputMode={resolverModoCantidadPreparacion(item) === "kg_fraccionable" ? "decimal" : "numeric"} required min="0" max="999999999.999" step={resolverModoCantidadPreparacion(item) === "kg_fraccionable" ? "0.001" : "1"} value={cantidad} onChange={e => setCantidades(v => ({ ...v, [item.id]: e.target.value }))} className={`mt-1 h-9 w-full rounded-md border border-input px-2 text-sm font-semibold tabular-nums ${color}`} />
                </label>
                {distinta ? <div className="col-span-2 grid gap-1 rounded-lg bg-muted/40 px-3 py-2 sm:col-span-3 sm:grid-cols-[minmax(0,1fr)_8rem] sm:items-center sm:gap-x-3">
                  <label htmlFor={`revision-importe-${item.id}`} className="text-xs font-medium">Importe total manual (CLP)<span id={`ayuda-importe-${item.id}`} className="mt-0.5 block font-normal text-muted-foreground">Total que se cobrará por este producto</span></label>
                  <input key={cantidad} id={`revision-importe-${item.id}`} aria-describedby={`ayuda-importe-${item.id}`} name={`importe-${item.id}`} type="number" inputMode="numeric" required min="0" max="9007199254740991" step="1" className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm tabular-nums" />
                </div> : null}
              </div>;
            })}</div>
          </div>)}
        </section>)}
      </fieldset>
      <p className="text-sm font-medium">Confirmar registra explícitamente todos estos productos y cierra la preparación de los pedidos. Después deberás confirmar la carga física antes de salir a ruta.</p>
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap [&_button]:h-auto [&_button]:min-h-9 [&_button]:whitespace-normal"><Button type="button" variant="outline" disabled={pendiente || iniciada} onClick={() => setAbierto(false)}>Cancelar</Button><Button type="submit" disabled={pendiente}>{pendiente ? "Confirmando…" : iniciada ? "Reintentar confirmación" : "Confirmar todos los productos y cerrar preparación"}</Button></div>
    </form> : null}
    <p role="status" className="text-sm">{mensaje}</p>
  </section>;
}
