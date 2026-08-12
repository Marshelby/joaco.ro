import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { Container } from "@/components/layout/container";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPedido, type EstadoPedidoAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pedido recibido" };

type ItemConfirmacion = { id: string; nombre_producto_snapshot: string; nombre_presentacion_snapshot: string | null; unidad_snapshot: string; cantidad: number | string; total_linea: number | string };
type PedidoConfirmacion = { numero_pedido: string; estado: EstadoPedidoAdmin; fecha_creacion: string; total: number | string; direccion_snapshot: string | null; comuna_snapshot: string | null; region_snapshot: string | null; items_pedido: ItemConfirmacion[] };

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("numero_pedido,estado,fecha_creacion,total,direccion_snapshot,comuna_snapshot,region_snapshot,items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,total_linea)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) notFound();
  const pedido = data as unknown as PedidoConfirmacion;
  const direccion = [pedido.direccion_snapshot, pedido.comuna_snapshot, pedido.region_snapshot].filter(Boolean).join(", ");

  return <Container className="py-10 sm:py-16"><div className="mx-auto max-w-2xl space-y-6"><header className="rounded-2xl border border-border bg-card p-6 sm:p-8"><p className="text-sm font-semibold text-accent">Pedido recibido</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{pedido.numero_pedido}</h1><div className="mt-4"><OrderStatusBadge estado={pedido.estado} /></div><p className="mt-4 text-sm leading-6 text-muted-foreground">Recibimos tu pedido y será revisado antes de confirmarlo.</p></header><section className="rounded-xl border border-border bg-card p-5"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Fecha</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fecha_creacion)}</dd></div><div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 text-lg font-semibold text-foreground">{formatCLP(Number(pedido.total))}</dd></div>{direccion ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Dirección de entrega</dt><dd className="mt-1 text-foreground">{direccion}</dd></div> : null}</dl></section><section className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen</h2><ul className="mt-3 divide-y divide-border">{pedido.items_pedido.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 py-3"><div><p className="font-medium text-foreground">{item.nombre_producto_snapshot}</p><p className="mt-1 text-sm text-muted-foreground">{item.nombre_presentacion_snapshot ?? item.unidad_snapshot} · {formatearCantidadPedido(Number(item.cantidad), item.unidad_snapshot)}</p></div><p className="shrink-0 font-semibold text-foreground">{formatCLP(Number(item.total_linea))}</p></li>)}</ul></section><div className="flex flex-wrap gap-3"><ActionLink href={ROUTES.catalog}>Volver al catálogo</ActionLink><ActionLink href={ROUTES.cart} variant="secondary">Ver carrito</ActionLink></div></div></Container>;
}
