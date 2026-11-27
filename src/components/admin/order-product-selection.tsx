"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { OrderQuantityInput } from "@/components/admin/order-quantity-input";
import { OrderDeliverySelection } from "@/components/admin/order-delivery-selection";
import { Trash2 } from "lucide-react";
import { CatalogImage } from "@/components/media/catalog-image";
import { useEffect, useRef, useState } from "react";
import { cargarCatalogoPedido, type cargarPedidoParaAceptar, type EdicionPedidoRecibido } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { adjustCartQuantity, formatCartQuantity, getCartQuantityInputStep, getCartQuantityMaximum, getCartQuantityMinimum, isFractionalKgItem, isValidCartQuantity } from "@/lib/cart-quantity";
import { cotizarDespacho } from "@/lib/delivery-pricing";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";

import { IMPORTE_MAXIMO_PEDIDO, crearBorradorPrecios, leerAjusteTotalLinea, leerPrecioPedido, totalLineaPedido, type LineaPedidoBorrador } from "@/lib/admin/pedido-borrador";
type Presentacion = Awaited<ReturnType<typeof cargarCatalogoPedido>>[number];
type Linea = LineaPedidoBorrador & { totalManual: boolean };
const campo = "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const campoPrecio = "mt-1 min-h-9 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm";
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");

function MiniaturaProducto({ ruta }: { ruta?: string }) {
  return <div className="relative size-10 shrink-0 overflow-hidden rounded-md border border-border bg-background">
    <CatalogImage image={ruta ? { src: ruta, alt: "", fit: "contain" } : undefined}
      fallback="package" sizes="40px" fallbackIconClassName="size-5 opacity-50 sm:size-5" />
  </div>;
}

type Aceptacion = Awaited<ReturnType<typeof cargarPedidoParaAceptar>>;
type Precarga = Pick<Aceptacion, "inicial" | "ubicacionId" | "lineas"> & { catalogo: Presentacion[] | null };

export function OrderProductSelection({ clienteId, ubicacionId, clienteNombre, ubicacionResumen, inicial, aceptacion, ubicacionModificada, referenciasEntrega, ubicacionValida, fechaSolicitada }: {
  fechaSolicitada?: string;
  inicial?: Precarga | null;
  aceptacion?: Aceptacion;
  ubicacionModificada?: boolean;
  referenciasEntrega?: Pick<EdicionPedidoRecibido, "clienteId" | "ubicacionId">;
  ubicacionValida?: boolean;
  clienteId?: string;
  ubicacionId?: string;
  clienteNombre?: string;
  ubicacionResumen?: string;
}) {
  const [catalogo, setCatalogo] = useState<{ clave: string; items: Presentacion[] } | null>(inicial?.catalogo ? { clave: inicial.inicial?.cliente.id && inicial.ubicacionId ? `${inicial.inicial.cliente.id}:${inicial.ubicacionId}` : "", items: inicial.catalogo } : null);
  const [lineas, setLineas] = useState<Linea[]>(() => (inicial?.lineas ?? []).map((linea) => {
    const historica = aceptacion?.entrega.lineas.find((item) => item.id === linea.presentacion.presentacionId);
    return {
      ...linea,
      totalManual: Boolean(linea.motivoAjuste.trim() || (historica && historica.totalFinal !== historica.totalOriginal)),
    };
  }));
  const [busqueda, setBusqueda] = useState("");
  const [productoId, setProductoId] = useState("");
  const [presentacionId, setPresentacionId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [resultadoAgregar, setResultadoAgregar] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);
  const incorporando = useRef(false);
  const panelProductos = useRef<HTMLElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const clave = clienteId && ubicacionId ? `${clienteId}:${ubicacionId}` : "";

  const { activo } = useOrderWizard();
  const cargarCatalogo = !aceptacion || activo === 1 || activo === 2;
  const catalogoLeido = useRef<{ clave: string; intento: number } | null>(null);
  const precarga = useRef(Boolean(inicial?.catalogo));
  const ajustarReferenciasSolicitadas = useRef(Boolean(fechaSolicitada));
  const claveInicial = inicial?.inicial?.cliente.id && inicial.ubicacionId ? `${inicial.inicial?.cliente.id}:${inicial.ubicacionId}` : "";

  useEffect(() => { incorporando.current = false; }, [lineas]);

  useEffect(() => {
    if (panelProductos.current) panelProductos.current.scrollTop = 0;
  }, [activo]);

  useEffect(() => {
    if (!productoId) buscador.current?.focus();
  }, [productoId]);

  useEffect(() => {
    if (!cargarCatalogo) return;
    if (aceptacion && catalogoLeido.current?.clave === clave && catalogoLeido.current.intento === intento) return;
    if (inicial?.catalogo && clave === claveInicial && intento === 0 && precarga.current) return;
    precarga.current = false;
    let vigente = true;
    catalogoLeido.current = null;
    setCatalogo(null);
    setError("");
    setResultadoAgregar(null);
    if ((!clienteId || !ubicacionId) && !aceptacion) return;
    cargarCatalogoPedido(clienteId, ubicacionId, aceptacion?.entrega.pedidoId).then((items) => {
      if (vigente) {
        catalogoLeido.current = { clave, intento };
        if (ajustarReferenciasSolicitadas.current) {
          ajustarReferenciasSolicitadas.current = false;
          setLineas((previas) => previas.map((linea) => {
            const actual = items.find((item) => item.presentacionId === linea.presentacion.presentacionId && item.productoId === linea.presentacion.productoId);
            return actual ? { ...linea, presentacion: actual, precioReferencia: actual.precioFinalReferencia } : linea;
          }));
        }
        setCatalogo({ clave, items });
        setError("");
      }
    }).catch(() => {
      if (vigente) { setCatalogo(null); setError("No fue posible cargar el catálogo vigente. Intenta nuevamente."); }
    });
    return () => { vigente = false; };
  }, [clienteId, ubicacionId, intento, inicial, clave, claveInicial, aceptacion, cargarCatalogo]);

  const listo = Boolean((clave || aceptacion) && catalogo?.clave === clave);
  const items = listo ? catalogo!.items : [];
  const productos = items.filter((item, indice) => items.findIndex((otro) => otro.productoId === item.productoId) === indice)
    .filter((item) => normalizar(item.nombre).includes(normalizar(busqueda.trim())));
  const presentaciones = items.filter((item) => item.productoId === productoId);
  const elegida = presentaciones.find((item) => item.presentacionId === presentacionId);
  const resueltas = lineas.map((linea) => {
    const historica = aceptacion?.entrega.lineas.find((item) => item.id === linea.presentacion.presentacionId);
    const actual = historica ? linea.presentacion : items.find((item) => item.presentacionId === linea.presentacion.presentacionId && item.productoId === linea.presentacion.productoId);
    const mismaCantidad = historica && linea.cantidad.trim() !== "" && Number(linea.cantidad) === historica.cantidad;
    const conservada = mismaCantidad && /^\d+$/.test(linea.totalFinal) && Number(linea.totalFinal) === historica.totalFinal
      && linea.motivoAjuste.trim() === (historica.motivoAjuste ?? "").trim();
    const formatoCantidad = historica ? {
      unidad: historica.fraccionable ? "KG" : "UN",
      cantidadPresentacion: 1,
      presentacionNombre: "",
    } : actual;
    const itemCantidad = actual && formatoCantidad ? { ...actual, ...formatoCantidad } : undefined;
    // Las líneas recibidas intactas conservan la referencia histórica, incluida su auditoría.
    const totalOriginal = conservada ? historica.totalOriginal
      : itemCantidad ? totalLineaPedido(itemCantidad, linea.cantidad, itemCantidad.precioFinalReferencia) : null;
    return { ...linea, actual, historica, conservada, totalOriginal, itemCantidad };
  });
  const valida = (linea: typeof resueltas[number]) => linea.totalOriginal !== null;
  const validas = (aceptacion ? ubicacionValida : listo) && resueltas.length > 0
    && resueltas.length <= 100 && resueltas.every(valida);
  const subtotal = resueltas.reduce((total, linea) => total + (linea.totalOriginal ?? 0), 0);
  const duplicada = lineas.some((linea) => linea.presentacion.presentacionId === presentacionId
    || aceptacion?.entrega.lineas.some((item) => item.id === linea.presentacion.presentacionId && item.presentacionId === presentacionId));
  const puedeAgregar = listo && elegida && !duplicada && lineas.length < 100
    && totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia) !== null;

  const totalesAplicados = resueltas.map((linea) => linea.actual ? leerPrecioPedido(linea.totalFinal) : null);
  const sumaAplicada = totalesAplicados.reduce<number>((total, importe) => total + (importe ?? 0), 0);
  const subtotalAplicado = validas && totalesAplicados.every((total) => total !== null)
    && sumaAplicada <= IMPORTE_MAXIMO_PEDIDO ? sumaAplicada : null;
  const borrador = !aceptacion && validas ? crearBorradorPrecios(clienteId!, ubicacionId!, lineas, items) : null;

  const lineasEditadas = aceptacion ? resueltas.map((linea): EdicionPedidoRecibido["lineas"][number] | null => {
    if (linea.historica && linea.conservada) return { itemId: linea.historica.id };
    const ajuste = leerAjusteTotalLinea(linea, linea.totalOriginal);
    if (!ajuste || ajuste.totalOriginal > IMPORTE_MAXIMO_PEDIDO || !linea.actual || linea.historica?.protegida
      || linea.precioReferencia !== linea.actual.precioFinalReferencia) return null;
    return {
      itemId: linea.historica?.id ?? null,
      productoId: linea.historica ? linea.historica.productoId : linea.actual.productoId,
      presentacionId: linea.historica ? linea.historica.presentacionId : linea.actual.presentacionId,
      cantidad: Number(linea.cantidad), precioReferencia: linea.precioReferencia, ...ajuste,
    };
  }) : [];
  const lineasModificadas = aceptacion && (resueltas.length !== aceptacion.lineas.length || resueltas.some((linea) => !linea.conservada));
  const subtotalEdicion = aceptacion && !lineasModificadas ? aceptacion.entrega.subtotal : subtotalAplicado;
  const edicion = aceptacion && referenciasEntrega && subtotalEdicion !== null && lineasEditadas.every((linea) => linea !== null)
    ? {
      ...referenciasEntrega, clienteNombre: clienteNombre ?? null, ubicacionResumen: ubicacionResumen ?? null,
      lineas: lineasEditadas, subtotal: subtotalEdicion,
    } : null;
  const despacho = subtotalEdicion === aceptacion?.entrega.subtotal
    ? aceptacion?.entrega.costoEntrega ?? 0 : cotizarDespacho(subtotalEdicion ?? 0).costoEntrega;

  function agregarLinea() {
    if (incorporando.current) return;
    if (!puedeAgregar || !elegida) {
      setResultadoAgregar({ tipo: "error", mensaje: duplicada
        ? "Esta presentación ya está agregada. Modifica su cantidad en la línea existente."
        : "No fue posible agregar el producto. Revisa la presentación, la cantidad y la disponibilidad del catálogo." });
      return;
    }

    incorporando.current = true;
    setLineas((previas) => previas.some((linea) => linea.presentacion.presentacionId === elegida.presentacionId)
      ? previas
      : [...previas, { presentacion: elegida, cantidad, precioReferencia: elegida.precioFinalReferencia, totalFinal: String(totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia)), motivoAjuste: "", totalManual: false }]);
    setResultadoAgregar({ tipo: "exito", mensaje: `Producto agregado correctamente: ${elegida.nombre} · ${elegida.presentacionNombre}.` });
    setProductoId("");
    setPresentacionId("");
    setCantidad("");
    setBusqueda("");
  }

  useOrderStep(1, Boolean(validas && Number.isSafeInteger(subtotal)), !aceptacion && !listo ? (error || "Espera a que se valide el catálogo para el cliente y la ubicación seleccionados.") : "Agrega al menos un producto y revisa que todas las cantidades e importes sean válidos.");
  useOrderStep(2, Boolean(borrador || edicion), "Revisa los precios en CLP y completa el motivo de cada ajuste antes de continuar.");

  const enPrecios = activo === 2;
  const seccion = enPrecios ? "precios" : "productos";
  const controlesProductos = <>
    {!clave && !aceptacion ? <p role="status" className="mt-4 text-sm">Selecciona un cliente y una ubicación comercial válidos para continuar. Las líneas del borrador se conservan.</p> : !listo && !error ? <p role="status" className="mt-4 text-sm">Cargando catálogo vigente…</p> : null}
    {error && (clave || aceptacion) ? <p role="alert" className="mt-4 text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => { setError(""); setIntento((valor) => valor + 1); }}>Reintentar</button></p> : null}
    {aceptacion && listo ? <button type="button" className="mt-4 text-sm underline" onClick={() => setIntento((valor) => valor + 1)}>Actualizar catálogo</button> : null}
    {listo && !items.length ? <p role="status" className="mt-4 text-sm">No hay presentaciones disponibles con precio vigente.</p> : null}
    <fieldset disabled={!listo} className="min-w-0 space-y-3">
      <legend className="sr-only">Agregar productos al borrador administrativo</legend>
      <div hidden={Boolean(elegida)} className="space-y-4">
        <label className="block text-sm font-medium">Buscar producto por nombre<input ref={buscador} className={campo} value={busqueda} onChange={(event) => setBusqueda(event.target.value)} /></label>
        {listo && items.length > 0 && !productos.length ? <p role="status" className="text-sm">No hay productos que coincidan con la búsqueda.</p> : null}
        <div className="grid max-h-64 grid-cols-[repeat(auto-fill,minmax(min(100%,max(7rem,calc((100%_-_3.5rem)/8))),1fr))] gap-2 overflow-y-auto overscroll-contain rounded-lg border border-border bg-muted/30 p-2" role="group" aria-label="Productos disponibles" tabIndex={0}>
          {productos.map((item) => {
            const seleccionada = item.productoId === productoId && Boolean(elegida);
            const presentacion = seleccionada && elegida ? elegida : item;
            return <button key={item.productoId} type="button" aria-pressed={seleccionada}
              className={`flex min-w-0 flex-col items-start gap-1 rounded-md border border-border bg-card p-2 text-left text-xs transition-colors hover:border-primary/40 focus-visible:outline-2 focus-visible:outline-ring ${seleccionada ? "bg-primary/10" : "hover:bg-muted"}`}
              onClick={() => {
                if (seleccionada) return;
                setResultadoAgregar(null);
                setProductoId(item.productoId);
                setPresentacionId(item.presentacionId);
                setCantidad(String(getCartQuantityMinimum(item)));
              }}>
              <MiniaturaProducto ruta={presentacion.rutaImagen} />
              <span className="font-semibold [overflow-wrap:anywhere]">{item.nombre}</span>
              <span className="text-muted-foreground [overflow-wrap:anywhere]">{presentacion.presentacionNombre}</span>
              <span className="mt-auto pt-1 font-semibold tabular-nums text-primary">{formatCLP(presentacion.precioFinalReferencia)}</span>
            </button>;
          })}
        </div>
      </div>
      {elegida ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-primary/5 p-3 text-sm">
        <MiniaturaProducto ruta={elegida.rutaImagen} />
        <div className="min-w-0 flex-1 break-words">
          <p className="font-semibold">{elegida.nombre}</p>
          <p className="mt-1 text-muted-foreground">{elegida.presentacionNombre} · {elegida.cantidadPresentacion} {elegida.unidad} · {formatCLP(elegida.precioFinalReferencia)}</p>
        </div>
        <button type="button" className={buttonVariants({ variant: "outline" })} onClick={() => {
          setProductoId("");
          setPresentacionId("");
          setCantidad("");
          setResultadoAgregar(null);
        }}>Cambiar producto</button>
      </div> : null}
      {presentaciones.length > 1 ? <label className="block text-sm font-medium">Presentación de {elegida?.nombre}<select className={`${campo} sm:max-w-sm`} value={elegida?.presentacionId ?? ""} onChange={(event) => {
        const siguiente = presentaciones.find((item) => item.presentacionId === event.target.value);
        if (!siguiente) return;
        setPresentacionId(siguiente.presentacionId);
        setCantidad(String(getCartQuantityMinimum(siguiente)));
      }}>
        {presentaciones.map((item) => <option key={item.presentacionId} value={item.presentacionId}>{item.presentacionNombre} · {item.cantidadPresentacion} {item.unidad} · {formatCLP(item.precioFinalReferencia)}</option>)}
      </select></label> : null}
      {elegida ? <>
        <p className="text-sm">Precio de venta vigente: {formatCLP(elegida.precioFinalReferencia)}. {isFractionalKgItem(elegida) ? "De 0,1 a 10 kg, con hasta tres decimales." : "Cantidad entera de presentaciones."}</p>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Disminuir cantidad de ${elegida.nombre}`} disabled={!isValidCartQuantity(elegida, adjustCartQuantity(elegida, Number(cantidad), -1))} onClick={() => setCantidad(String(adjustCartQuantity(elegida, Number(cantidad), -1)))}>−</button>
          <label className="block text-sm font-medium">Cantidad {isFractionalKgItem(elegida) ? "(kg)" : "(presentaciones)"}<input type="number" inputMode={isFractionalKgItem(elegida) ? "decimal" : "numeric"} className={`${campo} max-w-32 ${isFractionalKgItem(elegida) ? "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" : ""}`} min={getCartQuantityMinimum(elegida)} max={getCartQuantityMaximum(elegida)} step={getCartQuantityInputStep(elegida)} value={cantidad} onChange={(event) => setCantidad(event.target.value)} /></label>
          <button type="button" className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Aumentar cantidad de ${elegida.nombre}`} disabled={!isValidCartQuantity(elegida, adjustCartQuantity(elegida, Number(cantidad), 1))} onClick={() => setCantidad(String(adjustCartQuantity(elegida, Number(cantidad), 1)))}>+</button>
          <span className="pb-3 text-sm" aria-live="polite">{isValidCartQuantity(elegida, Number(cantidad)) ? formatCartQuantity(elegida, Number(cantidad)) : "Cantidad pendiente"}</span>
        </div>
        <p className="text-sm" aria-live="polite">Subtotal: {totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia) !== null ? formatCLP(totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia)!) : "Pendiente"}</p>
        {!isValidCartQuantity(elegida, Number(cantidad)) ? <p role="alert" className="text-sm text-destructive">Ingresa una cantidad válida para esta presentación.</p> : null}
        {isValidCartQuantity(elegida, Number(cantidad)) && totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia) === null ? <p role="alert" className="text-sm text-destructive">No se puede agregar la línea: el importe está fuera de rango. Revisa la cantidad; tu selección se conserva.</p> : null}
      </> : null}
      {duplicada ? <p role="status" className="text-sm">Esta presentación ya está agregada. Modifica su cantidad en la línea existente.</p> : null}
      {elegida ? <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={!puedeAgregar} onClick={agregarLinea}>Agregar producto</button> : null}
      {resultadoAgregar ? <p role={resultadoAgregar.tipo === "error" ? "alert" : "status"} className={`text-sm ${resultadoAgregar.tipo === "error" ? "text-destructive" : "text-muted-foreground"}`}>{resultadoAgregar.mensaje}</p> : null}
    </fieldset>
  </>;

  return <>
    <section ref={panelProductos} hidden={activo !== 1 && activo !== 2} id={seccion} aria-labelledby={`${seccion}-titulo`}
      className="max-h-[52dvh] space-y-3 overflow-y-auto rounded-xl border border-border bg-card p-3 sm:max-h-[60dvh] sm:p-4 [dialog_&]:max-h-[48dvh]">
      <h2 tabIndex={-1} id={`${seccion}-titulo`} className="text-xl font-semibold">
        {enPrecios ? "3. Precios" : "2. Productos y cantidades"}
      </h2>
      {!lineas.length ? <p className="text-sm text-muted-foreground">Agrega al menos una presentación válida.</p> : null}
      <ul aria-label="Líneas del pedido" className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,21rem),1fr))] items-start gap-2 empty:hidden">
        {resueltas.map((linea) => {
          const item = linea.actual ?? linea.presentacion;
          const id = item.presentacionId;
          const cantidadItem = linea.itemCantidad ?? item;
          const fraccionable = isFractionalKgItem(cantidadItem);
          const precio = leerPrecioPedido(linea.totalFinal);
          const original = linea.totalOriginal;
          const ajustada = precio !== null && original !== null && precio !== original;
          const total = original === null ? null : precio;

          return <li key={id} className="min-w-0 rounded-lg border border-border bg-muted/30 p-2.5 text-sm">
            <div className="flex flex-wrap items-start gap-2">
              <MiniaturaProducto ruta={item.rutaImagen ?? linea.presentacion.rutaImagen} />
              <div className="min-w-20 flex-1 break-words">
                <p className="font-semibold leading-tight">{item.nombre}</p>
                <p className="text-xs text-muted-foreground">{item.presentacionNombre} · {item.cantidadPresentacion || ""} {item.unidad}</p>
                <p className="mt-1 text-xs text-muted-foreground">{linea.historica ? `Precio unitario guardado: ${formatCLP(item.precioFinalReferencia)}` : linea.actual ? `Precio vigente: ${formatCLP(item.precioFinalReferencia)}` : "Pendiente de validar disponibilidad y precio vigente."}</p>
                <p className="mt-0.5 text-xs font-semibold tabular-nums">Total de referencia: {original !== null ? formatCLP(original) : "Pendiente"}</p>
              </div>
              <div className="ml-auto flex shrink-0 items-start gap-1">
                <div>
                  <OrderQuantityInput item={cantidadItem} compact
                    label={`Cantidad de ${item.nombre} en ${fraccionable ? "kg" : "presentaciones"}`}
                    disabled={(!listo && !linea.historica) || linea.historica?.protegida}
                    className="h-8 w-14 rounded-md border border-border bg-background px-1 text-center text-sm tabular-nums"
                    value={linea.cantidad} onValueChange={(valor) => {
                      setLineas((previas) => previas.map((previa) => {
                        if (previa.presentacion.presentacionId !== id || valor === previa.cantidad) return previa;
                        const referencia = totalLineaPedido(cantidadItem, valor, item.precioFinalReferencia);
                        return {
                          ...previa, cantidad: valor, precioReferencia: item.precioFinalReferencia,
                          totalFinal: previa.totalManual ? previa.totalFinal : String(referencia ?? ""),
                        };
                      }));
                    }} />
                  <p className="mt-1 text-center text-xs text-muted-foreground">{fraccionable ? "kg · hasta 3 decimales" : "presentaciones"}</p>
                </div>
                <button type="button" disabled={linea.historica?.protegida}
                  aria-label={`Eliminar línea de ${item.nombre} · ${item.presentacionNombre}`}
                  className={`${buttonVariants({ variant: "ghost", size: "icon" })} text-muted-foreground hover:text-destructive`} onClick={() => {
                    setLineas((previas) => previas.filter((previa) => previa.presentacion.presentacionId !== id));
                    setResultadoAgregar(null);
                  }}>
                  <Trash2 aria-hidden="true" />
                </button>
              </div>
            </div>
            {(listo || linea.historica) && !valida(linea) ? <p role="alert" className="mt-2 text-destructive">{!linea.actual ? "Esta presentación ya no está disponible. Elimina la línea para continuar." : "Cantidad inválida para esta presentación o importe fuera de rango."}</p> : null}
            {enPrecios ? <fieldset aria-label={`Ajuste de precio de ${item.nombre} · ${item.presentacionNombre}`}
              disabled={!linea.actual || linea.historica?.protegida || Boolean(linea.historica && linea.precioReferencia === 0)}
              className="mt-2 min-w-0 border-t border-border pt-2 text-xs">
              {linea.historica?.protegida ? <p>Esta línea tiene historial vinculado y conserva sus importes y cantidad.</p>
                : linea.historica && linea.precioReferencia === 0 ? <p>La referencia histórica de esta línea es cero.</p> : null}
              <label className="mt-2 block font-medium">Precio total final (CLP)<input type="text" inputMode="numeric" className={campoPrecio} value={linea.totalFinal} onChange={(event) => {
                const valor = event.target.value;
                setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? { ...previa, precioReferencia: linea.actual!.precioFinalReferencia, totalFinal: valor, totalManual: true } : previa));
              }} /></label>
              {aceptacion && !linea.historica && linea.actual && linea.precioReferencia !== linea.actual.precioFinalReferencia
                ? <p role="alert" className="mt-2 text-destructive">El precio vigente cambió. Restaura el total de referencia o revisa el ajuste.</p> : null}
              {precio === null ? <p role="alert" className="mt-2 text-destructive">Ingresa un precio en CLP enteros, mayor o igual a cero y dentro del rango seguro.</p> : null}
              <p className="mt-2">Diferencia de total: {precio === null || original === null ? "Pendiente" : `${precio > original ? "+" : ""}${formatCLP(precio - original)}`}</p>
              {ajustada ? <label className="mt-2 block font-medium">Motivo del ajuste (obligatorio)<textarea maxLength={1000} required className={campoPrecio} value={linea.motivoAjuste} onChange={(event) => {
                const valor = event.target.value;
                setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? { ...previa, motivoAjuste: valor } : previa));
              }} />{!linea.motivoAjuste.trim() ? <span role="alert" className="text-destructive">Justifica el cambio de precio para continuar.</span> : null}</label> : null}
              <button type="button" className="mt-2 text-primary underline underline-offset-2" onClick={() => {
                const item = linea.itemCantidad;
                if (!item) return;
                setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? {
                  ...previa, precioReferencia: item.precioFinalReferencia,
                  totalFinal: String(totalLineaPedido(item, previa.cantidad, item.precioFinalReferencia) ?? ""),
                  motivoAjuste: "", totalManual: false,
                } : previa));
              }}>Restaurar total original</button>
              <p className="mt-2 font-semibold tabular-nums" aria-live="polite">Total de línea: {total === null ? "Pendiente de valores válidos" : formatCLP(total)}</p>
              {precio !== null && total === null ? <p role="alert" className="text-destructive">Cantidad inválida o importe fuera del rango seguro.</p> : null}
            </fieldset> : null}
          </li>;
        })}
      </ul>
      {enPrecios ? <p className="text-xs text-muted-foreground">Cada ajuste requiere un motivo. Al cambiar la cantidad, se recalcula la referencia y se conservan los totales ajustados.</p> : null}
      {enPrecios && !validas ? <p role="status" className="text-sm">Completa cliente, ubicación, productos y cantidades válidas para continuar.</p> : null}
      {controlesProductos}
      <div className="rounded-lg border border-border bg-primary/5 px-3 py-2">
        {enPrecios ? <>
          <p className="font-semibold tabular-nums" aria-live="polite">Subtotal aplicado: {subtotalEdicion !== null ? formatCLP(subtotalEdicion) : "Pendiente de importes válidos dentro del rango seguro"}</p>
          {subtotalEdicion !== null ? <p className="mt-1 text-sm tabular-nums" aria-live="polite">Despacho: {formatCLP(despacho)} · Total del pedido: {formatCLP(subtotalEdicion + despacho - (aceptacion?.entrega.descuento ?? 0))}</p> : null}
        </> : <p className="font-semibold tabular-nums" aria-live="polite">Subtotal de referencia en CLP: {validas && Number.isSafeInteger(subtotal) ? formatCLP(subtotal) : "Pendiente de líneas válidas"}</p>}
      </div>
    </section>
    <OrderDeliverySelection
      fechaInicial={fechaSolicitada}
      aceptacion={aceptacion?.entrega}
      modificado={ubicacionModificada || lineasModificadas}
      edicion={edicion}
      despachoEditado={despacho}
      resumenLineas={aceptacion ? resueltas.map((linea) => ({
        id: linea.presentacion.presentacionId,
        presentacion: linea.presentacion,
        cantidad: Number(linea.cantidad),
        totalOriginal: linea.totalOriginal ?? 0,
        totalFinal: Number(linea.totalFinal),
        motivoAjuste: linea.motivoAjuste.trim() || null,
        fraccionable: Boolean(linea.itemCantidad && isFractionalKgItem(linea.itemCantidad)),
      })) : undefined}
      precios={borrador}
      lineas={lineas}
      catalogo={items}
      clienteNombre={clienteNombre}
      ubicacionResumen={ubicacionResumen}
    />
  </>;
}
