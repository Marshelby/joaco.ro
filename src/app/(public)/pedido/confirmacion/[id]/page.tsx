import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderStatusBadge } from "@/components/admin/order-status-badge";
import { Container } from "@/components/layout/container";
import { OrderConfirmationSuccess } from "@/components/order/order-confirmation-success";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";
import { formatearCantidadPedido, type EstadoPedidoAdmin } from "@/lib/admin/pedidos";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { getGoogleMapsLocationUrl } from "@/lib/maps";
import { ExternalLink } from "lucide-react";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Pedido recibido" };

type ItemConfirmacion = { id: string; nombre_producto_snapshot: string; nombre_presentacion_snapshot: string | null; unidad_snapshot: string; cantidad: number | string; total_linea: number | string };
type PedidoConfirmacion = { numero_pedido: string; estado: EstadoPedidoAdmin; fecha_creacion: string; fecha_entrega: string | null; total: number | string; direccion_snapshot: string | null; comuna_snapshot: string | null; region_snapshot: string | null; destinatario_entrega_snapshot: string | null; zona_entrega_snapshot: string | null; latitud_entrega_snapshot: number | string | null; longitud_entrega_snapshot: number | string | null; items_pedido: ItemConfirmacion[] };

export default async function OrderConfirmationPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ nuevo?: string }> }) {
  const { id } = await params;
  const { nuevo } = await searchParams;
  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase
    .from("pedidos")
    .select("numero_pedido,estado,fecha_creacion,fecha_entrega,total,direccion_snapshot,comuna_snapshot,region_snapshot,destinatario_entrega_snapshot,zona_entrega_snapshot,latitud_entrega_snapshot,longitud_entrega_snapshot,items_pedido(id,nombre_producto_snapshot,nombre_presentacion_snapshot,unidad_snapshot,cantidad,total_linea)")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  if (!data) notFound();
  const pedido = data as unknown as PedidoConfirmacion;
  const direccion = [pedido.direccion_snapshot, pedido.comuna_snapshot, pedido.region_snapshot].filter(Boolean).join(", ");
  const mapsUrl = getGoogleMapsLocationUrl(pedido.latitud_entrega_snapshot === null ? null : Number(pedido.latitud_entrega_snapshot), pedido.longitud_entrega_snapshot === null ? null : Number(pedido.longitud_entrega_snapshot));

  return <Container className="py-10 sm:py-16"><div className="mx-auto max-w-2xl space-y-6"><header className="rounded-2xl border border-primary/20 bg-card p-6 sm:p-8"><OrderConfirmationSuccess pedidoId={id} reproducirSonido={nuevo === "1"} /><p className="mt-5 text-sm font-semibold text-primary">Pedido enviado correctamente</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">¡Pedido recibido!</h1><p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{pedido.numero_pedido}</p><div className="mt-4"><OrderStatusBadge estado={pedido.estado} /></div><p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">Recibimos tu pedido correctamente. Lo revisaremos y te avisaremos cuando sea confirmado.</p>{pedido.fecha_entrega ? <div className="mt-5 rounded-xl bg-primary/8 p-4"><p className="text-sm text-muted-foreground">Entrega programada</p><p className="mt-1 font-semibold text-foreground">{formatFechaEntregaLarga(pedido.fecha_entrega)}</p></div> : null}</header><section className="rounded-xl border border-border bg-card p-5"><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Fecha de creación</dt><dd className="mt-1 font-medium text-foreground">{formatDateTimeCL(pedido.fecha_creacion)}</dd></div><div><dt className="text-muted-foreground">Total</dt><dd className="mt-1 text-lg font-semibold text-foreground">{formatCLP(Number(pedido.total))}</dd></div>{pedido.destinatario_entrega_snapshot ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Destinatario</dt><dd className="mt-1 font-medium text-foreground">{pedido.destinatario_entrega_snapshot}</dd></div> : null}{direccion ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Dirección de entrega</dt><dd className="mt-1 text-foreground">{direccion}</dd></div> : null}{pedido.zona_entrega_snapshot ? <div className="sm:col-span-2"><dt className="text-muted-foreground">Zona</dt><dd className="mt-1 text-foreground">{pedido.zona_entrega_snapshot}</dd></div> : null}</dl>{mapsUrl ? <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-primary underline underline-offset-4"><ExternalLink className="size-4" aria-hidden="true" />Ver ubicación</a> : null}</section><section className="rounded-xl border border-border bg-card p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Productos</h2><ul className="mt-3 divide-y divide-border">{pedido.items_pedido.map((item) => <li key={item.id} className="flex items-start justify-between gap-4 py-3"><div className="min-w-0"><p className="font-medium text-foreground">{item.nombre_producto_snapshot}</p><p className="mt-1 text-sm text-muted-foreground">{item.nombre_presentacion_snapshot ?? item.unidad_snapshot} · {formatearCantidadPedido(Number(item.cantidad), item.unidad_snapshot)}</p></div><p className="shrink-0 font-semibold text-foreground">{formatCLP(Number(item.total_linea))}</p></li>)}</ul></section><div className="flex flex-wrap gap-3"><ActionLink href={ROUTES.catalog}>Seguir comprando</ActionLink><ActionLink href={ROUTES.accountOrders} variant="secondary">Ver mis pedidos</ActionLink></div></div></Container>;
}
