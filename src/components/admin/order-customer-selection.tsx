"use client";

import { OrderProductSelection } from "@/components/admin/order-product-selection";
import { useRef, useState } from "react";
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
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const carga = useRef(0);
  const consulta = useRef(0);
  const ubicacion = seleccion?.ubicaciones.find((item) => item.id === ubicacionId);
  const saldo = seleccion ? describirSaldoCuenta(seleccion.saldoActual) : null;

  function limpiar() {
    carga.current += 1;
    setSeleccion(null);
    setUbicacionId("");
    setCargando(false);
    setError("");
  }

  async function buscar(numero = 1) {
    const version = ++consulta.current;
    setBuscando(true);
    setResultados(null);
    setError("");
    try {
      const respuesta = await buscarClientesPedido(busqueda.trim(), numero);
      if (version !== consulta.current) return;
      setResultados(respuesta);
      setPagina(numero);
    } catch {
      if (version === consulta.current) setError("No fue posible buscar clientes. Intenta nuevamente.");
    } finally {
      if (version === consulta.current) setBuscando(false);
    }
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

  return <><section id="cliente" aria-labelledby="cliente-titulo" className="scroll-mt-6 rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 id="cliente-titulo" className="text-xl font-semibold">1. Cliente y ubicación comercial</h2>
    <p className="mt-2 text-sm text-muted-foreground">Busca por nombre, teléfono o correo, incluidos clientes sin acceso a la plataforma.</p>
    <label className="mt-4 block text-sm font-medium" htmlFor="buscar-cliente">Buscar cliente</label>
    <div className="flex items-end gap-2">
      <input id="buscar-cliente" className={campo} value={busqueda} maxLength={120} onChange={(event) => {
        consulta.current += 1;
        setBuscando(false);
        setResultados(null);
        setBusqueda(event.target.value);
      }} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void buscar(); } }} />
      <button type="button" className={buttonVariants({ variant: "secondary" })} disabled={buscando} onClick={() => void buscar()}>Buscar</button>
    </div>
    {buscando ? <p role="status" className="mt-3 text-sm">Buscando clientes…</p> : null}
    {resultados ? <div className="mt-4 space-y-2" aria-label="Resultados de clientes">
      <p className="text-sm text-muted-foreground">{resultados.total} clientes encontrados.</p>
      {resultados.clientes.map((cliente) => <button key={cliente.id} type="button" disabled={!cliente.activo} onClick={() => void elegir(cliente.id)} className="block w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted disabled:opacity-50">
        <span className="font-semibold">{cliente.nombre}</span> · {[cliente.telefono, cliente.email].filter(Boolean).join(" · ")}{!cliente.activo ? " · Inactivo" : ""}
      </button>)}
      <div className="flex items-center gap-3 text-sm">
        {pagina > 1 ? <button type="button" onClick={() => void buscar(pagina - 1)}>Anterior</button> : null}
        <span>Página {pagina}</span>
        {pagina * resultados.porPagina < resultados.total ? <button type="button" onClick={() => void buscar(pagina + 1)}>Siguiente</button> : null}
      </div>
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
    <button type="button" className={`${buttonVariants()} mt-5`} disabled={!seleccion || !ubicacion || cargando} onClick={() => document.getElementById("productos-titulo")?.focus()}>Continuar a productos</button>
  </section>
    <OrderProductSelection clienteId={!cargando ? seleccion?.cliente.id : undefined} ubicacionId={ubicacion?.id} clienteNombre={seleccion?.cliente.nombre} ubicacionResumen={ubicacion ? [ubicacion.nombre_ubicacion ?? ubicacion.nombre, ubicacion.direccion, ubicacion.comuna, ubicacion.region].filter(Boolean).join(" · ") : undefined} />
  </>;
}
