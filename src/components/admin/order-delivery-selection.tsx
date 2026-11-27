"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { CalendarDays, Check, CreditCard, MapPin, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { cargarFechasEntregaPedido, confirmarPedidoAdministrativo, confirmarPedidoRecibido, type cargarPedidoParaAceptar, type EdicionPedidoRecibido } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { CONFIRMACION_ADMINISTRATIVA_HABILITADA, IMPORTE_MAXIMO_PEDIDO, crearBorradorEntrega, type CrearPedidoAdministrativoParametros, type LineaPedidoBorrador, type PedidoBorrador, type PedidoPreciosBorrador, type PresentacionPedido } from "@/lib/admin/pedido-borrador";
import { PAYMENT_INTENT_LABELS, PAYMENT_INTENT_OPTIONS, formatearMetodosPagoPrevistos, normalizarMetodosPagoPrevistos, type MetodoPagoPrevisto } from "@/lib/payment-intent";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import type { FechaEntregaDisponible } from "@/types/delivery";
import { cotizarDespacho } from "@/lib/delivery-pricing";
import { isFractionalKgItem } from "@/lib/cart-quantity";
import { CatalogImage } from "@/components/media/catalog-image";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

type Aceptacion = Awaited<ReturnType<typeof cargarPedidoParaAceptar>>["entrega"];

export function OrderDeliverySelection({ precios, lineas, catalogo, clienteNombre, ubicacionResumen, aceptacion, modificado, edicion, despachoEditado = 0, resumenLineas, fechaInicial }: {
  fechaInicial?: string;
  aceptacion?: Aceptacion;
  modificado?: boolean;
  edicion?: Omit<EdicionPedidoRecibido, "fechaEntrega" | "metodosPagoPrevistos" | "costoEntrega" | "total"> | null;
  despachoEditado?: number;
  resumenLineas?: Pick<Aceptacion["lineas"][number], "id" | "presentacion" | "cantidad" | "totalOriginal" | "totalFinal" | "motivoAjuste" | "fraccionable">[];
  precios: PedidoPreciosBorrador | null;
  lineas: LineaPedidoBorrador[];
  catalogo: PresentacionPedido[];
  clienteNombre?: string;
  ubicacionResumen?: string;
}) {
  const [fechas, setFechas] = useState<FechaEntregaDisponible[]>([]);
  const [fecha, setFecha] = useState(aceptacion?.fechaEntrega ?? fechaInicial ?? "");
  const [editandoFecha, setEditandoFecha] = useState(!(aceptacion?.fechaEntrega ?? fechaInicial));
  const pagosTitulo = useRef<HTMLLegendElement>(null);
  const opcionesFecha = useRef<HTMLFieldSetElement>(null);
  const desplazarAPagos = useRef(false);
  const [metodos, setMetodos] = useState<MetodoPagoPrevisto[]>(aceptacion?.metodosPagoPrevistos ?? []);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const version = useRef(0);
  const { activo, pasosValidos, bloqueado, bloquear, completar, conservarOriginal } = useOrderWizard();
  const enEntrega = activo === 3;
  const contextoPrecios = JSON.stringify(precios);
  const consultarFechas = !aceptacion || activo === 3 || (activo === 4 && Boolean(modificado || fecha !== aceptacion.fechaEntrega));
  const router = useRouter();
  const [enviando, iniciarEnvio] = useTransition();
  const bloqueoEnvio = useRef(false);
  const intentoConfirmacion = useRef<CrearPedidoAdministrativoParametros | null>(null);
  const [errorConfirmacion, setErrorConfirmacion] = useState("");
  const [destinoCreado, setDestinoCreado] = useState("");
  const contenidoIntento = useRef("");
  const [pedidoEnviado, setPedidoEnviado] = useState<PedidoBorrador | null>(null);
  const [edicionEnviada, setEdicionEnviada] = useState<EdicionPedidoRecibido | null>(null);

  const mismosMetodos = aceptacion && metodos.length === aceptacion.metodosPagoPrevistos.length
    && metodos.every((metodo) => aceptacion.metodosPagoPrevistos.includes(metodo));
  const mismaFecha = aceptacion && fecha === aceptacion.fechaEntrega;
  const original = aceptacion && !modificado && mismaFecha && mismosMetodos ? aceptacion : null;
  useEffect(() => {
    if (aceptacion) conservarOriginal(Boolean(original));
  }, [aceptacion, original, conservarOriginal]);

  const fechasSeleccionables = useMemo(() => {
    const fechaOriginal = aceptacion?.fechaEntrega;
    if (!fechaOriginal || fechas.some((item) => item.fecha === fechaOriginal)) return fechas;
    const etiqueta = formatFechaEntregaLarga(fechaOriginal);
    return [{ fecha: fechaOriginal, etiqueta, etiquetaLarga: etiqueta, textoCorte: "Fecha del pedido recibido." }, ...fechas];
  }, [aceptacion, fechas]);

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
    if (!consultarFechas) return;
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
  }, [actualizar, consultarFechas]);

  // El asistente cambia de paso sin modificar el hash. Revalidar aquí evita
  // deshabilitar el radio entre focus y click y conserva las preferencias.
  useEffect(() => {
    if (enEntrega && !aceptacion) void actualizar();
  }, [actualizar, enEntrega, contextoPrecios, aceptacion]);

  // Una actualización en segundo plano conserva el resumen mientras llega la
  // respuesta; solo un error o una fecha efectivamente inválida lo bloquean.
  const borrador = !error ? crearBorradorEntrega(precios, fecha, metodos, fechasSeleccionables) : null;
  const metodosEditados = aceptacion && mismosMetodos ? aceptacion.metodosPagoPrevistos : normalizarMetodosPagoPrevistos(metodos);
  const edicionValida = edicion && aceptacion && metodosEditados
    && (mismaFecha || (!error && fechas.some((item) => item.fecha === fecha)))
    ? { ...edicion, fechaEntrega: fecha || null, metodosPagoPrevistos: metodosEditados,
      costoEntrega: despachoEditado, total: edicion.subtotal + despachoEditado - aceptacion.descuento }
    : null;
  useOrderStep(3, aceptacion ? Boolean(edicionValida) : Boolean(borrador) && (!cargando || activo === 4), cargando ? "Espera a que se verifiquen las fechas disponibles." : error || (!(precios || edicion) ? "Completa los pasos anteriores con datos válidos." : !fecha || !fechasSeleccionables.some((item) => item.fecha === fecha) ? "Selecciona una fecha de entrega vigente." : "Selecciona al menos un método previsto de pago."));
  // Si una lectura posterior invalida la fecha, seguir mostrando lo enviado.
  const resumen = bloqueado ? pedidoEnviado ?? borrador : borrador;
  const elegida = fechasSeleccionables.find((item) => item.fecha === resumen?.fechaEntrega);

  const fechaSeleccionada = fechasSeleccionables.find((item) => item.fecha === fecha);
  const mostrarFechas = editandoFecha || !fechaSeleccionada || Boolean(error);

  // Solo una elección explícita mueve el foco; las revalidaciones y los
  // cambios de paso conservan la posición y las preferencias del borrador.
  useEffect(() => {
    if (!desplazarAPagos.current || mostrarFechas || !enEntrega) return;
    desplazarAPagos.current = false;
    const cuadro = window.requestAnimationFrame(() => {
      const titulo = pagosTitulo.current;
      if (!titulo) return;
      titulo.focus({ preventScroll: true });
      const posicion = titulo.getBoundingClientRect();
      if (posicion.top < 16 || posicion.bottom > window.innerHeight - 16) {
        titulo.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "nearest",
        });
      }
    });
    return () => window.cancelAnimationFrame(cuadro);
  }, [fecha, mostrarFechas, enEntrega]);

  function seleccionarFecha(valor: string) {
    if (error || !fechasSeleccionables.some((item) => item.fecha === valor)) return;
    desplazarAPagos.current = true;
    setFecha(valor);
    setEditandoFecha(false);
  }

  function confirmar() {
    if (aceptacion) {
      if (bloqueado || bloqueoEnvio.current || activo !== 4 || (!original && (!pasosValidos || !edicionValida || !importesValidos))) return;
      bloqueoEnvio.current = true;
      setErrorConfirmacion("");
      setEdicionEnviada(original ? null : edicionValida);
      bloquear(true);
      iniciarEnvio(async () => {
        try {
          const respuesta = await confirmarPedidoRecibido(aceptacion.pedidoId, aceptacion.version, original ? null : edicionValida);
          if (!respuesta.ok) {
            setErrorConfirmacion(respuesta.mensaje);
            bloquear(false);
            return;
          }
          completar(respuesta.destino);
          router.replace(respuesta.destino);
        } catch {
          setErrorConfirmacion("No se pudo completar la comunicación. Revisa el estado del pedido antes de reintentar.");
          bloquear(false);
        } finally {
          bloqueoEnvio.current = false;
        }
      });
      return;
    }
    if (!CONFIRMACION_ADMINISTRATIVA_HABILITADA || bloqueoEnvio.current || destinoCreado) return;
    // Un resultado incierto solo permite recuperar el documento original,
    // aunque la fecha haya vencido o falle una actualización de lectura.
    if (!bloqueado && (activo !== 4 || !pasosValidos || !borrador)) return;
    if (bloqueado && !intentoConfirmacion.current) return;
    // El ref bloquea incluso dos clics anteriores al siguiente render.
    bloqueoEnvio.current = true;
    bloquear(true);
    setErrorConfirmacion("");
    iniciarEnvio(async () => {
      try {
        const contenido = JSON.stringify(borrador);
        if (!bloqueado && contenidoIntento.current !== contenido) intentoConfirmacion.current = null;
        if (!intentoConfirmacion.current && borrador) {
          contenidoIntento.current = contenido;
          intentoConfirmacion.current = {
            p_clave_idempotencia: crypto.randomUUID(),
            p_pedido: borrador,
          };
          setPedidoEnviado(borrador);
        }
        const intento = intentoConfirmacion.current;
        if (!intento) throw new Error("INTENTO_REQUERIDO");
        const respuesta = await confirmarPedidoAdministrativo(intento);
        if (!respuesta.ok) {
          setErrorConfirmacion(respuesta.mensaje);
          if (respuesta.resultadoIncierto === false) bloquear(false);
          return;
        }
        setDestinoCreado(respuesta.destino);
        intentoConfirmacion.current = null;
        completar(respuesta.destino);
        router.replace(respuesta.destino);
      } catch {
        if (!intentoConfirmacion.current) bloquear(false);
        setErrorConfirmacion("No se pudo completar la comunicación. Tu borrador se conserva; reintenta sin modificarlo para recuperar el mismo pedido si ya se creó.");
      } finally {
        bloqueoEnvio.current = false;
      }
    });
  }

  const resumenEditado = (bloqueado && edicionEnviada) || edicionValida;
  const lineasResumen = original?.lineas ?? (aceptacion ? (resumenEditado ? resumenLineas : undefined) : resumen?.lineas.map((linea) => ({
    ...linea,
    id: linea.presentacionId,
    presentacion: lineas.find((actual) => actual.presentacion.presentacionId === linea.presentacionId)?.presentacion,
  })));
  const cotizacion = resumen ? cotizarDespacho(resumen.subtotal) : null;
  const subtotal = original?.subtotal ?? resumenEditado?.subtotal ?? resumen?.subtotal ?? 0;
  const descuento = aceptacion?.descuento ?? 0;
  const despacho = original?.costoEntrega ?? resumenEditado?.costoEntrega ?? cotizacion?.costoEntrega ?? 0;
  const total = original?.total ?? resumenEditado?.total ?? cotizacion?.totalEstimado ?? 0;
  const importesValidos = [subtotal, despacho, descuento, total].every((importe) => Number.isSafeInteger(importe)
    && importe >= 0 && importe <= IMPORTE_MAXIMO_PEDIDO);
  const fechaResumen = original?.fechaEntrega ?? resumenEditado?.fechaEntrega ?? resumen?.fechaEntrega;
  const entregaResumen = fechaResumen ? elegida?.etiquetaLarga ?? formatFechaEntregaLarga(fechaResumen) : "Sin fecha registrada";

  return <>
    <section hidden={activo !== 3} id="entrega" aria-labelledby="entrega-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 tabIndex={-1} id="entrega-titulo" className="text-xl font-semibold">4. Fecha de entrega y métodos de pago</h2>
      <p className="mt-2 text-sm text-muted-foreground">La entrega para el mismo día habilitado se puede solicitar únicamente antes de la hora límite indicada para la fecha, hora America/Santiago. {aceptacion ? "Puedes conservar la fecha y los métodos del pedido recibido." : "Selecciona una fecha y al menos un método previsto de pago."}</p>
      {!precios && !edicion ? <p role="status" className="mt-3 text-sm">Completa las etapas anteriores con precios y motivos válidos.</p> : null}
      {cargando ? <p role="status" className="mt-3 text-sm">Verificando disponibilidad…</p> : null}
      {error ? <p role="alert" className="mt-3 text-sm text-destructive">{mismaFecha ? "No se pudieron verificar fechas alternativas. Se conserva la fecha del pedido." : error}</p> : null}
      {!cargando && !error && fecha && !fechasSeleccionables.some((item) => item.fecha === fecha) ? <p role="alert" className="mt-3 text-sm text-destructive">La fecha elegida ({formatFechaEntregaLarga(fecha)}) ya no está disponible según el corte, los días habilitados o el horizonte vigente. Se conserva como referencia; selecciona otra fecha para continuar.</p> : null}
      {fechaSeleccionada && !mostrarFechas ? <div className="mt-4 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0 text-sm">
          <p className="text-muted-foreground">Fecha de entrega seleccionada</p>
          <p className="font-semibold">{fechaSeleccionada.etiquetaLarga}</p>
          <p className="text-muted-foreground">{fechaSeleccionada.textoCorte}</p>
        </div>
        <button type="button" aria-expanded={false} aria-controls="opciones-fecha-entrega" className={`${buttonVariants({ variant: "secondary" })} shrink-0 self-start sm:self-auto`} onClick={() => {
          setEditandoFecha(true);
          window.requestAnimationFrame(() => {
            opcionesFecha.current?.querySelector<HTMLInputElement>("input:checked")?.focus({ preventScroll: true });
          });
        }}>Cambiar fecha</button>
      </div> : null}
      <div id="opciones-fecha-entrega" hidden={!mostrarFechas}>
        <button type="button" className="mt-3 text-sm underline" disabled={cargando} onClick={() => void actualizar()}>Actualizar fechas disponibles</button>
        <fieldset ref={opcionesFecha} disabled={!fechasSeleccionables.length || Boolean(error)} className="mt-4 space-y-3">
          <legend className="font-medium">Fecha de entrega (obligatoria)</legend>
          {fechaSeleccionada ? <p className="text-sm text-muted-foreground">Tu fecha actual es {fechaSeleccionada.etiquetaLarga}. Se conserva hasta que elijas otra.</p> : null}
          {!cargando && !error && !fechasSeleccionables.length ? <p role="status" className="text-sm">No hay fechas disponibles en el horizonte de entrega vigente.</p> : null}
          {fechasSeleccionables.map((item) => <label key={item.fecha} className={`flex items-start gap-3 rounded-lg border p-3 text-sm ${fecha === item.fecha ? "border-primary/30 bg-primary/5" : "border-border"}`}>
            <input type="radio" name="fecha_entrega" required value={item.fecha} checked={fecha === item.fecha} onChange={() => seleccionarFecha(item.fecha)} onClick={() => { if (fecha === item.fecha) seleccionarFecha(item.fecha); }} />
            <span><span className="block font-medium">{item.etiquetaLarga}</span>{item.textoCorte}</span>
          </label>)}
          {!fecha ? <p className="text-sm text-muted-foreground">Debes seleccionar una fecha disponible.</p> : null}
          {fechaSeleccionada ? <button type="button" className="text-sm underline" onClick={() => seleccionarFecha(fecha)}>Mantener fecha seleccionada</button> : null}
        </fieldset>
      </div>
      <fieldset className="mt-5 space-y-3">
        <legend ref={pagosTitulo} tabIndex={-1} className="scroll-mt-6 font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">Métodos previstos de pago{aceptacion ? "" : " (al menos uno)"}</legend>
        {PAYMENT_INTENT_OPTIONS.map((metodo) => <label key={metodo} className="flex items-center gap-3 text-sm">
          <input type="checkbox" name="metodos_pago_previstos" value={metodo} checked={metodos.includes(metodo)} onChange={(event) => { const marcado = event.target.checked; setMetodos((previos) => marcado ? [...previos, metodo] : previos.filter((item) => item !== metodo)); }} />
          {PAYMENT_INTENT_LABELS[metodo]}
        </label>)}
        {!metodos.length ? <p className="text-sm text-muted-foreground">{aceptacion && mismosMetodos ? "El pedido no tiene métodos previstos registrados." : "Selecciona al menos un método."}</p> : null}
      </fieldset>
      <p className="mt-4 text-sm text-muted-foreground">Estas preferencias no representan pagos realizados, no generan abonos ni modifican la cuenta corriente.</p>

    </section>
    <section hidden={activo !== 4} id="confirmacion" aria-labelledby="confirmacion-titulo" className="scroll-mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
      <h2 tabIndex={-1} id="confirmacion-titulo" className="text-xl font-semibold tracking-tight">5. Resumen preliminar</h2>
      {lineasResumen ? <div className="mt-4 space-y-5 text-sm">
        <dl className="grid gap-3 rounded-xl bg-muted/50 p-3 min-[480px]:grid-cols-2 sm:gap-4 sm:p-4 xl:grid-cols-4">
          {[
            { titulo: "Cliente", valor: original?.clienteNombre ?? clienteNombre, Icono: UserRound },
            { titulo: "Ubicación de entrega", valor: aceptacion ? (original?.ubicacionResumen ?? ubicacionResumen) || "Sin ubicación registrada" : ubicacionResumen, Icono: MapPin },
            { titulo: "Entrega", valor: entregaResumen, Icono: CalendarDays },
            { titulo: "Métodos previstos", valor: formatearMetodosPagoPrevistos(original?.metodosPagoPrevistos ?? resumenEditado?.metodosPagoPrevistos ?? resumen?.metodosPagoPrevistos) ?? "Sin métodos registrados", Icono: CreditCard },
          ].map(({ titulo, valor, Icono }) => (
            <div key={titulo} className="relative min-h-8 min-w-0 pl-[2.625rem]">
              <dt className="text-xs text-muted-foreground">
                <span className="absolute top-0 left-0 grid size-8 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
                  <Icono className="size-4" />
                </span>
                {titulo}
              </dt>
              <dd className="font-medium wrap-break-word">{valor}</dd>
            </div>
          ))}
        </dl>
        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_17rem]">
          <div>
            <h3 className="mb-2 font-semibold">Productos</h3>
            <ul className="divide-y divide-border rounded-xl border border-border">
              {lineasResumen.map((linea) => {
                const item = linea.presentacion;
                const vigente = catalogo.find((presentacion) => presentacion.productoId === item?.productoId
                  && presentacion.presentacionId === item?.presentacionId);
                const rutaImagen = vigente?.rutaImagen ?? item?.rutaImagen;
                const ajustada = linea.totalOriginal !== linea.totalFinal;
                const fraccionable = "fraccionable" in linea ? linea.fraccionable : Boolean(item && isFractionalKgItem(vigente ?? item));
                const unidad = fraccionable ? "kg" : linea.cantidad === 1 ? "presentación" : "presentaciones";
                const formato = item?.cantidadPresentacion ? `${item.cantidadPresentacion} ${item.unidad}` : item?.unidad;
                return <li key={linea.id} className="p-3 sm:p-4">
                  <div className="flex items-start gap-2.5 sm:gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted sm:size-14">
                      <CatalogImage image={rutaImagen ? { src: rutaImagen, alt: "", fit: "contain" } : undefined} fallback="package" sizes="(min-width: 640px) 56px, 40px" fallbackIconClassName="size-5 opacity-50 sm:size-6" />
                    </div>
                    <div className="min-w-0 flex-1 wrap-break-word">
                      <p className="font-semibold">{item?.nombre}</p>
                      <p className="text-xs leading-5 text-muted-foreground">{[item?.presentacionNombre, formato].filter(Boolean).join(" · ")}</p>
                      <p className="mt-0.5 text-xs font-medium">Cantidad: {linea.cantidad} {unidad}</p>
                    </div>
                    <div className="shrink-0 text-right tabular-nums">
                      <p className="text-xs text-muted-foreground">Total final</p>
                      <p className="font-semibold text-primary sm:text-base">{formatCLP(linea.totalFinal)}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="block">Total original</span>
                        <span className={ajustada ? "line-through" : undefined}>{formatCLP(linea.totalOriginal)}</span>
                      </p>
                    </div>
                  </div>
                  {linea.motivoAjuste ? <p className="mt-2 rounded-md bg-muted/60 px-2.5 py-2 text-xs leading-5 wrap-break-word text-muted-foreground">
                    <span className="font-medium text-foreground">Ajuste de total:</span> {formatCLP(linea.totalOriginal)} → {formatCLP(linea.totalFinal)} ({formatCLP(linea.totalFinal - linea.totalOriginal)}). Motivo: {linea.motivoAjuste}
                  </p> : null}
                </li>;
              })}
            </ul>
          </div>
          <div>
            <h3 className="mb-2 font-semibold">Resumen económico</h3>
            <dl className="space-y-2 rounded-xl border border-primary/15 bg-primary/5 p-4 tabular-nums">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Subtotal</dt><dd className="font-medium">{formatCLP(subtotal)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Despacho</dt><dd className="font-medium">{formatCLP(despacho)}</dd></div>
              {descuento > 0 ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Descuento</dt><dd className="font-medium">{formatCLP(descuento)}</dd></div> : null}
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-t border-primary/20 pt-3 text-primary">
                <dt className="font-semibold">Total final</dt>
                <dd className="ml-auto text-2xl font-bold tracking-tight">{formatCLP(total)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div> : <p role="status" className="mt-4 text-sm">Completa las etapas anteriores, selecciona una fecha vigente y al menos un método previsto para ver el resumen.</p>}
      <p id="confirmacion-pendiente" className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">{aceptacion && bloqueado ? "Guardando la confirmación del pedido." : bloqueado ? "Conservamos el intento original. Reintenta para recuperar su resultado antes de editar o iniciar otro pedido." : "Revisa el resumen antes de confirmar. El pedido se guardará con estos totales; los métodos previstos no registran pagos."}</p>
      {enviando ? <p role="status" className="mt-3 text-sm">Confirmando pedido…</p> : null}
      {edicionValida && !importesValidos ? <p role="alert" className="mt-3 text-sm text-destructive">Revisa los importes. El total debe estar dentro del rango admitido y el descuento no puede superar el subtotal más despacho.</p> : null}
      {errorConfirmacion ? <p role="alert" className="mt-3 text-sm text-destructive">{errorConfirmacion}</p> : null}
      {destinoCreado ? <p role="status" className="mt-3 text-sm">Pedido creado. <a href={destinoCreado} className="underline">Ir al detalle del pedido</a></p> : null}
      <div className="mt-4 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
        <button type="button" disabled={aceptacion ? bloqueado || (!original && (!edicionValida || !importesValidos || !pasosValidos || activo !== 4)) : !CONFIRMACION_ADMINISTRATIVA_HABILITADA || (!bloqueado && (!borrador || !pasosValidos || activo !== 4)) || enviando || Boolean(destinoCreado)} aria-busy={enviando} aria-describedby="confirmacion-pendiente" onClick={confirmar} className={buttonVariants({ size: "lg", className: "w-full font-semibold enabled:shadow-sm enabled:hover:shadow-md motion-safe:transition-[background-color,border-color,color,opacity,transform,box-shadow] motion-safe:duration-200 motion-reduce:transition-none sm:w-auto" })}><Check aria-hidden="true" />{enviando ? "Confirmando…" : bloqueado ? "Reintentar confirmación" : "Confirmar pedido"}</button>
        {!bloqueado ? <ActionLink href={ROUTES.adminOrders} variant="quiet">Volver a pedidos</ActionLink> : null}
      </div>
    </section>
  </>;
}
