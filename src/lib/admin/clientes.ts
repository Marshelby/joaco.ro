import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import type { EstadoPedidoAdmin } from "@/lib/admin/pedidos";

export { describirSaldoCuenta } from "@/lib/account-balance";

export type ClienteAdminListado = {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
  saldoActual: number;
  cantidadPedidos: number;
  fechaUltimoMovimiento: string | null;
};

export type MovimientoCuentaCliente = {
  id: string;
  fecha: string;
  tipo: "pedido" | "pago" | "ajuste";
  referencia: string;
  concepto: string;
  cargo: number;
  abono: number;
  saldoAcumulado: number;
};

export type PedidoClienteAdmin = {
  id: string;
  numeroPedido: string;
  fechaCreacion: string;
  estado: EstadoPedidoAdmin;
  total: number;
  saldoPendiente: number;
};

export type PagoClienteAdmin = {
  id: string;
  monto: number;
  montoAplicado: number;
  montoDisponible: number;
  metodoPago: string;
  referencia: string | null;
  fechaPago: string;
  estado: "registrado" | "pendiente_verificacion" | "confirmado" | "anulado";
};

export type ClienteAdminDetalle = ClienteAdminListado & {
  totalPedidos: number;
  totalPagosConfirmados: number;
  totalAjustesCargo: number;
  totalAjustesAbono: number;
  movimientos: readonly MovimientoCuentaCliente[];
  pedidos: readonly PedidoClienteAdmin[];
  pagos: readonly PagoClienteAdmin[];
};

type ClienteFila = Pick<ClienteAdminListado, "id" | "nombre" | "telefono" | "email" | "activo">;
type SaldoFila = {
  cliente_id: string;
  total_pedidos: number | string;
  total_pagos_confirmados: number | string;
  total_ajustes_cargo: number | string;
  total_ajustes_abono: number | string;
  saldo_actual: number | string;
  cantidad_pedidos: number | string;
  fecha_ultimo_movimiento: string | null;
};
type MovimientoFila = {
  referencia_id: string;
  fecha: string;
  tipo_movimiento: MovimientoCuentaCliente["tipo"];
  referencia: string;
  concepto: string;
  cargo: number | string;
  abono: number | string;
  saldo_acumulado: number | string;
};
type PedidoFila = {
  id: string;
  numero_pedido: string;
  fecha_creacion: string;
  estado: EstadoPedidoAdmin;
  total: number | string;
};
type SaldoPedidoFila = { pedido_id: string; saldo_pendiente: number | string };
type PagoFila = { id: string; monto: number | string; metodo_pago: string; referencia: string | null; fecha_pago: string; estado: PagoClienteAdmin["estado"] };
type SaldoPagoFila = { pago_id: string; monto_aplicado: number | string; monto_disponible: number | string };

function mapSaldo(cliente: ClienteFila, saldo?: SaldoFila): ClienteAdminListado {
  return {
    ...cliente,
    saldoActual: Number(saldo?.saldo_actual ?? 0),
    cantidadPedidos: Number(saldo?.cantidad_pedidos ?? 0),
    fechaUltimoMovimiento: saldo?.fecha_ultimo_movimiento ?? null,
  };
}

export async function obtenerClientesAdmin(): Promise<ClienteAdminListado[]> {
  const supabase = await crearClienteSupabaseServidor();
  const [{ data: clientes, error: clientesError }, { data: saldos, error: saldosError }] = await Promise.all([
    supabase.from("clientes").select("id,nombre,telefono,email,activo"),
    supabase.from("v_saldos_cuenta_clientes").select("cliente_id,total_pedidos,total_pagos_confirmados,total_ajustes_cargo,total_ajustes_abono,saldo_actual,cantidad_pedidos,fecha_ultimo_movimiento"),
  ]);
  if (clientesError) throw clientesError;
  if (saldosError) throw saldosError;

  const saldosPorCliente = new Map((saldos as SaldoFila[] ?? []).map((saldo) => [saldo.cliente_id, saldo]));
  return (clientes as ClienteFila[] ?? [])
    .map((cliente) => mapSaldo(cliente, saldosPorCliente.get(cliente.id)))
    .sort((a, b) => Number(b.activo) - Number(a.activo) || Number(b.saldoActual > 0) - Number(a.saldoActual > 0) || a.nombre.localeCompare(b.nombre, "es-CL"));
}

export async function obtenerClienteAdmin(id: string): Promise<ClienteAdminDetalle | null> {
  const supabase = await crearClienteSupabaseServidor();
  const [clienteResultado, saldoResultado, movimientosResultado, pedidosResultado, saldosPedidosResultado, pagosResultado, saldosPagosResultado] = await Promise.all([
    supabase.from("clientes").select("id,nombre,telefono,email,activo").eq("id", id).maybeSingle(),
    supabase.from("v_saldos_cuenta_clientes").select("cliente_id,total_pedidos,total_pagos_confirmados,total_ajustes_cargo,total_ajustes_abono,saldo_actual,cantidad_pedidos,fecha_ultimo_movimiento").eq("cliente_id", id).maybeSingle(),
    supabase.from("v_movimientos_cuenta_cliente").select("referencia_id,fecha,tipo_movimiento,referencia,concepto,cargo,abono,saldo_acumulado").eq("cliente_id", id).order("fecha", { ascending: false }),
    supabase.from("pedidos").select("id,numero_pedido,fecha_creacion,estado,total").eq("cliente_id", id).order("fecha_creacion", { ascending: false }),
    supabase.from("v_saldos_pedidos").select("pedido_id,saldo_pendiente").eq("cliente_id", id),
    supabase.from("pagos").select("id,monto,metodo_pago,referencia,fecha_pago,estado").eq("cliente_id", id).order("fecha_pago", { ascending: false }),
    supabase.from("v_saldos_pagos").select("pago_id,monto_aplicado,monto_disponible").eq("cliente_id", id),
  ]);
  if (clienteResultado.error) throw clienteResultado.error;
  if (saldoResultado.error) throw saldoResultado.error;
  if (movimientosResultado.error) throw movimientosResultado.error;
  if (pedidosResultado.error) throw pedidosResultado.error;
  if (saldosPedidosResultado.error) throw saldosPedidosResultado.error;
  if (pagosResultado.error) throw pagosResultado.error;
  if (saldosPagosResultado.error) throw saldosPagosResultado.error;
  if (!clienteResultado.data) return null;

  const resumen = mapSaldo(clienteResultado.data as ClienteFila, (saldoResultado.data as SaldoFila | null) ?? undefined);
  const saldo = saldoResultado.data as SaldoFila | null;
  return {
    ...resumen,
    totalPedidos: Number(saldo?.total_pedidos ?? 0),
    totalPagosConfirmados: Number(saldo?.total_pagos_confirmados ?? 0),
    totalAjustesCargo: Number(saldo?.total_ajustes_cargo ?? 0),
    totalAjustesAbono: Number(saldo?.total_ajustes_abono ?? 0),
    movimientos: (movimientosResultado.data as MovimientoFila[] ?? []).map((movimiento) => ({
      id: movimiento.referencia_id,
      fecha: movimiento.fecha,
      tipo: movimiento.tipo_movimiento,
      referencia: movimiento.referencia,
      concepto: movimiento.concepto,
      cargo: Number(movimiento.cargo),
      abono: Number(movimiento.abono),
      saldoAcumulado: Number(movimiento.saldo_acumulado),
    })),
    pedidos: (pedidosResultado.data as PedidoFila[] ?? []).map((pedido) => ({
      id: pedido.id,
      numeroPedido: pedido.numero_pedido,
      fechaCreacion: pedido.fecha_creacion,
      estado: pedido.estado,
      total: Number(pedido.total),
      saldoPendiente: Number((saldosPedidosResultado.data as SaldoPedidoFila[] ?? []).find((saldoPedido) => saldoPedido.pedido_id === pedido.id)?.saldo_pendiente ?? 0),
    })),
    pagos: (pagosResultado.data as PagoFila[] ?? []).map((pago) => {
      const saldoPago = (saldosPagosResultado.data as SaldoPagoFila[] ?? []).find((saldo) => saldo.pago_id === pago.id);
      return { id: pago.id, monto: Number(pago.monto), montoAplicado: Number(saldoPago?.monto_aplicado ?? 0), montoDisponible: Number(saldoPago?.monto_disponible ?? 0), metodoPago: pago.metodo_pago, referencia: pago.referencia, fechaPago: pago.fecha_pago, estado: pago.estado };
    }),
  };
}
