"use client";

import Link from "next/link";
import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { crearPedidoCheckout } from "@/app/(public)/checkout/actions";
import { useCart } from "@/components/cart/cart-provider";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { formatCartQuantity, getCartLineSubtotal, isFractionalKgItem } from "@/lib/cart-quantity";
import { formatCLP } from "@/lib/formatters";
import type { FechaEntregaDisponible } from "@/types/delivery";

type DireccionCheckout = { id: string; nombre: string | null; destinatario: string | null; direccion: string; comuna: string; region: string; referencia: string | null; latitud: number | null; longitud: number | null; zonas_entrega: { nombre: string }[] };
type ClienteCheckout = { nombre: string; telefono: string | null; email: string | null };

export function CheckoutContent({ claveIdempotencia, cliente, direcciones, fechasEntrega, tieneSesion }: { claveIdempotencia: string; cliente: ClienteCheckout | null; direcciones: readonly DireccionCheckout[]; fechasEntrega: readonly FechaEntregaDisponible[]; tieneSesion: boolean }) {
  const router = useRouter();
  const { items, totalEstimado, isHydrated, vaciar } = useCart();
  const direccionesConUbicacion = direcciones.filter((direccion) => Number.isFinite(direccion.latitud) && Number.isFinite(direccion.longitud));
  const [direccionClienteId, setDireccionClienteId] = useState(direccionesConUbicacion[0]?.id ?? "");
  const [fechaEntrega, setFechaEntrega] = useState("");
  const [estado, accion, pendiente] = useActionState(crearPedidoCheckout, {});

  useEffect(() => {
    if (!estado.pedidoId) return;
    vaciar();
    router.replace(`${ROUTES.orderConfirmation(estado.pedidoId)}?nuevo=1`);
  }, [estado.pedidoId, router, vaciar]);

  const itemsRpc = useMemo(() => items.map((item) => ({ presentacion_id: item.presentacionId, cantidad: item.cantidad })), [items]);
  const carritoValido = itemsRpc.length > 0 && itemsRpc.every((item) => item.presentacion_id.trim().length > 0 && Number.isFinite(item.cantidad));

  if (!isHydrated) return <p className="text-sm text-muted-foreground">Cargando tu pedido…</p>;

  if (items.length === 0) {
    return <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12"><h1 className="text-2xl font-semibold tracking-tight text-foreground">No hay productos para continuar</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Agrega productos al carrito antes de confirmar un pedido.</p><Button render={<Link href={ROUTES.catalog} />} className="mt-6">Ver catálogo</Button></section>;
  }

  if (!tieneSesion || !cliente) {
    const mensaje = tieneSesion ? "No tienes una cuenta de cliente habilitada para realizar pedidos." : "Inicia sesión con tu cuenta de cliente para confirmar el pedido.";
    return <section className="rounded-2xl border border-dashed border-border bg-card p-8 text-center sm:p-12"><h1 className="text-2xl font-semibold tracking-tight text-foreground">No podemos confirmar tu pedido</h1><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{mensaje}</p>{!tieneSesion ? <Button render={<Link href="/iniciar-sesion" />} className="mt-6">Iniciar sesión</Button> : null}</section>;
  }

  return (
    <form action={accion} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-8">
      <input type="hidden" name="items" value={JSON.stringify(itemsRpc)} />
      <input type="hidden" name="claveIdempotencia" value={claveIdempotencia} />
      <input type="hidden" name="fechaEntrega" value={fechaEntrega} />
      <section className="space-y-6">
        <header><h1 className="text-3xl font-semibold tracking-tight text-foreground">Confirmar pedido</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Tus precios y disponibilidad se validarán al enviar el pedido.</p></header>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Cliente</h2><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Nombre</dt><dd className="mt-1 font-medium text-foreground">{cliente.nombre}</dd></div><div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{cliente.telefono ?? "Sin teléfono registrado"}</dd></div><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{cliente.email ?? "Sin email registrado"}</dd></div></dl></section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><h2 className="text-lg font-semibold tracking-tight text-foreground">Dirección de entrega</h2>{direcciones.length > 0 ? <><label htmlFor="direccionClienteId" className="mt-4 block text-sm font-medium text-foreground">Selecciona una dirección</label><select required id="direccionClienteId" name="direccionClienteId" value={direccionClienteId} onChange={(event) => setDireccionClienteId(event.target.value)} className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><option value="" disabled>Selecciona una dirección con ubicación marcada</option>{direcciones.map((direccion) => { const tieneUbicacion = Number.isFinite(direccion.latitud) && Number.isFinite(direccion.longitud); return <option key={direccion.id} value={direccion.id} disabled={!tieneUbicacion}>{[direccion.destinatario ?? direccion.nombre, direccion.direccion, direccion.zonas_entrega[0]?.nombre ?? direccion.comuna].filter(Boolean).join(" · ")}{tieneUbicacion ? "" : " — Completa la ubicación antes de usarla"}</option>; })}</select>{direccionesConUbicacion.length === 0 ? <p role="alert" className="mt-3 text-sm leading-6 text-destructive">Completa la ubicación de una dirección antes de confirmar el pedido. <Link href={`${ROUTES.accountAddresses}?returnTo=${encodeURIComponent(ROUTES.checkout)}`} className="font-medium underline underline-offset-4">Editar dirección</Link></p> : null}</> : <p className="mt-3 text-sm leading-6 text-destructive">Necesitas una dirección con ubicación marcada para confirmar el pedido. <Link href={`${ROUTES.newCustomerAddress}?returnTo=${encodeURIComponent(ROUTES.checkout)}`} className="font-medium underline underline-offset-4">Agregar dirección</Link></p>}</section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5" aria-labelledby="fecha-entrega-title"><h2 id="fecha-entrega-title" className="text-lg font-semibold tracking-tight text-foreground">Fecha de entrega</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">Elige cuándo quieres recibir tu pedido.</p>{fechasEntrega.length > 0 ? <div className="mt-4 flex flex-wrap gap-2">{fechasEntrega.map((opcion) => <button key={opcion.fecha} type="button" aria-pressed={fechaEntrega === opcion.fecha} onClick={() => setFechaEntrega(opcion.fecha)} className={`min-h-11 rounded-lg border px-3 py-2 text-left text-sm font-medium outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 ${fechaEntrega === opcion.fecha ? "border-primary bg-primary text-primary-foreground" : "border-input bg-background text-foreground hover:bg-muted"}`}><span className="block">{opcion.etiqueta}</span></button>)}</div> : <p role="alert" className="mt-4 text-sm leading-6 text-destructive">No hay fechas de entrega disponibles por ahora.</p>}{fechaEntrega ? <p className="mt-3 text-sm leading-6 text-muted-foreground">{fechasEntrega.find((opcion) => opcion.fecha === fechaEntrega)?.textoCorte}</p> : fechasEntrega.length > 0 ? <p className="mt-3 text-sm text-muted-foreground">Selecciona una fecha para continuar.</p> : null}</section>
        <section className="rounded-xl border border-border bg-card p-4 sm:p-5"><label htmlFor="observacion" className="text-lg font-semibold tracking-tight text-foreground">Observación</label><textarea id="observacion" name="observacion" rows={4} placeholder="Información adicional para revisar el pedido" className="mt-4 w-full rounded-lg border border-input bg-background p-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-3 focus-visible:ring-ring/50" /></section>
      </section>
      <aside className="rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-6"><h2 className="text-lg font-semibold text-foreground">Resumen del pedido</h2><ul className="mt-4 divide-y divide-border">{items.map((item) => <li key={`${item.productoId}:${item.presentacionId}`} className="py-3 first:pt-0"><div className="flex justify-between gap-3"><div className="min-w-0"><p className="text-sm font-medium text-foreground">{item.nombre}</p><p className="mt-1 text-xs text-muted-foreground">{item.presentacionNombre} · {formatCartQuantity(item, item.cantidad)}</p><p className="mt-1 text-xs text-muted-foreground">{formatCLP(item.precioFinalReferencia)} {isFractionalKgItem(item) ? "por kg" : "por presentación"}</p></div><p className="shrink-0 text-sm font-semibold text-foreground">{formatCLP(getCartLineSubtotal(item))}</p></div></li>)}</ul><div className="mt-4 flex items-end justify-between gap-4 border-y border-border py-4"><span className="text-sm font-medium text-muted-foreground">Total estimado</span><strong className="text-2xl tracking-tight text-foreground">{formatCLP(totalEstimado)}</strong></div><p className="mt-3 text-xs leading-5 text-muted-foreground">El total definitivo se calcula con los precios vigentes al confirmar.</p><Button type="submit" disabled={pendiente || !claveIdempotencia || !carritoValido || !direccionClienteId || !fechaEntrega || fechasEntrega.length === 0} className="mt-5 w-full">{pendiente ? "Confirmando…" : "Confirmar pedido"}</Button><p aria-live="polite" className="mt-3 text-sm text-destructive">{estado.error ?? ""}</p></aside>
    </form>
  );
}
