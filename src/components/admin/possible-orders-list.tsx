import { OrderDeliveryDateGroups } from "@/components/admin/order-delivery-date-groups";
import Link from "next/link";
import { CalendarDays, ClipboardList, MapPin, MessageCircle, Wallet } from "lucide-react";
import { CatalogImage } from "@/components/media/catalog-image";
import { PageHeader } from "@/components/shared/page-header";
import { fasePosiblesPedidosHabilitada } from "@/lib/posibles-pedidos/configuracion";
import { contarPosiblesPedidos, listarPosiblesPedidos } from "@/lib/posibles-pedidos/administracion";
import { formatCLP } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { ActionLink } from "@/components/ui/action-link";
import { OrderListData, OrderListIdentity } from "./order-list-row";
import { PossibleOrderCreate } from "./possible-order-create";
import { PossibleOrderDisclosure } from "./possible-order-disclosure";
import { ROUTES } from "@/config/routes";

function PossibleOrdersHeader({ embedded, description }: { embedded: boolean; description?: string }) {
  if (!embedded) return <PageHeader title="Posibles pedidos" description={description} />;
  return <header className="space-y-1">
    <h2 className="text-base font-semibold tracking-tight">Posibles pedidos</h2>
    {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
  </header>;
}

const filtrosPosibles = [
  ["pendientes", "Pendientes"],
  ["convertido", "Convertidas"],
  ["descartado", "Descartadas"],
  ["todos", "Todas"],
] as const;

const estadosPosibles = {
  registrado: { etiqueta: "Pendiente", clase: "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-100" },
  en_gestion: { etiqueta: "En gestión", clase: "bg-sky-100 text-sky-950 dark:bg-sky-900 dark:text-sky-100" },
  convertido: { etiqueta: "Convertida", clase: "bg-emerald-100 text-emerald-950 dark:bg-emerald-900 dark:text-emerald-100" },
  descartado: { etiqueta: "Descartada", clase: "bg-muted text-muted-foreground" },
};

const formatoCantidad = new Intl.NumberFormat("es-CL");

function ResumenSolicitud({ solicitud }: {
  solicitud: Awaited<ReturnType<typeof listarPosiblesPedidos>>["solicitudes"][number];
}) {
  const localidad = /^Localidad: ([^\r\n]*)/.exec(solicitud.observaciones ?? "")?.[1]?.trim();
  const datos = [
    { etiqueta: "Entrega solicitada", valor: formatFechaEntregaLarga(solicitud.fecha_entrega_solicitada), Icono: CalendarDays },
    { etiqueta: "Localidad", valor: localidad || "Sin especificar", Icono: MapPin },
    { etiqueta: "Total referencial", valor: formatCLP(solicitud.total_estimado), Icono: Wallet },
  ];

  return <div className="mt-1.5 space-y-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
    <dl className="grid gap-2 @min-[36rem]:grid-cols-3">
      {datos.map(({ etiqueta, valor, Icono }) => <div key={etiqueta} className="flex min-w-0 gap-2">
        <Icono aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="min-w-0 wrap-anywhere">
          <dt className="text-xs text-muted-foreground">{etiqueta}</dt>
          <dd className="text-sm font-semibold tabular-nums">{valor}</dd>
        </div>
      </div>)}
    </dl>
    <div className="space-y-2 border-t border-primary/15 pt-2.5">
      <h3 className="text-sm font-semibold text-primary">Productos solicitados</h3>
      {solicitud.productos.length ? (
        <ul className="grid gap-2 @min-[36rem]:grid-cols-2 @min-[64rem]:grid-cols-3">
          {solicitud.productos.map((producto) => <li key={producto.id}
            className="flex min-w-0 items-center gap-2.5 rounded-md border border-border bg-card p-2">
            <div className="relative size-11 shrink-0 overflow-hidden rounded bg-muted">
              <CatalogImage image={producto.rutaImagen ? { src: producto.rutaImagen, alt: "", fit: "contain" } : undefined}
                fallback="package" sizes="44px" fallbackIconClassName="size-4 sm:size-4 opacity-50" />
            </div>
            <div className="min-w-0 flex-1 wrap-anywhere">
              <p className="text-sm font-semibold leading-tight">{producto.nombre_producto_snapshot}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{producto.nombre_presentacion_snapshot}</p>
              <p className="mt-0.5 text-xs tabular-nums">Cantidad <span className="font-medium">{formatoCantidad.format(producto.cantidad)}</span></p>
            </div>
            <p className="shrink-0 text-sm font-semibold tabular-nums text-primary">{formatCLP(producto.subtotal)}</p>
          </li>)}
        </ul>
      ) : <p className="text-sm text-muted-foreground">Sin productos solicitados.</p>}
    </div>
  </div>;
}

export async function PossibleOrdersList({ params, baseHref, embedded = false, agruparPorEntrega = false }: { params: { estado?: string; pagina?: string }; baseHref: string; embedded?: boolean; agruparPorEntrega?: boolean }) {
  const enlace = (estado: string, pagina = 1) => `${baseHref}${baseHref.includes("?") ? "&" : "?"}estado=${estado}&pagina=${pagina}`;
  const estado = filtrosPosibles.find(([valor]) => valor === params.estado)?.[0] ?? "pendientes";
  const pagina = Math.max(1,Math.min(10000,Number.parseInt(params.pagina ?? "1",10) || 1));
  if (!fasePosiblesPedidosHabilitada()) return <><PossibleOrdersHeader embedded={embedded} description="Solicitudes que requieren revisión y confirmación de Hidro Leufú." /><p className="rounded-xl border bg-card p-6 text-muted-foreground">La integración aún no está habilitada en este entorno. Los pedidos web siguen disponibles en su sección habitual.</p></>;
  let resultado;
  try { resultado = await listarPosiblesPedidos(estado,pagina); }
  catch { return <><PossibleOrdersHeader embedded={embedded} /><p role="alert" className="rounded-xl border bg-card p-6">No pudimos cargar las solicitudes. Revisa tu sesión y que la integración esté disponible en este entorno.</p></>; }
  const filtros = await Promise.all(filtrosPosibles.map(async ([valor, texto]) => ({
    valor,
    texto,
    total: estado === valor ? resultado.total : await contarPosiblesPedidos(valor).catch(() => null),
  })));

  const mostrarSolicitudes = (solicitudes: typeof resultado.solicitudes) => (
    <div className="space-y-1.5">
      {solicitudes.map(p => {
        const estadoVisual = estadosPosibles[p.estado];
        return <PossibleOrderDisclosure key={`${p.solicitud_id}:${p.id}`} tarjeta={<>
            <OrderListIdentity cliente={p.nombre_solicitante} referencia={`+${p.telefono_contacto}`} ubicacion={`Versión ${p.numero_version} de 5`} />
            <span className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-semibold ${estadoVisual.clase}`}>{estadoVisual.etiqueta}</span>
            <OrderListData solicitud={p.fecha_creacion} entrega={p.fecha_entrega_solicitada} etiquetaEntrega="Entrega solicitada" ocultarEntrega={agruparPorEntrega} importe={formatCLP(p.total_estimado)} etiquetaImporte="Total referencial" />
          </>} acciones={<>
            {(p.estado === "registrado" || p.estado === "en_gestion") && <PossibleOrderCreate id={p.id} version={p.version} compact />}
            <ActionLink href={ROUTES.adminPossibleOrder(p.id)} variant="quiet" className="gap-1">
              <ClipboardList aria-hidden="true" className="size-4" /> Gestión avanzada
            </ActionLink>
          </>}>
          <ResumenSolicitud solicitud={p} />
        </PossibleOrderDisclosure>;
      })}
    </div>
  );

  return <section className="@container space-y-2">
    <PossibleOrdersHeader embedded={embedded} description="Revisa solicitudes por WhatsApp antes de crear un pedido oficial. Registrarlas no genera cobros." />
    <nav aria-label="Estado de las solicitudes" className="flex flex-wrap gap-1.5">
      {filtros.map(({ valor, texto, total }) => <ActionLink key={valor} href={enlace(valor)} aria-current={estado === valor ? "page" : undefined}
        variant={estado === valor ? "primary" : "secondary"} className="min-h-9 gap-1 px-2.5 text-xs motion-safe:duration-200">
        {texto}{total != null && <span className="tabular-nums">({total})</span>}
      </ActionLink>)}
    </nav>
    <p className="text-xs text-muted-foreground">Página {pagina}</p>
    {!resultado.solicitudes.length ? (
      <div className="rounded-lg border border-dashed p-4 text-center">
        <MessageCircle aria-hidden="true" className="mx-auto size-5 text-muted-foreground" />
        <h3 className="mt-2 text-sm font-semibold">No hay solicitudes en este estado</h3>
        <p className="mt-1 text-sm text-muted-foreground">Las nuevas solicitudes de WhatsApp aparecerán aquí.</p>
      </div>
    ) : agruparPorEntrega ? (
      <OrderDeliveryDateGroups pedidos={resultado.solicitudes} fechaEntrega={p => p.fecha_entrega_solicitada} orden={estado === "pendientes" ? "ascendente" : "descendente"}>
        {mostrarSolicitudes}
      </OrderDeliveryDateGroups>
    ) : mostrarSolicitudes(resultado.solicitudes)}
    <nav aria-label="Páginas" className="flex justify-between gap-2">
      {pagina > 1 ? <Link href={enlace(estado, pagina - 1)} className="rounded-lg border px-3 py-2 text-sm">Anterior</Link> : <span />}
      {pagina * 25 < resultado.total && <Link href={enlace(estado, pagina + 1)} className="rounded-lg border px-3 py-2 text-sm">Siguiente</Link>}
    </nav>
  </section>;
}
