"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { OrderProductSelection } from "@/components/admin/order-product-selection";
import { useEffect, useId, useRef, useState } from "react";
import { buscarClientesPedido, cargarClientePedido, type cargarPedidoParaAceptar } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { describirSaldoCuenta } from "@/lib/account-balance";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";
import { Check, ChevronDown, MapPin, Search } from "lucide-react";

type Seleccion = Awaited<ReturnType<typeof cargarClientePedido>>;
type Resultados = Awaited<ReturnType<typeof buscarClientesPedido>>;
const cuadricula = "grid grid-cols-[repeat(auto-fit,minmax(min(100%,12rem),1fr))] gap-2";

type Reciclado = Awaited<ReturnType<typeof import("@/app/(admin)/admin/pedidos/nuevo/actions").cargarPedidoParaReciclar>>;

type Aceptacion = Awaited<ReturnType<typeof cargarPedidoParaAceptar>>;

type Solicitud = Awaited<ReturnType<typeof import("@/app/(admin)/admin/posibles-pedidos/precarga-actions").cargarPosibleParaPedido>>;

export function OrderCustomerSelection({ inicial, reciclado, aceptacion, solicitud }: { inicial: Seleccion | null; reciclado?: Reciclado | null; aceptacion?: Aceptacion; solicitud?: Solicitud }) {
  const precarga = aceptacion ?? reciclado ?? solicitud;
  const [seleccion, setSeleccion] = useState(inicial);
  const [clienteIdElegido, setClienteIdElegido] = useState(aceptacion?.entrega.clienteId ?? inicial?.cliente.id ?? null);
  const [ubicacionId, setUbicacionId] = useState(precarga?.ubicacionId ?? (inicial?.ubicaciones.length === 1 ? inicial.ubicaciones[0].id : ""));
  const [buscadorAbierto, setBuscadorAbierto] = useState(!inicial && !aceptacion);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Resultados | null>(null);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [buscando, setBuscando] = useState(true);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [intento, setIntento] = useState(0);
  const [error, setError] = useState("");
  const carga = useRef(0);
  const consulta = useRef(0);
  const id = useId();
  const botonCliente = useRef<HTMLButtonElement>(null);
  const enfocarCliente = useRef(false);
  const ubicacion = seleccion?.ubicaciones.find((item) => item.id === ubicacionId);
  const clienteModificado = Boolean(aceptacion && clienteIdElegido !== aceptacion.entrega.clienteId);
  const ubicacionModificada = clienteModificado || Boolean(aceptacion && ubicacionId !== aceptacion.ubicacionId);
  const clienteMostrado = seleccion?.cliente ?? (aceptacion && !clienteModificado && !cargando
    ? { nombre: aceptacion.entrega.clienteNombre, telefono: null }
    : null);
  const mostrarBuscador = !clienteMostrado || buscadorAbierto;
  const nombreUbicacion = ubicacion && [ubicacion.nombre_ubicacion, ubicacion.nombre, ubicacion.direccion]
    .find((valor) => valor?.trim())?.trim();
  const ubicacionResumen = ubicacion
    ? [nombreUbicacion, ubicacion.direccion ?? nombreUbicacion, ubicacion.comuna, ubicacion.region].filter(Boolean).join(" · ")
    : undefined;
  const saldo = seleccion ? describirSaldoCuenta(seleccion.saldoActual) : null;

  const { activo } = useOrderWizard();
  const ubicacionValida = Boolean(ubicacion
    && [ubicacion.nombre_ubicacion, ubicacion.nombre, ubicacion.direccion].some((valor) => valor?.trim())
    && ubicacion.latitud !== null && Number.isFinite(ubicacion.latitud) && Math.abs(ubicacion.latitud) <= 90
    && ubicacion.longitud !== null && Number.isFinite(ubicacion.longitud) && Math.abs(ubicacion.longitud) <= 180);
  const pasoClienteValido = !cargando && Boolean((aceptacion && !ubicacionModificada) || (seleccion && ubicacionValida));
  useOrderStep(0, pasoClienteValido, cargando ? "Espera a que termine la carga del cliente." : !seleccion ? "Selecciona un cliente activo para continuar." : "Selecciona una ubicación comercial activa con nombre o dirección y coordenadas válidas para continuar.");

  function limpiar() {
    carga.current += 1;
    setSeleccion(null);
    setClienteIdElegido(null);
    setUbicacionId("");
    setCargando(false);
    setError("");
  }

  useEffect(() => {
    if (mostrarBuscador || !enfocarCliente.current) return;
    enfocarCliente.current = false;
    botonCliente.current?.focus({ preventScroll: true });
  }, [mostrarBuscador]);

  useEffect(() => {
    const version = ++consulta.current;
    setBuscando(true);
    setResultados(null);
    setErrorBusqueda("");
    const temporizador = setTimeout(async () => {
      try {
        const respuesta = await buscarClientesPedido(busqueda.trim(), pagina);
        if (version === consulta.current) setResultados(respuesta);
      } catch {
        if (version === consulta.current) setErrorBusqueda("No fue posible buscar clientes. Intenta nuevamente.");
      } finally {
        if (version === consulta.current) setBuscando(false);
      }
    }, busqueda.trim() && pagina === 1 ? 350 : 0);
    return () => {
      clearTimeout(temporizador);
      consulta.current += 1;
    };
  }, [busqueda, pagina, intento]);

  function cambiarPagina(numero: number) {
    consulta.current += 1;
    setBuscando(true);
    setResultados(null);
    setPagina(numero);
  }

  async function elegir(id: string) {
    limpiar();
    const version = carga.current;
    setCargando(true);
    try {
      const respuesta = await cargarClientePedido(id);
      if (version !== carga.current) return;
      enfocarCliente.current = true;
      setBuscadorAbierto(false);
      const regresarAlClienteOriginal = aceptacion?.entrega.clienteId === id;
      setClienteIdElegido(id);
      setSeleccion(regresarAlClienteOriginal ? aceptacion?.inicial ?? respuesta : respuesta);
      setUbicacionId(regresarAlClienteOriginal && aceptacion ? aceptacion.ubicacionId : respuesta.ubicaciones.length === 1 ? respuesta.ubicaciones[0].id : "");
    } catch {
      if (version === carga.current) setError("No fue posible cargar el cliente activo, sus ubicaciones y saldo. Intenta nuevamente.");
    } finally {
      if (version === carga.current) setCargando(false);
    }
  }

  return <><section hidden={activo !== 0} id="cliente" aria-labelledby={`${id}-cliente-titulo`} className="min-w-0 rounded-xl border border-border bg-card p-3 sm:p-4">
    <h2 id={`${id}-cliente-titulo`} className="text-lg font-semibold sm:text-xl">1. Cliente y ubicación de entrega</h2>
    {clienteMostrado ? <button ref={botonCliente} type="button"
      aria-expanded={mostrarBuscador} aria-controls={`${id}-buscador`}
      onClick={() => setBuscadorAbierto((abierto) => !abierto)}
      className="mt-3 flex w-full items-center gap-3 rounded-lg border border-primary/40 bg-primary/10 px-3 py-2 text-left text-primary transition-colors hover:bg-primary/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Check className="size-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 break-words text-sm">
        <span className="block font-semibold">{clienteMostrado.nombre}</span>
        <span className="block text-xs text-foreground">{clienteMostrado.telefono || "Sin teléfono"}</span>
        {saldo ? <span className="block text-xs text-muted-foreground">Cuenta corriente: {saldo.texto} · {formatCLP(saldo.monto)}</span> : null}
      </span>
      <span className="sr-only">Cambiar cliente</span>
      <ChevronDown aria-hidden="true" className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${mostrarBuscador ? "rotate-180" : ""}`} />
    </button> : null}
    <div id={`${id}-buscador`} inert={!mostrarBuscador} aria-hidden={!mostrarBuscador}
      className={`grid transition-[grid-template-rows,opacity] duration-200 ease-in-out motion-reduce:transition-none ${mostrarBuscador ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="min-h-0 overflow-hidden">
        <div className="space-y-2 px-1 pb-1 pt-3">
          <label className="block text-sm font-medium" htmlFor={`${id}-buscar`}>Buscar cliente</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id={`${id}-buscar`} type="search" className="h-10 w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm focus-visible:outline-2 focus-visible:outline-ring"
              value={busqueda} maxLength={120} placeholder="Nombre, teléfono o correo" autoComplete="off"
              aria-controls={`${id}-resultados`} aria-describedby={`${id}-estado-busqueda`}
              onChange={(event) => {
                consulta.current += 1;
                setBuscando(true);
                setResultados(null);
                setErrorBusqueda("");
                setPagina(1);
                setBusqueda(event.target.value);
              }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
          </div>
          <p id={`${id}-estado-busqueda`} role="status" className="text-xs text-muted-foreground">
            {buscando ? "Buscando clientes…" : resultados ? `${resultados.total} clientes encontrados.` : ""}
          </p>
          <div id={`${id}-resultados`} aria-label="Resultados de clientes" aria-busy={buscando}>
            {resultados ? <>
              {resultados.clientes.length === 0 ? <p className="text-sm">No se encontraron clientes.</p> :
                <div className="max-h-[min(15rem,32dvh)] overflow-y-auto overscroll-contain rounded-lg p-1 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Listado de clientes">
                  <div className={cuadricula}>
                    {resultados.clientes.map((cliente) => <button key={cliente.id} type="button" disabled={!cliente.activo} onClick={() => void elegir(cliente.id)}
                      className="min-w-0 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-50">
                      <span className="block break-words font-semibold">{cliente.nombre}</span>
                      <span className="block break-words text-xs text-muted-foreground">{cliente.telefono || "Sin teléfono"}{!cliente.activo ? " · Inactivo" : ""}</span>
                    </button>)}
                  </div>
                </div>}
              {resultados.total > 0 ? <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={pagina === 1} onClick={() => cambiarPagina(pagina - 1)}>Anterior</button>
                <span>Página {pagina} de {Math.ceil(resultados.total / resultados.porPagina)}</span>
                <button type="button" className={buttonVariants({ variant: "secondary", size: "sm" })} disabled={pagina * resultados.porPagina >= resultados.total} onClick={() => cambiarPagina(pagina + 1)}>Siguiente</button>
              </div> : null}
            </> : null}
          </div>
          {errorBusqueda ? <div>
            <p role="alert" className="text-sm text-destructive">{errorBusqueda}</p>
            <button type="button" className="mt-1 text-sm underline" onClick={() => setIntento((valor) => valor + 1)}>Reintentar búsqueda</button>
          </div> : null}
        </div>
      </div>
    </div>
    {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
    {cargando ? <div className="mt-3 text-sm" role="status">Cargando cliente, ubicaciones y saldo… <button type="button" onClick={limpiar} className="underline">Cancelar selección</button></div> : null}
    {seleccion ? <div className="mt-3 rounded-xl border border-border bg-muted/40 p-3">
      <fieldset className="min-w-0">
        <legend className="px-1 text-sm font-semibold">Ubicación de entrega</legend>
        {seleccion.ubicaciones.length === 0 ? <p role="status" className="mt-2 text-sm">Debes registrar una ubicación de entrega activa en la ficha del cliente antes de crear un pedido con despacho.</p> : <>
          <div className={`mt-2 ${cuadricula}`}>
            {aceptacion?.ubicacionId && seleccion.cliente.id === aceptacion.entrega.clienteId
              && !seleccion.ubicaciones.some((item) => item.id === aceptacion.ubicacionId)
              ? <label className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-sm font-medium has-checked:border-primary has-checked:bg-primary/10">
                <input type="radio" name={`${id}-ubicacion`} checked={ubicacionId === aceptacion.ubicacionId}
                  onChange={() => setUbicacionId(aceptacion.ubicacionId ?? "")} className="mt-0.5 shrink-0 accent-primary" />
                <span>Conservar ubicación del pedido recibido</span>
              </label> : null}
            {seleccion.ubicaciones.map((item) => {
              const elegida = ubicacionId === item.id;
              const idTarjeta = `${id}-ubicacion-${item.id}`;
              const direccion = [item.direccion, item.comuna, item.region].filter(Boolean).join(" · ");
              return <label key={item.id} className="flex min-w-0 cursor-pointer items-start gap-2 rounded-lg border border-border bg-background p-2.5 text-sm transition-colors hover:border-primary/50 has-checked:border-primary has-checked:bg-primary/10 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring">
                <input type="radio" name={`${id}-ubicacion`} value={item.id} checked={elegida} onChange={() => setUbicacionId(item.id)}
                  className="sr-only" aria-labelledby={`${idTarjeta}-nombre`} aria-describedby={direccion ? `${idTarjeta}-direccion` : undefined} />
                <span className={`flex size-6 shrink-0 items-center justify-center rounded-md ${elegida ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {elegida ? <Check className="size-4" aria-hidden="true" /> : <MapPin className="size-4" aria-hidden="true" />}
                </span>
                <span className="min-w-0 space-y-0.5 break-words">
                  <span id={`${idTarjeta}-nombre`} className="block font-semibold">
                    {item.nombre_ubicacion ?? item.nombre ?? "Ubicación sin nombre"}{item.es_principal ? " · Principal" : ""}
                  </span>
                  {direccion ? <span id={`${idTarjeta}-direccion`} className="block text-xs text-muted-foreground">{direccion}</span> : null}
                  {elegida && item.latitud !== null && item.longitud !== null ? <span className="block text-xs text-muted-foreground">Coordenadas: {item.latitud}, {item.longitud}</span> : null}
                  {elegida && item.referencia ? <span className="block text-xs text-muted-foreground">Referencia: {item.referencia}</span> : null}
                </span>
              </label>;
            })}
          </div>
          {seleccion.ubicaciones.length > 1 && !ubicacion ? <p className="mt-2 text-xs text-muted-foreground">Elige explícitamente una ubicación para continuar.</p> : null}
          {ubicacionId ? <button type="button" onClick={() => setUbicacionId("")} className="mt-2 text-xs text-muted-foreground underline underline-offset-2">Quitar selección de ubicación</button> : null}
          <input type="hidden" name="ubicacion_comercial_id" value={ubicacionId} />
        </>}
        {aceptacion && !ubicacionModificada ? <p className="mt-2 text-xs text-muted-foreground">Ubicación del pedido recibido: {aceptacion.entrega.ubicacionResumen || "Sin ubicación registrada"}.</p> : null}
      </fieldset>
      <input type="hidden" name="cliente_id" value={seleccion.cliente.id} />
    </div> : aceptacion && !ubicacionModificada ? <p className="mt-3 text-sm">Ubicación del pedido recibido: {aceptacion.entrega.ubicacionResumen || "Sin ubicación registrada"}.</p> : null}
  </section>
    <OrderProductSelection
      inicial={precarga}
      fechaSolicitada={solicitud?.fechaEntrega}
      aceptacion={aceptacion}
      ubicacionModificada={ubicacionModificada}
      clienteId={!cargando ? seleccion?.cliente.id : undefined}
      ubicacionId={ubicacion?.id}
      referenciasEntrega={aceptacion ? {
        clienteId: clienteIdElegido,
        ubicacionId: ubicacionModificada ? ubicacion?.id ?? null : aceptacion.entrega.ubicacionId,
      } : undefined}
      ubicacionValida={pasoClienteValido}
      clienteNombre={aceptacion && !clienteModificado ? aceptacion.entrega.clienteNombre : seleccion?.cliente.nombre}
      ubicacionResumen={aceptacion && !ubicacionModificada ? aceptacion.entrega.ubicacionResumen : ubicacionResumen}
    />
  </>;
}
