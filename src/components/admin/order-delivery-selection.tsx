"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cargarFechasEntregaPedido, confirmarPedidoAdministrativo } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { CONFIRMACION_ADMINISTRATIVA_HABILITADA, crearBorradorEntrega, type CrearPedidoAdministrativoParametros, type LineaPedidoBorrador, type PedidoPreciosBorrador } from "@/lib/admin/pedido-borrador";
import { PAYMENT_INTENT_LABELS, PAYMENT_INTENT_OPTIONS, formatearMetodosPagoPrevistos, type MetodoPagoPrevisto } from "@/lib/payment-intent";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import type { FechaEntregaDisponible } from "@/types/delivery";
import { cotizarDespacho } from "@/lib/delivery-pricing";
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
  const version = useRef(0);
  const { activo } = useOrderWizard();
  const enEntrega = activo === 3;
  const contextoPrecios = JSON.stringify(precios);
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
    totalFinal: linea.totalFinal, motivoAjuste: linea.motivoAjuste,
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
    const intervalo = window.setInterval(refrescar, 30_000);
    window.addEventListener("focus", refrescar);
    document.addEventListener("visibilitychange", refrescar);
    return () => {
      version.current += 1;
      window.clearInterval(intervalo);
      window.removeEventListener("focus", refrescar);
      document.removeEventListener("visibilitychange", refrescar);
    };
  }, [actualizar]);

  // El asistente cambia de paso sin modificar el hash. Revalidar aquí evita
  // deshabilitar el radio entre focus y click y conserva las preferencias.
  useEffect(() => {
    if (enEntrega) void actualizar();
  }, [actualizar, enEntrega, contextoPrecios]);

  // Una actualización en segundo plano conserva el resumen mientras llega la
  // respuesta; solo un error o una fecha efectivamente inválida lo bloquean.
  const borrador = !error ? crearBorradorEntrega(precios, fecha, metodos, fechas) : null;
  useOrderStep(3, Boolean(borrador) && (!cargando || activo === 4), cargando ? "Espera a que se verifiquen las fechas disponibles." : error || (!precios ? "Completa los pasos anteriores con datos válidos." : !fecha || !fechas.some((item) => item.fecha === fecha) ? "Selecciona una fecha de entrega vigente." : "Selecciona al menos un método previsto de pago."));
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
    <section hidden={activo !== 3} id="entrega" aria-labelledby="entrega-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 tabIndex={-1} id="entrega-titulo" className="text-xl font-semibold">4. Fecha de entrega y métodos de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">Fechas habilitadas según la anticipación y el corte vigente en America/Santiago. Selecciona una fecha y al menos un método previsto de pago.</p>
      {!precios ? <p role="status" className="mt-3 text-sm">Completa las etapas anteriores con precios y motivos válidos.</p> : null}
      {cargando ? <p role="status" className="mt-3 text-sm">Verificando disponibilidad…</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
      {!cargando && !error && fecha && !fechas.some((item) => item.fecha === fecha) ? <p role="alert" className="mt-3 text-sm text-destructive">La fecha elegida ({formatFechaEntregaLarga(fecha)}) ya no está disponible según el corte, los días habilitados o el horizonte vigente. Se conserva como referencia; selecciona otra fecha para continuar.</p> : null}
      <button type="button" className="mt-3 text-sm underline" disabled={cargando} onClick={() => void actualizar()}>Actualizar fechas disponibles</button>
      <fieldset disabled={!fechas.length || Boolean(error)} className="mt-4 space-y-3">
        <legend className="font-medium">Fecha de entrega (obligatoria)</legend>
        {!cargando && !error && !fechas.length ? <p role="status" className="text-sm">No hay fechas disponibles en el horizonte de entrega vigente.</p> : null}
        {fechas.map((item) => <label key={item.fecha} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
          <input type="radio" name="fecha_entrega" required value={item.fecha} checked={fecha === item.fecha} onChange={() => setFecha(item.fecha)} />
          <span><span className="block font-medium">{item.etiquetaLarga}</span>{item.textoCorte}</span>
        </label>)}
        {!fecha ? <p className="text-sm text-muted-foreground">Debes seleccionar una fecha disponible.</p> : null}
      </fieldset>
      <fieldset className="mt-5 space-y-3">
        <legend className="font-medium">Métodos previstos de pago (al menos uno)</legend>
        {PAYMENT_INTENT_OPTIONS.map((metodo) => <label key={metodo} className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="metodos_pago_previstos" value={metodo} checked={metodos.includes(metodo)} onChange={(event) => { const marcado = event.target.checked; setMetodos((previos) => marcado ? [...previos, metodo] : previos.filter((item) => item !== metodo)); }} />
          {PAYMENT_INTENT_LABELS[metodo]}
        </label>)}
        {!metodos.length ? <p className="text-sm text-muted-foreground">Selecciona al menos un método.</p> : null}
      </fieldset>
      <p className="mt-4 text-sm text-muted-foreground">Estas preferencias no representan pagos realizados, no generan abonos ni modifican la cuenta corriente.</p>

    </section>
    <section hidden={activo !== 4} id="confirmacion" aria-labelledby="confirmacion-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
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
            <p>Cantidad: {linea.cantidad} · Total original: {formatCLP(linea.totalOriginal)} · Total final: {formatCLP(linea.totalFinal)}</p>
            {linea.motivoAjuste ? <p>Ajuste de total: {formatCLP(linea.totalOriginal)} → {formatCLP(linea.totalFinal)} ({formatCLP(linea.totalFinal - linea.totalOriginal)}). Motivo: {linea.motivoAjuste}</p> : null}
          </li>;
        })}</ul>
        <p className="font-semibold">Subtotal: {formatCLP(borrador.subtotal)}</p>
        <p>Despacho: {formatCLP(cotizarDespacho(borrador.subtotal).costoEntrega)}</p>
        <p className="font-semibold">Total: {formatCLP(cotizarDespacho(borrador.subtotal).totalEstimado)}</p>
      </div> : <p role="status" className="mt-4 text-sm">Completa las etapas anteriores, selecciona una fecha vigente y al menos un método previsto para ver el resumen.</p>}
      <p id="confirmacion-pendiente" className="mt-4 text-sm text-muted-foreground">Borrador conservado solo en esta página. La confirmación está deshabilitada hasta validar y aplicar la migración administrativa.</p>
      {enviando ? <p role="status" className="mt-3 text-sm">Confirmando pedido…</p> : null}
      {errorConfirmacion ? <p role="alert" className="mt-3 text-sm text-destructive">{errorConfirmacion}</p> : null}
      {destinoCreado ? <p role="status" className="mt-3 text-sm">Pedido creado. <a href={destinoCreado} className="underline">Ir al detalle del pedido</a></p> : null}
      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" disabled={!CONFIRMACION_ADMINISTRATIVA_HABILITADA || !borrador || enviando || Boolean(destinoCreado)} aria-busy={enviando} aria-describedby="confirmacion-pendiente" onClick={confirmar} className={buttonVariants()}>{enviando ? "Confirmando…" : "Confirmar pedido"}</button>
        <ActionLink href={ROUTES.adminOrders} variant="quiet">Volver a pedidos</ActionLink>
      </div>
    </section>
  </>;
}
