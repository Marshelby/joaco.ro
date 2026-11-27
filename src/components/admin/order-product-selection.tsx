"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { OrderDeliverySelection } from "@/components/admin/order-delivery-selection";
import { useEffect, useRef, useState } from "react";
import { cargarCatalogoPedido, type cargarPedidoParaAceptar, type EdicionPedidoRecibido } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { formatCartQuantity, getCartQuantityMaximum, getCartQuantityMinimum, getCartQuantityStep, isValidCartQuantity } from "@/lib/cart-quantity";
import { cotizarDespacho } from "@/lib/delivery-pricing";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";

import { IMPORTE_MAXIMO_PEDIDO, crearBorradorPrecios, leerAjusteTotalLinea, leerPrecioPedido, totalLineaPedido, type LineaPedidoBorrador } from "@/lib/admin/pedido-borrador";
type Presentacion = Awaited<ReturnType<typeof cargarCatalogoPedido>>[number];
type Linea = LineaPedidoBorrador;
const campo = "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");

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
  const [lineas, setLineas] = useState<Linea[]>(inicial?.lineas ?? []);
  const [busqueda, setBusqueda] = useState("");
  const [productoId, setProductoId] = useState("");
  const [presentacionId, setPresentacionId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [resultadoAgregar, setResultadoAgregar] = useState<{ tipo: "exito" | "error"; mensaje: string } | null>(null);
  const incorporando = useRef(false);
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
    const mismaCantidad = historica && Number(linea.cantidad) === historica.cantidad;
    const conservada = mismaCantidad && /^\d+$/.test(linea.totalFinal) && Number(linea.totalFinal) === historica.totalFinal
      && linea.motivoAjuste.trim() === (historica.motivoAjuste ?? "").trim();
    const formatoCantidad = historica ? {
      unidad: historica.fraccionable ? "KG" : "UN",
      cantidadPresentacion: 1,
      presentacionNombre: "",
    } : actual;
    const itemCantidad = actual && formatoCantidad ? { ...actual, ...formatoCantidad } : undefined;
    const totalOriginal = mismaCantidad ? historica.totalOriginal
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
      : [...previas, { presentacion: elegida, cantidad, precioReferencia: elegida.precioFinalReferencia, totalFinal: String(totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia)), motivoAjuste: "" }]);
    setResultadoAgregar({ tipo: "exito", mensaje: `Producto agregado correctamente: ${elegida.nombre} · ${elegida.presentacionNombre}.` });
    setProductoId("");
    setPresentacionId("");
    setCantidad("");
    setBusqueda("");
  }

  useOrderStep(1, Boolean(validas && Number.isSafeInteger(subtotal)), !aceptacion && !listo ? (error || "Espera a que se valide el catálogo para el cliente y la ubicación seleccionados.") : "Agrega al menos un producto y revisa que todas las cantidades e importes sean válidos.");
  useOrderStep(2, Boolean(borrador || edicion), "Revisa los precios en CLP y completa el motivo de cada ajuste antes de continuar.");

  const productosEnPrecios = Boolean(aceptacion && activo === 2);
  const controlesProductos = <>
    {!clave && !aceptacion ? <p role="status" className="mt-4 text-sm">Selecciona un cliente y una ubicación comercial válidos para continuar. Las líneas del borrador se conservan.</p> : !listo && !error ? <p role="status" className="mt-4 text-sm">Cargando catálogo vigente…</p> : null}
    {error && (clave || aceptacion) ? <p role="alert" className="mt-4 text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => { setError(""); setIntento((valor) => valor + 1); }}>Reintentar</button></p> : null}
    {aceptacion && listo ? <button type="button" className="mt-4 text-sm underline" onClick={() => setIntento((valor) => valor + 1)}>Actualizar catálogo</button> : null}
    {listo && !items.length ? <p role="status" className="mt-4 text-sm">No hay presentaciones disponibles con precio vigente.</p> : null}
    <fieldset disabled={!listo} className="mt-5 space-y-4">
      <legend className="sr-only">Agregar productos al borrador administrativo</legend>
      <div hidden={Boolean(elegida)} className="space-y-4">
      <label className="block text-sm font-medium">Buscar producto por nombre<input ref={buscador} className={campo} value={busqueda} onChange={(event) => setBusqueda(event.target.value)} /></label>
      {listo && items.length > 0 && !productos.length ? <p role="status" className="text-sm">No hay productos que coincidan con la búsqueda.</p> : null}
      <div className="max-h-80 overflow-y-auto overscroll-contain rounded-lg border border-border" role="group" aria-label="Productos disponibles" tabIndex={0}>
        {productos.map((item) => {
          const seleccionada = item.productoId === productoId && Boolean(elegida);
          const presentacion = seleccionada && elegida ? elegida : item;
          return <button key={item.productoId} type="button" aria-pressed={seleccionada}
            className={`flex min-h-14 w-full items-center justify-between gap-3 border-b border-border px-3 py-3 text-left text-sm last:border-b-0 focus-visible:outline-2 focus-visible:outline-ring ${seleccionada ? "bg-primary/10" : "hover:bg-muted"}`}
            onClick={() => {
              if (seleccionada) return;
              setResultadoAgregar(null);
              setProductoId(item.productoId);
              setPresentacionId(item.presentacionId);
              setCantidad(String(getCartQuantityMinimum(item)));
            }}>
            <span className="font-medium">{item.nombre}</span>
            <span className="text-right">{formatCLP(presentacion.precioFinalReferencia)} · {presentacion.presentacionNombre}</span>
          </button>;
        })}
      </div>
      </div>
      {elegida ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-primary/5 p-3 text-sm">
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
        <p className="text-sm">Precio de venta vigente: {formatCLP(elegida.precioFinalReferencia)}. {getCartQuantityStep(elegida) === 0.5 ? "De 0,5 a 10 KG, en incrementos de 0,5 KG." : "Cantidad entera de presentaciones."}</p>
        <div className="flex flex-wrap items-end gap-2">
          <button type="button" className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Disminuir cantidad de ${elegida.nombre}`} disabled={!isValidCartQuantity(elegida, Number(cantidad) - getCartQuantityStep(elegida))} onClick={() => setCantidad(String(Number(cantidad) - getCartQuantityStep(elegida)))}>−</button>
          <label className="block text-sm font-medium">Cantidad<input type="number" className={`${campo} max-w-32`} min={getCartQuantityMinimum(elegida)} max={getCartQuantityMaximum(elegida)} step={getCartQuantityStep(elegida)} value={cantidad} onChange={(event) => setCantidad(event.target.value)} /></label>
          <button type="button" className={buttonVariants({ variant: "outline", size: "icon" })} aria-label={`Aumentar cantidad de ${elegida.nombre}`} disabled={!isValidCartQuantity(elegida, Number(cantidad) + getCartQuantityStep(elegida))} onClick={() => setCantidad(String(Number(cantidad) + getCartQuantityStep(elegida)))}>+</button>
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
    <div className="mt-5 space-y-3" aria-label="Líneas del pedido">
      {!lineas.length ? <p className="text-sm text-muted-foreground">Agrega al menos una presentación válida.</p> : null}
      {resueltas.map((linea) => {
        const item = linea.actual ?? linea.presentacion;
        const cantidadItem = linea.itemCantidad ?? item;
        return <div key={item.presentacionId} className="rounded-lg border border-border p-4 text-sm">
          <p className="font-semibold">{item.nombre} · {item.presentacionNombre} · {item.cantidadPresentacion || ""} {item.unidad}</p>
          <p>{linea.historica ? `Precio unitario guardado: ${formatCLP(item.precioFinalReferencia)}` : linea.actual ? `Precio de venta vigente: ${formatCLP(item.precioFinalReferencia)}` : "Pendiente de validar disponibilidad y precio vigente."}</p>
          <label className="mt-2 block">Cantidad · {getCartQuantityStep(cantidadItem) === 0.5 ? "0,5 a 10 KG; incrementos de 0,5" : "presentaciones enteras"}<input type="number" disabled={(!listo && !linea.historica) || linea.historica?.protegida} className={campo} min={getCartQuantityMinimum(cantidadItem)} max={getCartQuantityMaximum(cantidadItem)} step={getCartQuantityStep(cantidadItem)} value={linea.cantidad} onChange={(event) => {
            const valor = event.target.value;
            setLineas((previas) => previas.map((previa) => {
              if (previa.presentacion.presentacionId !== item.presentacionId || (valor && Number(valor) === Number(previa.cantidad))) return previa;
              const original = aceptacion?.lineas.find((guardada) => guardada.presentacion.presentacionId === item.presentacionId);
              if (original && valor && Number(valor) === Number(original.cantidad)) return original;
              return { ...previa, cantidad: valor, precioReferencia: item.precioFinalReferencia, totalFinal: String(totalLineaPedido(cantidadItem, valor, item.precioFinalReferencia) ?? ""), motivoAjuste: "" };
            }));
          }} /></label>
          {(listo || linea.historica) && !valida(linea) ? <p role="alert" className="mt-2 text-destructive">{!linea.actual ? "Esta presentación ya no está disponible. Elimina la línea para continuar." : "Cantidad inválida para esta presentación o importe fuera de rango."}</p> : null}
          <p className="mt-2">Total de referencia de línea: {valida(linea) ? formatCLP(linea.totalOriginal!) : "Pendiente"}</p>
          <button type="button" disabled={linea.historica?.protegida} className="mt-2 underline" onClick={() => {
            setLineas((previas) => previas.filter((previa) => previa.presentacion.presentacionId !== item.presentacionId));
            setResultadoAgregar(null);
          }}>Eliminar línea de {item.nombre} · {item.presentacionNombre}</button>
        </div>;
      })}
    </div>
  </>;

  return <><section hidden={activo !== 1} id="productos" aria-labelledby="productos-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 tabIndex={-1} id="productos-titulo" className="text-xl font-semibold">2. Productos y cantidades</h2>
    <p className="mt-2 text-sm text-muted-foreground">{aceptacion ? "Las líneas recibidas conservan su precio unitario. Revisa cantidades y totales en el paso Precios." : "Precios de venta vigentes como referencia. Puedes ajustar los precios de cada línea en la etapa Precios. Este borrador se conserva mientras navegas entre las secciones de esta página."}</p>
    {!productosEnPrecios ? controlesProductos : null}
    <p className="mt-5 font-semibold" aria-live="polite">Subtotal de referencia en CLP: {validas && Number.isSafeInteger(subtotal) ? formatCLP(subtotal) : "Pendiente de líneas válidas"}</p>
    <p className="mt-2 text-sm text-muted-foreground">La disponibilidad final está sujeta a confirmación. Revisa los precios aplicados en la siguiente etapa.</p>
  </section>
    <section hidden={activo !== 2} id="precios" aria-labelledby="precios-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 tabIndex={-1} id="precios-titulo" className="text-xl font-semibold">3. Precios</h2>
      <p className="mt-2 text-sm text-muted-foreground">Totales finales por línea en pesos chilenos enteros, incluyendo cero. Cada ajuste requiere un motivo. {aceptacion ? "Cada línea recibida usa su precio unitario guardado." : "El precio vigente del catálogo se conserva."} Al cambiar la cantidad, el total se calcula con el precio de referencia.</p>
      {productosEnPrecios ? controlesProductos : null}
      {!validas ? <p role="status" className="mt-4 text-sm">Completa cliente, ubicación, productos y cantidades válidas para continuar.</p> : null}
      <div className="mt-4 space-y-3">
        {resueltas.map((linea) => {
          const id = linea.presentacion.presentacionId;
          const precio = leerPrecioPedido(linea.totalFinal);
          const original = linea.totalOriginal;
          const ajustada = precio !== null && original !== null && precio !== original;
          const total = original === null ? null : precio;
          return <fieldset key={id} disabled={!linea.actual || linea.historica?.protegida || Boolean(linea.historica && linea.precioReferencia === 0)} className="rounded-lg border border-border p-4 text-sm">
            <legend className="px-1 font-semibold">{linea.presentacion.nombre} · {linea.presentacion.presentacionNombre}</legend>
            {linea.historica?.protegida ? <p>Esta línea tiene historial vinculado y conserva sus importes y cantidad.</p>
              : linea.historica && linea.precioReferencia === 0 ? <p>La referencia histórica de esta línea es cero.</p> : null}
            <p>Cantidad: {linea.cantidad || "Pendiente"} · Total original: {original === null ? "Pendiente" : formatCLP(original)}</p>
            <label className="mt-2 block">Precio total final (CLP)<input type="text" inputMode="numeric" className={campo} value={linea.totalFinal} onChange={(event) => {
              const valor = event.target.value;
              setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? { ...previa, precioReferencia: linea.actual!.precioFinalReferencia, totalFinal: valor, motivoAjuste: leerPrecioPedido(valor) === original ? "" : previa.motivoAjuste } : previa));
            }} /></label>
            {aceptacion && !linea.historica && linea.actual && linea.precioReferencia !== linea.actual.precioFinalReferencia
              ? <p role="alert" className="mt-2 text-destructive">El precio vigente cambió. Restaura el total de referencia o revisa el ajuste.</p> : null}
            {precio === null ? <p role="alert" className="mt-2 text-destructive">Ingresa un precio en CLP enteros, mayor o igual a cero y dentro del rango seguro.</p> : null}
            <p className="mt-2">Diferencia de total: {precio === null || original === null ? "Pendiente" : `${precio > original ? "+" : ""}${formatCLP(precio - original)}`}</p>
            {ajustada ? <label className="mt-2 block">Motivo del ajuste (obligatorio)<textarea maxLength={1000} required className={campo} value={linea.motivoAjuste} onChange={(event) => {
              const valor = event.target.value;
              setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? { ...previa, motivoAjuste: valor } : previa));
            }} />{!linea.motivoAjuste.trim() ? <span role="alert" className="text-destructive">Justifica el cambio de precio para continuar.</span> : null}</label> : null}
            <button type="button" className="mt-2 underline" onClick={() => setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? { ...previa, precioReferencia: linea.actual!.precioFinalReferencia, totalFinal: String(original ?? ""), motivoAjuste: "" } : previa))}>Restaurar total original</button>
            <p className="mt-2" aria-live="polite">Total de línea: {total === null ? "Pendiente de valores válidos" : formatCLP(total)}</p>
            {precio !== null && total === null ? <p role="alert" className="text-destructive">Cantidad inválida o importe fuera del rango seguro.</p> : null}
          </fieldset>;
        })}
      </div>
      <p className="mt-5 font-semibold" aria-live="polite">Subtotal aplicado: {subtotalEdicion !== null ? formatCLP(subtotalEdicion) : "Pendiente de importes válidos dentro del rango seguro"}</p>
      {subtotalEdicion !== null ? <p className="mt-2 text-sm" aria-live="polite">Despacho: {formatCLP(despacho)} · Total del pedido: {formatCLP(subtotalEdicion + despacho - (aceptacion?.entrega.descuento ?? 0))}</p> : null}
      <p className="mt-2 text-sm text-muted-foreground">El borrador se conserva solo en esta página; todavía no se guarda ni confirma.</p>
    </section>
    <OrderDeliverySelection fechaInicial={fechaSolicitada} aceptacion={aceptacion?.entrega} modificado={ubicacionModificada || lineasModificadas} edicion={edicion} despachoEditado={despacho} resumenLineas={aceptacion ? resueltas.map((linea) => ({ id: linea.presentacion.presentacionId, presentacion: linea.presentacion, cantidad: Number(linea.cantidad), totalOriginal: linea.totalOriginal ?? 0, totalFinal: Number(linea.totalFinal), motivoAjuste: linea.motivoAjuste.trim() || null })) : undefined} precios={borrador} lineas={lineas} clienteNombre={clienteNombre} ubicacionResumen={ubicacionResumen} />
  </>;
}
