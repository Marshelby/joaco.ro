"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { guardarPreparacionItemPedido } from "@/app/(admin)/admin/pedidos/actions";
import { guardarAvancePreparacion } from "@/app/(admin)/admin/rutas/preparacion-actions";
import { Button } from "@/components/ui/button";
import { formatearCantidadPreparacionEntrega } from "@/lib/delivery-preparation-quantity";
import { resolverModoCantidadPreparacion } from "@/lib/order-preparation";
import { formatCLP } from "@/lib/formatters";
import type { ItemPreparacionPedidoAdmin } from "@/lib/admin/pedidos";

export function PreparationCompactItemControl({ item, version, soloLectura = false }: {
  item: ItemPreparacionPedidoAdmin; version: number; soloLectura?: boolean;
}) {
  const router = useRouter();
  const [cantidad, setCantidad] = useState(String(item.cantidadPreparada ?? 0));
  const [importe, setImporte] = useState("");
  const [definitiva, setDefinitiva] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState<"avance" | "definitivo" | null>(null);
  const [cantidadGuardada, setCantidadGuardada] = useState(item.cantidadPreparada ?? 0);
  const enviando = useRef(false);
  const solicitud = useRef<{ tipo: string; version: number; clave: string } | null>(null);
  const [clave, setClave] = useState("");
  const [pendiente, iniciar] = useTransition();
  const modo = resolverModoCantidadPreparacion(item);
  const paso = modo === "kg_fraccionable" ? 0.001 : 1;
  const valor = Number(cantidad);
  const cambios = cantidad !== "" && valor !== cantidadGuardada;
  const distinto = cantidad !== "" && valor !== item.cantidad;
  const formato = (n: number) => formatearCantidadPreparacionEntrega(n, item.nombrePresentacion, item.unidad, item.modoCantidadSnapshot);

  function editar(siguiente: string) {
    setCantidad(siguiente);
    setImporte("");
    setDefinitiva(false);
    setGuardado(null);
    setError("");
    setClave(crypto.randomUUID());
    solicitud.current = null;
  }

  return <li className="py-3 text-sm">
    <form onSubmit={(evento) => {
      evento.preventDefault();
      const tipo = (evento.nativeEvent as SubmitEvent).submitter?.getAttribute("value") ?? "definitivo";
      if (pendiente || enviando.current || (tipo !== "avance" && !definitiva)) return;
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
          const resultado = tipo === "avance"
            ? await guardarAvancePreparacion(datos)
            : await guardarPreparacionItemPedido({}, datos);
          if (resultado.error) { setError(resultado.error); return; }
          setCantidadGuardada(valor);
          setGuardado(tipo === "avance" ? "avance" : "definitivo");
          setDefinitiva(false);
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
          <p className="text-xs text-muted-foreground">Solicitado: {formato(item.cantidad)}</p>
        </div>
        <div className="space-y-1">
          <label htmlFor={`cargada-${item.id}`} className="block text-xs">Cantidad cargada</label>
          <div className="flex items-center gap-1">
            {!soloLectura ? <Button type="button" variant="outline" size="sm" aria-label={`Restar cantidad de ${item.nombreProducto}`} disabled={pendiente || !Number.isFinite(valor) || valor <= 0} onClick={() => editar(String(Math.max(0, Math.round((valor - paso) * 1000) / 1000)))}>−</Button> : null}
            <input id={`cargada-${item.id}`} name="cantidadPreparada" type="number" inputMode={modo === "kg_fraccionable" ? "decimal" : "numeric"} min="0" max="999999999.999" step={paso} required readOnly={soloLectura} disabled={pendiente} value={cantidad} onChange={(e) => editar(e.target.value)} className="h-9 w-24 rounded-md border border-input bg-background px-2 text-center" />
            {!soloLectura ? <Button type="button" variant="outline" size="sm" aria-label={`Sumar cantidad de ${item.nombreProducto}`} disabled={pendiente || !Number.isFinite(valor) || valor + paso > 999999999.999} onClick={() => editar(String(Math.round((valor + paso) * 1000) / 1000))}>+</Button> : null}
          </div>
          <p className="text-xs text-muted-foreground">{cantidad !== "" && Number.isFinite(valor) ? formato(valor) : "Ingresa una cantidad"}</p>
        </div>
      </div>
      {!soloLectura ? <>
        {cambios ? <Button type="submit" name="accion" value="avance" formNoValidate size="sm" variant="outline" disabled={pendiente}>{pendiente ? "Guardando…" : "Guardar avance"}</Button> : null}
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={definitiva} disabled={pendiente} onChange={(e) => { setDefinitiva(e.target.checked); setGuardado(null); setClave(crypto.randomUUID()); solicitud.current = null; }} />Confirmar esta cantidad como definitiva (marca el producto LISTO)</label>
        {definitiva && distinto ? <label className="block text-xs">Importe total definitivo de esta línea (CLP)
          <input name="importe" type="number" inputMode="numeric" min="0" max="9007199254740991" step="1" required disabled={pendiente} value={importe} onChange={(e) => { setImporte(e.target.value); setClave(crypto.randomUUID()); solicitud.current = null; }} className="ml-2 h-9 w-32 rounded-md border border-input bg-background px-2" />
          <span className="mt-1 block text-muted-foreground">Ingreso manual obligatorio, también con cantidad cero. Sin prorrateo automático.</span>
        </label> : definitiva ? <p className="text-xs text-muted-foreground">Se conserva el importe original: {formatCLP(item.importeOriginal)}.</p> : null}
        {definitiva ? <Button type="submit" name="accion" value="definitivo" size="sm" disabled={pendiente}>{pendiente ? "Guardando…" : "Listo"}</Button> : null}
      </> : null}
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{error || (guardado ? (guardado === "avance" ? "Avance guardado. Pendiente de confirmación final." : "Cantidad definitiva guardada.") : item.confirmadoExplicito ? `LISTO · Guardado: ${formato(item.cantidadPreparada ?? 0)}` : item.cantidadPreparada !== null ? `Avance guardado: ${formato(item.cantidadPreparada)} · Pendiente de confirmación final` : "Pendiente de confirmación final")}</p>
    </form>
  </li>;
}
