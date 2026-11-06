"use client";

import { useOrderStep, useOrderWizard } from "@/components/admin/order-wizard";
import { OrderProductSelection } from "@/components/admin/order-product-selection";
import { useEffect, useRef, useState } from "react";
import { buscarClientesPedido, cargarClientePedido } from "@/app/(admin)/admin/pedidos/nuevo/actions";
import { describirSaldoCuenta } from "@/lib/account-balance";
import { formatCLP } from "@/lib/formatters";
import { buttonVariants } from "@/components/ui/button";

type Seleccion = Awaited<ReturnType<typeof cargarClientePedido>>;
type Resultados = Awaited<ReturnType<typeof buscarClientesPedido>>;
const campo = "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";

export function OrderCustomerSelection({ inicial }: { inicial: Seleccion | null }) {
  const [seleccion, setSeleccion] = useState(inicial);
  const [ubicacionId, setUbicacionId] = useState(inicial?.ubicaciones.length === 1 ? inicial.ubicaciones[0].id : "");
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
  const ubicacion = seleccion?.ubicaciones.find((item) => item.id === ubicacionId);
  const saldo = seleccion ? describirSaldoCuenta(seleccion.saldoActual) : null;

  const { activo } = useOrderWizard();
  useOrderStep(0, Boolean(seleccion && ubicacion && !cargando), cargando ? "Espera a que termine la carga del cliente." : !seleccion ? "Selecciona un cliente activo para continuar." : "Selecciona una ubicación comercial activa para continuar.");

  function limpiar() {
    carga.current += 1;
    setSeleccion(null);
    setUbicacionId("");
    setCargando(false);
    setError("");
  }

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
      setSeleccion(respuesta);
      setUbicacionId(respuesta.ubicaciones.length === 1 ? respuesta.ubicaciones[0].id : "");
    } catch {
      if (version === carga.current) setError("No fue posible cargar el cliente activo, sus ubicaciones y saldo. Intenta nuevamente.");
    } finally {
      if (version === carga.current) setCargando(false);
    }
  }

  return <><section hidden={activo !== 0} id="cliente" aria-labelledby="cliente-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 id="cliente-titulo" className="text-xl font-semibold">1. Cliente y ubicación comercial</h2>
    <p className="mt-2 text-sm text-muted-foreground">Busca por nombre, teléfono o correo, incluidos clientes sin acceso a la plataforma.</p>
    <label className="mt-4 block text-sm font-medium" htmlFor="buscar-cliente">Buscar cliente</label>
    <input id="buscar-cliente" type="search" className={campo} value={busqueda} maxLength={120}
      placeholder="Nombre, teléfono o correo electrónico" autoComplete="off"
      aria-controls="resultados-clientes-pedido" aria-describedby="estado-busqueda-cliente"
      onChange={(event) => {
        consulta.current += 1;
        setBuscando(true);
        setResultados(null);
        setErrorBusqueda("");
        setPagina(1);
        setBusqueda(event.target.value);
      }} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
    <p id="estado-busqueda-cliente" role="status" aria-live="polite" className="mt-3 text-sm text-muted-foreground">
      {buscando ? "Buscando clientes…" : resultados ? `${resultados.total} clientes encontrados.` : ""}
    </p>
    <div id="resultados-clientes-pedido" aria-label="Resultados de clientes" aria-busy={buscando}>
      {resultados ? <>
        {resultados.clientes.length === 0 ? <p className="mt-3 text-sm">No se encontraron clientes.</p> : <div className="mt-4 max-h-80 space-y-2 overflow-y-auto overscroll-contain rounded-lg focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Listado de clientes">
          {resultados.clientes.map((cliente) => <button key={cliente.id} type="button" disabled={!cliente.activo} onClick={() => void elegir(cliente.id)} className="block w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted disabled:opacity-50">
            <span className="block break-words font-semibold">{cliente.nombre}</span>
            <span className="block">{cliente.telefono || "Sin teléfono"}{!cliente.activo ? " · Inactivo" : ""}</span>
          </button>)}
        </div>}
        {resultados.total > 0 ? <div className="mt-3 flex items-center gap-3 text-sm">
          <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={pagina === 1} onClick={() => cambiarPagina(pagina - 1)}>Anterior</button>
          <span>Página {pagina} de {Math.ceil(resultados.total / resultados.porPagina)}</span>
          <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={pagina * resultados.porPagina >= resultados.total} onClick={() => cambiarPagina(pagina + 1)}>Siguiente</button>
        </div> : null}
      </> : null}
    </div>
    {errorBusqueda ? <div className="mt-3">
      <p role="alert" className="text-sm text-destructive">{errorBusqueda}</p>
      <button type="button" className="mt-2 text-sm underline" onClick={() => setIntento((valor) => valor + 1)}>Reintentar búsqueda</button>
    </div> : null}
    {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
    {cargando ? <div className="mt-4" role="status">Cargando cliente, ubicaciones y saldo… <button type="button" onClick={limpiar} className="underline">Cancelar selección</button></div> : null}
    {seleccion ? <div className="mt-5 space-y-4">
      <div className="rounded-lg bg-muted/40 p-3 text-sm">
        <p className="font-semibold">{seleccion.cliente.nombre}</p>
        <p>{[seleccion.cliente.telefono, seleccion.cliente.email].filter(Boolean).join(" · ")}</p>
        <p className="mt-2">Cuenta corriente: {saldo?.texto} · {formatCLP(saldo?.monto ?? 0)}</p>
        <button type="button" onClick={limpiar} className="mt-2 underline">Cambiar cliente</button>
      </div>
      {seleccion.ubicaciones.length === 0 ? <p role="status" className="text-sm">Debes registrar una ubicación comercial activa en la ficha del cliente antes de crear un pedido con despacho.</p> : <>
        <label className="block text-sm font-medium">Ubicación comercial
          <select name="ubicacion_comercial_id" className={campo} value={ubicacionId} onChange={(event) => setUbicacionId(event.target.value)}>
            <option value="">Selecciona una ubicación comercial</option>
            {seleccion.ubicaciones.map((item) => <option key={item.id} value={item.id}>{item.nombre_ubicacion ?? item.nombre ?? "Ubicación sin nombre"}{item.es_principal ? " · Principal" : ""}</option>)}
          </select>
        </label>
        {seleccion.ubicaciones.length > 1 && !ubicacion ? <p className="text-sm text-muted-foreground">Elige explícitamente una ubicación para continuar.</p> : null}
        {ubicacion ? <div className="text-sm text-muted-foreground">
          <p>{ubicacion.nombre_ubicacion ?? ubicacion.nombre ?? "Ubicación sin nombre"}{ubicacion.es_principal ? " · Principal" : ""}</p>
          <p>{[ubicacion.direccion, ubicacion.comuna, ubicacion.region].filter(Boolean).join(" · ")}</p>
          {ubicacion.latitud !== null && ubicacion.longitud !== null ? <p>Coordenadas: {ubicacion.latitud}, {ubicacion.longitud}</p> : null}
          {ubicacion.referencia ? <p>Referencia: {ubicacion.referencia}</p> : null}
        </div> : null}
      </>}
      <input type="hidden" name="cliente_id" value={seleccion.cliente.id} />
    </div> : null}

  </section>
    <OrderProductSelection clienteId={!cargando ? seleccion?.cliente.id : undefined} ubicacionId={ubicacion?.id} clienteNombre={seleccion?.cliente.nombre} ubicacionResumen={ubicacion ? [ubicacion.nombre_ubicacion ?? ubicacion.nombre, ubicacion.direccion, ubicacion.comuna, ubicacion.region].filter(Boolean).join(" · ") : undefined} />
  </>;
}
