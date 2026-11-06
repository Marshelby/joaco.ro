"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cargarFechasEntregaPedido, confirmarPedidoAdministrativo } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { CONFIRMACION_ADMINISTRATIVA_HABILITADA, crearBorradorEntrega, type CrearPedidoAdministrativoParametros, type LineaPedidoBorrador, type PedidoPreciosBorrador } from "@/lib/admin/pedido-borrador";
import { PAYMENT_INTENT_LABELS, PAYMENT_INTENT_OPTIONS, formatearMetodosPagoPrevistos, type MetodoPagoPrevisto } from "@/lib/payment-intent";
import type { FechaEntregaDisponible } from "@/types/delivery";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

export function OrderDeliverySelection({ precios, lineas, clienteNombre, ubicacionResumen }: {
  precios: PedidoPreciosBorrador | null;
  lineas: LineaPedidoBorrador[];
  clienteNombre?: string;
  ubicacionResumen?: string;
}) {
  const [fechas, setFechas] = useState<FechaEntregaDisponible[]>([]);
  const [fecha, setFecha] = useState("");
  const [metodos, setMetodos] = useState<MetodoPagoPrevisto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const version = useRef(0);
  const seleccion = useRef("");
  const router = useRouter();
  const [enviando, iniciarEnvio] = useTransition();
  const bloqueoEnvio = useRef(false);
  const intentoConfirmacion = useRef<CrearPedidoAdministrativoParametros | null>(null);
  const [errorConfirmacion, setErrorConfirmacion] = useState("");
  const [destinoCreado, setDestinoCreado] = useState("");
  // No depende de la disponibilidad temporal de fechas ni de las peticiones
  // de lectura: un error de red no debe renovar la clave de un mismo borrador.
  const contenido = JSON.stringify({ precios, fecha, metodos, lineas: lineas.map((linea) => ({
    productoId: linea.presentacion.productoId, presentacionId: linea.presentacion.presentacionId,
    cantidad: linea.cantidad, precioReferencia: linea.precioReferencia,
    precioAplicado: linea.precioAplicado, motivoAjuste: linea.motivoAjuste,
  })) });
  useEffect(() => {
    intentoConfirmacion.current = null;
    setErrorConfirmacion("");
  }, [contenido]);

  const actualizar = useCallback(async () => {
    const solicitud = ++version.current;
    setCargando(true);
    try {
      const disponibles = await cargarFechasEntregaPedido();
      if (solicitud !== version.current) return false;
      setFechas(disponibles);
      setError("");
      if (seleccion.current && !disponibles.some((item) => item.fecha === seleccion.current)) {
        seleccion.current = "";
        setFecha("");
        setAviso("La fecha seleccionada dejó de estar disponible por el horario o la configuración vigente. Selecciona otra fecha.");
      }
      return true;
    } catch {
      if (solicitud === version.current) {
        setFechas([]);
        setError("No fue posible verificar las fechas. Reintenta para continuar; tus preferencias se conservan pendientes de validación.");
      }
      return false;
    } finally {
      if (solicitud === version.current) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void actualizar();
    const refrescar = () => { if (document.visibilityState === "visible") void actualizar(); };
    const alNavegar = () => {
      if (["#entrega", "#confirmacion"].includes(window.location.hash)) void actualizar();
    };
    const intervalo = window.setInterval(refrescar, 30_000);
    window.addEventListener("focus", refrescar);
    window.addEventListener("hashchange", alNavegar);
    document.addEventListener("visibilitychange", refrescar);
    const seccion = document.getElementById("entrega");
    const alEntrar = (event: FocusEvent) => {
      if (!seccion?.contains(event.relatedTarget as Node | null)) refrescar();
    };
    seccion?.addEventListener("focusin", alEntrar);
    return () => {
      version.current += 1;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", refrescar);
      window.removeEventListener("hashchange", alNavegar);
      document.removeEventListener("visibilitychange", refrescar);
      seccion?.removeEventListener("focusin", alEntrar);
    };
  }, [actualizar]);

  const borrador = !cargando && !error ? crearBorradorEntrega(precios, fecha, metodos, fechas) : null;
  const elegida = fechas.find((item) => item.fecha === fecha);

  function confirmar() {
    if (!CONFIRMACION_ADMINISTRATIVA_HABILITADA || !borrador || bloqueoEnvio.current || destinoCreado) return;
    // El ref bloquea incluso dos clics anteriores al siguiente render.
    bloqueoEnvio.current = true;
    setErrorConfirmacion("");
    iniciarEnvio(async () => {
      try {
        if (!intentoConfirmacion.current) {
          intentoConfirmacion.current = {
            p_clave_idempotencia: crypto.randomUUID(),
            p_pedido: borrador,
          };
        }
        const respuesta = await confirmarPedidoAdministrativo(intentoConfirmacion.current);
        if (!respuesta.ok) {
          setErrorConfirmacion(respuesta.mensaje);
          return;
        }
        setDestinoCreado(respuesta.destino);
        router.push(respuesta.destino);
      } catch {
        setErrorConfirmacion("No se pudo completar la comunicación. Tu borrador se conserva; reintenta sin modificarlo para recuperar el mismo pedido si ya se creó.");
      } finally {
        bloqueoEnvio.current = false;
      }
    });
  }

  return <>
    <section id="entrega" aria-labelledby="entrega-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 tabIndex={-1} id="entrega-titulo" className="text-xl font-semibold">4. Fecha de entrega y métodos de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Fechas habilitadas según la anticipación y el corte vigente en America/Santiago. Selecciona una fecha y al menos un método previsto de pago.</p>
      {!precios ? <p role="status" className="mt-3 text-sm">Completa las etapas anteriores con precios y motivos válidos.</p> : null}
      {cargando ? <p role="status" className="mt-3 text-sm">Verificando disponibilidad…</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      {aviso ? <p role="alert" className="mt-3 text-sm text-destructive">{aviso}</p> : null}
      <button type="button" className="mt-3 text-sm underline" disabled={cargando} onClick={() => void actualizar()}>Actualizar fechas disponibles</button>
      <fieldset disabled={!precios || cargando || Boolean(error)} className="mt-4 space-y-3">
        <legend className="font-medium">Fecha de entrega (obligatoria)</legend>
        {!cargando && !error && !fechas.length ? <p role="status" className="text-sm">No hay fechas disponibles en el horizonte de entrega vigente.</p> : null}
        {fechas.map((item) => <label key={item.fecha} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input type="radio" name="fecha_entrega" required value={item.fecha} checked={fecha === item.fecha} onChange={() => { seleccion.current = item.fecha; setFecha(item.fecha); setAviso(""); }} />
          <span><span className="block font-medium">{item.etiquetaLarga}</span>{item.textoCorte}</span>
        </label>)}
        {!fecha ? <p className="text-sm text-muted-foreground">Debes seleccionar una fecha disponible.</p> : null}
      </fieldset>
      <fieldset disabled={!precios} className="mt-5 space-y-3">
        <legend className="font-medium">Métodos previstos de pago (al menos uno)</legend>
        {PAYMENT_INTENT_OPTIONS.map((metodo) => <label key={metodo} className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="metodos_pago_previstos" value={metodo} checked={metodos.includes(metodo)} onChange={(event) => { const marcado = event.target.checked; setMetodos((previos) => marcado ? [...previos, metodo] : previos.filter((item) => item !== metodo)); }} />
          {PAYMENT_INTENT_LABELS[metodo]}
        </label>)}
        {!metodos.length ? <p className="text-sm text-muted-foreground">Selecciona al menos un método.</p> : null}
      </fieldset>
      <p className="mt-4 text-sm text-muted-foreground">Estas preferencias no representan pagos realizados, no generan abonos ni modifican la cuenta corriente.</p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => document.getElementById("precios-titulo")?.focus()}>Volver a precios</button>
        <button type="button" className={buttonVariants()} disabled={!borrador} onClick={async () => { if (await actualizar()) document.getElementById("confirmacion-titulo")?.focus(); }}>Ver resumen preliminar</button>
      </div>
    </section>
    <section id="confirmacion" aria-labelledby="confirmacion-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 tabIndex={-1} id="confirmacion-titulo" className="text-xl font-semibold">5. Resumen preliminar</h2>
      {borrador ? <div className="mt-4 space-y-3 text-sm">
        <p><strong>Cliente:</strong> {clienteNombre}</p>
        <p><strong>Ubicación comercial:</strong> {ubicacionResumen}</p>
        <p><strong>Entrega:</strong> {elegida?.etiquetaLarga}</p>
        <p><strong>Métodos previstos:</strong> {formatearMetodosPagoPrevistos(borrador.metodosPagoPrevistos)}</p>
        <ul className="space-y-3">{borrador.lineas.map((linea) => {
          const item = lineas.find((actual) => actual.presentacion.presentacionId === linea.presentacionId)?.presentacion;
          return <li key={linea.presentacionId} className="rounded-lg border border-border p-3">
            <p className="font-medium">{item?.nombre} · {item?.presentacionNombre} · {item?.cantidadPresentacion} {item?.unidad}</p>
            <p>{linea.cantidad} × {formatCLP(linea.precioAplicado)} = {formatCLP(linea.total)}</p>
            {linea.motivoAjuste ? <p>Ajuste unitario: {formatCLP(linea.precioReferencia)} → {formatCLP(linea.precioAplicado)} ({formatCLP(linea.precioAplicado - linea.precioReferencia)}). Motivo: {linea.motivoAjuste}</p> : null}
          </li>;
        })}</ul>
        <p className="font-semibold">Subtotal: {formatCLP(borrador.subtotal)}</p>
      </div> : <p role="status" className="mt-4 text-sm">Completa las etapas anteriores, selecciona una fecha vigente y al menos un método previsto para ver el resumen.</p>}
      <p id="confirmacion-pendiente" className="mt-4 text-sm text-muted-foreground">Borrador conservado solo en esta página. La confirmación está deshabilitada hasta validar y aplicar la migración administrativa.</p>
      {enviando ? <p role="status" className="mt-3 text-sm">Confirmando pedido…</p> : null}
      {errorConfirmacion ? <p role="alert" className="mt-3 text-sm text-destructive">{errorConfirmacion}</p> : null}
      {destinoCreado ? <p role="status" className="mt-3 text-sm">Pedido creado. <a href={destinoCreado} className="underline">Ir al detalle del pedido</a></p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className={buttonVariants({ variant: "secondary" })} onClick={() => document.getElementById("entrega-titulo")?.focus()}>Volver a entrega y pago</button>
        <button type="button" disabled={!CONFIRMACION_ADMINISTRATIVA_HABILITADA || !borrador || enviando || Boolean(destinoCreado)} aria-busy={enviando} aria-describedby="confirmacion-pendiente" onClick={confirmar} className={buttonVariants()}>{enviando ? "Confirmando…" : "Confirmar pedido"}</button>
        <ActionLink href={ROUTES.adminOrders} variant="quiet">Volver a pedidos</ActionLink>
      </div>
    </section>
  </>;
}
