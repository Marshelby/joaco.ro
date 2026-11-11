"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarAvancePreparacion } from "@/app/(admin)/admin/rutas/preparacion-actions";
import { Button } from "@/components/ui/button";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import type { ItemPreparacionPedidoAdmin } from "@/lib/admin/pedidos";

export function PreparationCompactItemControl({ item, version, soloLectura = false, cantidadEnviada = 0 }: {
  item: ItemPreparacionPedidoAdmin; version: number; soloLectura?: boolean; cantidadEnviada?: number;
}) {
  const router = useRouter();
  const [cantidad, setCantidad] = useState(item.cantidadPreparada === null ? "" : String(item.cantidadPreparada));
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState<"avance" | null>(null);
  const [cantidadGuardada, setCantidadGuardada] = useState<number | null>(item.cantidadPreparada);
  const enviando = useRef(false);
  const solicitud = useRef<{ tipo: string; version: number; clave: string } | null>(null);
  const [clave, setClave] = useState("");
  const [pendiente, iniciar] = useTransition();
  const modo = resolverModoCantidadPreparacion(item);
  const paso = modo === "kg_fraccionable" ? 0.001 : 1;
  const valor = Number(cantidad);
  const cambios = cantidadGuardada === null ? cantidad !== "" : cantidad === "" || valor !== cantidadGuardada;
  const formato = (n: number) => formatearCantidadPreparacionEntrega(n, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);

  function editar(siguiente: string) {
    setCantidad(siguiente);
    setGuardado(null);
    setError("");
    setClave(crypto.randomUUID());
    solicitud.current = null;
  }

  return <li className="py-3 text-sm">
    <form data-preparacion-pendiente={!soloLectura && (cambios || pendiente) ? "true" : undefined} onSubmit={(evento) => {
      evento.preventDefault();
      const tipo = "avance";
      if (pendiente || enviando.current) return;
      if (tipo === "avance" && !cambios) return;
      const campo = evento.currentTarget.elements.namedItem("cantidadPreparada") as HTMLInputElement;
      if (!campo.reportValidity()) return;
      const datos = new FormData(evento.currentTarget);
      // Conservar clave y versión originales ante una respuesta perdida.
      if (!solicitud.current || solicitud.current.tipo !== tipo) {
        solicitud.current = { tipo, version, clave: clave || crypto.randomUUID() };
      }
      datos.set("version", String(solicitud.current.version));
      datos.set("clave", solicitud.current.clave);
      enviando.current = true;
      iniciar(async () => {
        try {
          const resultado = await guardarAvancePreparacion(datos);
          if (resultado.error) { setError(resultado.error); return; }
          setCantidadGuardada(valor);
          setGuardado("avance");
          setError("");
          solicitud.current = null;
          setClave(crypto.randomUUID());
          router.refresh();
        } catch {
          setError("No se pudo verificar el guardado. Reintenta para recuperar el resultado de la misma solicitud.");
        } finally {
          enviando.current = false;
        }
      });
    }} className="space-y-2">
      <input type="hidden" name="itemPedidoId" value={item.id} />
      <input type="hidden" name="version" value={version} />
      <input type="hidden" name="clave" value={clave} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="break-words font-medium">{item.nombreProducto}</p>
          {item.nombrePresentacion ? <p className="text-xs text-muted-foreground">{item.nombrePresentacion}</p> : null}
          <p className="text-xs text-muted-foreground">Solicitado: {formato(item.cantidad)} · Preparado: {item.cantidadPreparada === null ? "Sin preparar" : formato(item.cantidadPreparada)} · Enviado: {formato(cantidadEnviada)}</p>
        </div>
        <div className="space-y-1">
          <label htmlFor={`cargada-${item.id}`} className="block text-xs">Cantidad cargada</label>
          <div className="flex items-center gap-1">
            {!soloLectura ? <Button type="button" variant="outline" size="sm" aria-label={`Restar cantidad de ${item.nombreProducto}`} disabled={pendiente || !Number.isFinite(valor) || valor <= 0} onClick={() => editar(String(Math.max(0, Math.round((valor - paso) * 1000) / 1000)))}>−</Button> : null}
            <input id={`cargada-${item.id}`} name="cantidadPreparada" type="number" inputMode={modo === "kg_fraccionable" ? "decimal" : "numeric"} min="0" max="999999999.999" step={paso} required readOnly={soloLectura} disabled={pendiente} value={cantidad} onChange={(e) => editar(e.target.value)} className="h-9 w-24 rounded-md border border-input bg-background px-2 text-center" />
            {!soloLectura ? <Button type="button" variant="outline" size="sm" aria-label={`Sumar cantidad de ${item.nombreProducto}`} disabled={pendiente || !Number.isFinite(valor) || valor + paso > 999999999.999} onClick={() => editar(String(Math.round((valor + paso) * 1000) / 1000))}>+</Button> : null}
          </div>
          {!soloLectura && cambios ? <div className="flex items-center gap-1"><Button type="button" size="sm" variant="outline" disabled={pendiente} onClick={() => editar(cantidadGuardada === null ? "" : String(cantidadGuardada))}>Cancelar</Button><Button type="submit" size="sm" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar"}</Button></div> : null}
          <p className="text-xs text-muted-foreground">{cantidad !== "" && Number.isFinite(valor) ? formato(valor) : "Ingresa una cantidad"}</p>
        </div>
      </div>
      <div className="flex items-center gap-2"><progress className="h-2 min-w-0 flex-1 accent-primary" aria-label={`Progreso de ${item.nombreProducto}`} max={100} value={Math.min(100, Math.max(0, Number.isFinite(valor) && item.cantidad > 0 ? valor / item.cantidad * 100 : 0))} /><span className="text-xs">{Number.isFinite(valor) ? valor : 0} / {item.cantidad} · {Math.round(Math.min(100, Math.max(0, Number.isFinite(valor) && item.cantidad > 0 ? valor / item.cantidad * 100 : 0)))}%</span></div>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{error || (guardado ? `Cantidad guardada: ${formato(valor)}` : item.cantidadPreparada !== null ? `Cantidad guardada: ${formato(item.cantidadPreparada)}` : "Sin preparar: registra y guarda la cantidad cargada, incluso cero")}</p>
    </form>
  </li>;
}
