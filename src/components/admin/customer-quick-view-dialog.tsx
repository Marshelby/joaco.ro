"use client";

import { Dialog } from "@base-ui/react/dialog";
import { ExternalLink, X } from "lucide-react";
import { useState, useTransition } from "react";

import { obtenerVistaRapidaClienteAdmin, type ResultadoVistaRapidaClienteAdmin } from "@/app/(admin)/admin/clientes/actions";
import { ActionLink } from "@/components/ui/action-link";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/routes";
import { describirSaldoCuenta } from "@/lib/account-balance";
import { formatCLP, formatDateTimeCL } from "@/lib/formatters";

type CustomerQuickViewDialogProps = {
  clienteId: string;
  nombre: string;
};

type Vista = { estado: "inicial" | "cargando" } | ResultadoVistaRapidaClienteAdmin;

export function CustomerQuickViewDialog({ clienteId, nombre }: CustomerQuickViewDialogProps) {
  const [abierto, setAbierto] = useState(false);
  const [vista, setVista] = useState<Vista>({ estado: "inicial" });
  const [, iniciarTransicion] = useTransition();

  function cargarCliente() {
    setVista({ estado: "cargando" });
    iniciarTransicion(async () => {
      setVista(await obtenerVistaRapidaClienteAdmin(clienteId));
    });
  }

  function cambiarAbierto(siguienteAbierto: boolean) {
    setAbierto(siguienteAbierto);
    if (siguienteAbierto) cargarCliente();
    else setVista({ estado: "inicial" });
  }

  return (
    <Dialog.Root open={abierto} onOpenChange={cambiarAbierto}>
      <Dialog.Trigger type="button" className="cursor-pointer text-left text-sm text-primary underline underline-offset-4 outline-none transition-colors hover:text-primary/75 focus-visible:ring-3 focus-visible:ring-ring/50">
        {nombre}
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Backdrop className="motion-dialog-backdrop fixed inset-0 z-50 bg-foreground/25" />
        <Dialog.Viewport className="fixed inset-0 z-50 flex items-end justify-center p-2 sm:items-center sm:p-4">
          <Dialog.Popup className="motion-dialog-content max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-y-auto rounded-2xl border border-border bg-card p-5 shadow-xl outline-none sm:max-h-[85vh] sm:p-6">
            <div className="sticky top-0 z-10 -mx-5 -mt-5 flex items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:-mx-6 sm:-mt-6 sm:px-6">
              <div>
                <Dialog.Title className="text-lg font-semibold tracking-tight text-foreground">Cliente</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">Consulta rápida de información administrativa.</Dialog.Description>
              </div>
              <Dialog.Close type="button" className="inline-flex size-11 shrink-0 items-center justify-center rounded-lg text-foreground outline-none transition-[background-color,transform] duration-[var(--motion-fast)] ease-[var(--motion-ease-standard)] hover:bg-muted active:translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Cerrar">
                <X className="size-5" aria-hidden="true" />
              </Dialog.Close>
            </div>

            <div className="pt-5 sm:pt-6">
              {vista.estado === "inicial" || vista.estado === "cargando" ? <CustomerQuickViewSkeleton /> : null}
              {vista.estado === "error" ? <CustomerQuickViewError onRetry={cargarCliente} /> : null}
              {vista.estado === "no_encontrado" ? <p role="status" className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">Este cliente ya no está disponible.</p> : null}
              {vista.estado === "listo" ? <CustomerQuickViewContent cliente={vista.cliente} /> : null}
            </div>
          </Dialog.Popup>
        </Dialog.Viewport>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function CustomerQuickViewSkeleton() {
  return <div aria-busy="true" aria-label="Cargando cliente" className="space-y-5"><section className="space-y-3 rounded-xl border border-border p-4"><Skeleton className="h-6 w-48" /><div className="grid gap-3 sm:grid-cols-3"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div></section><section className="space-y-3 rounded-xl border border-border p-4"><Skeleton className="h-5 w-40" /><Skeleton className="h-8 w-28" /><Skeleton className="h-5 w-3/4" /></section><section className="space-y-3 rounded-xl border border-border p-4"><Skeleton className="h-5 w-32" />{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-12 w-full" />)}</section></div>;
}

function CustomerQuickViewError({ onRetry }: { onRetry: () => void }) {
  return <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-4"><p className="text-sm text-destructive">No pudimos cargar la información del cliente.</p><button type="button" onClick={onRetry} className="mt-3 min-h-11 rounded-lg px-3 text-sm font-semibold text-primary outline-none transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50">Reintentar</button></div>;
}

function etiquetaEstado(estado: string) {
  return estado.replaceAll("_", " ").replace(/\b\w/g, (caracter) => caracter.toUpperCase());
}

function CustomerQuickViewContent({ cliente }: { cliente: Extract<ResultadoVistaRapidaClienteAdmin, { estado: "listo" }>["cliente"] }) {
  const saldo = describirSaldoCuenta(cliente.saldoActual);

  return <div className="space-y-5"><section className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-semibold tracking-tight text-foreground">{cliente.nombre}</h2><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{cliente.activo ? "Activo" : "Inactivo"}</span></div><dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3"><div><dt className="text-muted-foreground">Email</dt><dd className="mt-1 break-words text-foreground">{cliente.email ?? "Sin email"}</dd></div><div><dt className="text-muted-foreground">Teléfono</dt><dd className="mt-1 text-foreground">{cliente.telefono ?? "Sin teléfono"}</dd></div><div><dt className="text-muted-foreground">Acceso web</dt><dd className="mt-1 text-foreground">{cliente.usuarioId ? "Activo" : "Sin acceso"}</dd></div></dl></section><section className="rounded-xl border border-border p-4"><h2 className="text-lg font-semibold tracking-tight text-foreground">Resumen de cuenta</h2><div className="mt-4 grid gap-4 sm:grid-cols-3"><div><p className="text-sm text-muted-foreground">Saldo actual</p><p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{formatCLP(saldo.monto)}</p><p className="mt-1 text-sm font-medium text-foreground">{saldo.texto}</p></div><div><p className="text-sm text-muted-foreground">Pedidos</p><p className="mt-1 font-semibold text-foreground">{formatCLP(cliente.totalPedidos)}</p></div><div><p className="text-sm text-muted-foreground">Pagos confirmados</p><p className="mt-1 font-semibold text-foreground">{formatCLP(cliente.totalPagosConfirmados)}</p></div></div></section><section className="rounded-xl border border-border p-4"><h2 className="text-lg font-semibold tracking-tight text-foreground">Actividad reciente</h2><div className="mt-4 grid gap-5 lg:grid-cols-2"><div><h3 className="text-sm font-semibold text-foreground">Pedidos</h3>{cliente.pedidos.length > 0 ? <ul className="mt-2 space-y-2">{cliente.pedidos.map((pedido) => <li key={pedido.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm"><div><p className="font-medium text-foreground">{pedido.numeroPedido}</p><p className="mt-0.5 text-muted-foreground">{formatDateTimeCL(pedido.fechaCreacion)}</p></div><div className="flex items-center gap-2"><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{etiquetaEstado(pedido.estado)}</span><span className="font-semibold text-foreground">{formatCLP(pedido.total)}</span></div></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin pedidos registrados.</p>}</div><div><h3 className="text-sm font-semibold text-foreground">Movimientos</h3>{cliente.movimientos.length > 0 ? <ul className="mt-2 space-y-2">{cliente.movimientos.map((movimiento) => <li key={`${movimiento.tipo}:${movimiento.id}`} className="rounded-lg bg-muted/50 px-3 py-2 text-sm"><p className="font-medium text-foreground">{movimiento.referencia}</p><p className="mt-0.5 text-muted-foreground">{movimiento.concepto}</p><p className="mt-1 font-semibold text-foreground">{movimiento.cargo > 0 ? `+${formatCLP(movimiento.cargo)}` : `-${formatCLP(movimiento.abono)}`}</p></li>)}</ul> : <p className="mt-2 text-sm text-muted-foreground">Sin movimientos registrados.</p>}</div></div></section><ActionLink href={ROUTES.adminCustomer(cliente.id)} variant="quiet" className="-ml-3"><ExternalLink className="size-4" aria-hidden="true" />Abrir ficha completa</ActionLink></div>;
}
