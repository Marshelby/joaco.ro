"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { OrderDeliverySelection } from "@/components/admin/order-delivery-selection";
import { useEffect, useRef, useState } from "react";
import { cargarCatalogoPedido } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { formatCartQuantity, getCartQuantityMaximum, getCartQuantityMinimum, getCartQuantityStep, isValidCartQuantity } from "@/lib/cart-quantity";
import { cotizarDespacho } from "@/lib/delivery-pricing";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";

import { IMPORTE_MAXIMO_PEDIDO, crearBorradorPrecios, leerPrecioPedido, totalLineaPedido, type LineaPedidoBorrador } from "@/lib/admin/pedido-borrador";
type Presentacion = Awaited<ReturnType<typeof cargarCatalogoPedido>>[number];
type Linea = LineaPedidoBorrador;
const campo = "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const normalizar = (texto: string) => texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es-CL");

export function OrderProductSelection({ clienteId, ubicacionId, clienteNombre, ubicacionResumen }: { clienteId?: string; ubicacionId?: string; clienteNombre?: string; ubicacionResumen?: string }) {
  const [catalogo, setCatalogo] = useState<{ clave: string; items: Presentacion[] } | null>(null);
  const [lineas, setLineas] = useState<Linea[]>([]);
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

  useEffect(() => { incorporando.current = false; }, [lineas]);

  useEffect(() => {
    let vigente = true;
    setCatalogo(null);
    setError("");
    setResultadoAgregar(null);
    if (!clienteId || !ubicacionId) return;
    cargarCatalogoPedido(clienteId, ubicacionId).then((items) => {
      if (vigente) { setCatalogo({ clave: `${clienteId}:${ubicacionId}`, items }); setError(""); }
    }).catch(() => {
      if (vigente) { setCatalogo(null); setError("No fue posible cargar el catálogo vigente. Intenta nuevamente."); }
    });
    return () => { vigente = false; };
  }, [clienteId, ubicacionId, intento]);

  const listo = Boolean(clave && catalogo?.clave === clave);
  const items = listo ? catalogo!.items : [];
  const productos = items.filter((item, indice) => items.findIndex((otro) => otro.productoId === item.productoId) === indice)
    .filter((item) => normalizar(item.nombre).includes(normalizar(busqueda.trim())));
  const presentaciones = items.filter((item) => item.productoId === productoId);
  const elegida = presentaciones.find((item) => item.presentacionId === presentacionId);
  const resueltas = lineas.map((linea) => ({ ...linea, actual: items.find((item) => item.presentacionId === linea.presentacion.presentacionId) }));
  const valida = (linea: typeof resueltas[number]) => Boolean(linea.actual && isValidCartQuantity(linea.actual, Number(linea.cantidad))
    && totalLineaPedido(linea.actual, linea.cantidad, linea.actual.precioFinalReferencia) !== null);
  const validas = listo && resueltas.length > 0 && resueltas.every(valida);
  const subtotal = resueltas.reduce((total, linea) => total + (valida(linea) ? totalLineaPedido(linea.actual!, linea.cantidad, linea.actual!.precioFinalReferencia)! : 0), 0);
  const duplicada = lineas.some((linea) => linea.presentacion.presentacionId === presentacionId);
  const puedeAgregar = listo && elegida && !duplicada && isValidCartQuantity(elegida, Number(cantidad))
    && totalLineaPedido(elegida, cantidad, elegida.precioFinalReferencia) !== null;

  const totalesAplicados = resueltas.map((linea) => linea.actual ? leerPrecioPedido(linea.totalFinal) : null);
  const sumaAplicada = totalesAplicados.reduce<bigint>((total, importe) => total + BigInt(importe ?? 0), BigInt(0));
  const subtotalAplicado = validas && totalesAplicados.every((total) => total !== null) && sumaAplicada <= BigInt(IMPORTE_MAXIMO_PEDIDO) ? Number(sumaAplicada) : null;
  const borrador = validas ? crearBorradorPrecios(clienteId!, ubicacionId!, lineas, items) : null;

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
    buscador.current?.focus();
  }

  const { activo } = useOrderWizard();
  useOrderStep(1, Boolean(validas && Number.isSafeInteger(subtotal)), !listo ? (error || "Espera a que se valide el catálogo para el cliente y la ubicación seleccionados.") : "Agrega al menos un producto y revisa que todas las cantidades e importes sean válidos.");
  useOrderStep(2, Boolean(borrador), "Revisa los precios en CLP y completa el motivo de cada ajuste antes de continuar.");

  return <><section hidden={activo !== 1} id="productos" aria-labelledby="productos-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 tabIndex={-1} id="productos-titulo" className="text-xl font-semibold">2. Productos y cantidades</h2>
    <p className="mt-2 text-sm text-muted-foreground">Precios de venta vigentes como referencia. Puedes ajustar los precios de cada línea en la etapa Precios. Este borrador se conserva mientras navegas entre las secciones de esta página.</p>
    {!clave ? <p role="status" className="mt-4 text-sm">Selecciona un cliente y una ubicación comercial válidos para continuar. Las líneas del borrador se conservan.</p> : !listo && !error ? <p role="status" className="mt-4 text-sm">Cargando catálogo vigente…</p> : null}
    {error && clave ? <p role="alert" className="mt-4 text-sm text-destructive">{error} <button type="button" className="underline" onClick={() => { setError(""); setIntento((valor) => valor + 1); }}>Reintentar</button></p> : null}
    {listo && !items.length ? <p role="status" className="mt-4 text-sm">No hay presentaciones disponibles con precio vigente.</p> : null}
    <fieldset disabled={!listo} className="mt-5 space-y-4">
      <legend className="sr-only">Agregar productos al borrador administrativo</legend>
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
      <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={!puedeAgregar} onClick={agregarLinea}>Agregar línea</button>
      {resultadoAgregar ? <p role={resultadoAgregar.tipo === "error" ? "alert" : "status"} className={`text-sm ${resultadoAgregar.tipo === "error" ? "text-destructive" : "text-muted-foreground"}`}>{resultadoAgregar.mensaje}</p> : null}
    </fieldset>
    <div className="mt-5 space-y-3" aria-label="Líneas del pedido">
      {!lineas.length ? <p className="text-sm text-muted-foreground">Agrega al menos una presentación válida.</p> : null}
      {resueltas.map((linea) => {
        const item = linea.actual ?? linea.presentacion;
        return <div key={item.presentacionId} className="rounded-lg border border-border p-4 text-sm">
          <p className="font-semibold">{item.nombre} · {item.presentacionNombre} · {item.cantidadPresentacion} {item.unidad}</p>
          <p>{linea.actual ? `Precio de venta vigente: ${formatCLP(item.precioFinalReferencia)}` : "Pendiente de validar disponibilidad y precio vigente."}</p>
          <label className="mt-2 block">Cantidad · {getCartQuantityStep(item) === 0.5 ? "0,5 a 10 KG; incrementos de 0,5" : "presentaciones enteras"}<input type="number" disabled={!listo} className={campo} min={getCartQuantityMinimum(item)} max={getCartQuantityMaximum(item)} step={getCartQuantityStep(item)} value={linea.cantidad} onChange={(event) => {
            const valor = event.target.value;
            setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === item.presentacionId ? { ...previa, cantidad: valor, precioReferencia: item.precioFinalReferencia, totalFinal: String(totalLineaPedido(item, valor, item.precioFinalReferencia) ?? ""), motivoAjuste: "" } : previa));
          }} /></label>
          {listo && !valida(linea) ? <p role="alert" className="mt-2 text-destructive">{!linea.actual ? "Esta presentación ya no está disponible. Elimina la línea para continuar." : "Cantidad inválida para esta presentación o importe fuera de rango."}</p> : null}
          <p className="mt-2">Total de referencia de línea: {valida(linea) ? formatCLP(totalLineaPedido(item, linea.cantidad, item.precioFinalReferencia)!) : "Pendiente"}</p>
          <button type="button" className="mt-2 underline" onClick={() => {
            setLineas((previas) => previas.filter((previa) => previa.presentacion.presentacionId !== item.presentacionId));
            setResultadoAgregar(null);
          }}>Eliminar línea de {item.nombre} · {item.presentacionNombre}</button>
        </div>;
      })}
    </div>
    <p className="mt-5 font-semibold" aria-live="polite">Subtotal de referencia en CLP: {validas && Number.isSafeInteger(subtotal) ? formatCLP(subtotal) : "Pendiente de líneas válidas"}</p>
    <p className="mt-2 text-sm text-muted-foreground">La disponibilidad final está sujeta a confirmación. Revisa los precios aplicados en la siguiente etapa.</p>
  </section>
    <section hidden={activo !== 2} id="precios" aria-labelledby="precios-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 tabIndex={-1} id="precios-titulo" className="text-xl font-semibold">3. Precios</h2>
      <p className="mt-2 text-sm text-muted-foreground">Totales finales por línea en pesos chilenos enteros, incluyendo cero. Cada ajuste requiere un motivo. El precio vigente del catálogo se conserva. Al cambiar la cantidad se restaura el total original.</p>
      {!validas ? <p role="status" className="mt-4 text-sm">Completa cliente, ubicación, productos y cantidades válidas para continuar.</p> : null}
      <div className="mt-4 space-y-3">
        {resueltas.map((linea) => {
          const id = linea.presentacion.presentacionId;
          const precio = leerPrecioPedido(linea.totalFinal);
          const original = linea.actual ? totalLineaPedido(linea.actual, linea.cantidad, linea.actual.precioFinalReferencia) : null;
          const ajustada = precio !== null && original !== null && precio !== original;
          const total = original === null ? null : precio;
          return <fieldset key={id} disabled={!listo || !linea.actual} className="rounded-lg border border-border p-4 text-sm">
            <legend className="px-1 font-semibold">{linea.presentacion.nombre} · {linea.presentacion.presentacionNombre}</legend>
            <p>Cantidad: {linea.cantidad || "Pendiente"} · Total original: {original === null ? "Pendiente" : formatCLP(original)}</p>
            <label className="mt-2 block">Precio total final (CLP)<input type="text" inputMode="numeric" className={campo} value={linea.totalFinal} onChange={(event) => {
              const valor = event.target.value;
              setLineas((previas) => previas.map((previa) => previa.presentacion.presentacionId === id ? { ...previa, precioReferencia: linea.actual!.precioFinalReferencia, totalFinal: valor, motivoAjuste: leerPrecioPedido(valor) === original ? "" : previa.motivoAjuste } : previa));
            }} /></label>
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
      <p className="mt-5 font-semibold" aria-live="polite">Subtotal aplicado: {subtotalAplicado !== null ? formatCLP(subtotalAplicado) : "Pendiente de importes válidos dentro del rango seguro"}</p>
      {subtotalAplicado !== null ? <p className="mt-2 text-sm" aria-live="polite">Despacho: {formatCLP(cotizarDespacho(subtotalAplicado).costoEntrega)} · Total del pedido: {formatCLP(cotizarDespacho(subtotalAplicado).totalEstimado)}</p> : null}
      <p className="mt-2 text-sm text-muted-foreground">El borrador se conserva solo en esta página; todavía no se guarda ni confirma.</p>
    </section>
    <OrderDeliverySelection precios={borrador} lineas={lineas} clienteNombre={clienteNombre} ubicacionResumen={ubicacionResumen} />
  </>;
}
