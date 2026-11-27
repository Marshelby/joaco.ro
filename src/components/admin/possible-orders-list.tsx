import { OrderDeliveryDateGroups } from "@/components/admin/order-delivery-date-groups";
import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { fasePosiblesPedidosHabilitada } from "@/lib/posibles-pedidos/configuracion";
import { contarPosiblesPedidos, listarPosiblesPedidos } from "@/lib/posibles-pedidos/administracion";
import { formatCLP } from "@/lib/formatters";
import { ActionLink } from "@/components/ui/action-link";
import { accionesPedido, filaPedido, OrderListData, OrderListIdentity, tarjetaPedido } from "./order-list-row";
import { PossibleOrderCreate } from "./possible-order-create";
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
        return <article key={p.solicitud_id} className={`${tarjetaPedido} ${filaPedido}`}>
          <OrderListIdentity cliente={p.nombre_solicitante} referencia={`+${p.telefono_contacto}`} ubicacion={`Versión ${p.numero_version} de 5`} />
          <span className={`justify-self-start rounded-full px-2 py-0.5 text-xs font-semibold ${estadoVisual.clase}`}>{estadoVisual.etiqueta}</span>
          <OrderListData solicitud={p.fecha_creacion} entrega={p.fecha_entrega_solicitada} etiquetaEntrega="Entrega solicitada" ocultarEntrega={agruparPorEntrega} importe={formatCLP(p.total_estimado)} etiquetaImporte="Total referencial" />
          <div className={accionesPedido}>
            {(p.estado === "registrado" || p.estado === "en_gestion") && <PossibleOrderCreate id={p.id} version={p.version} compact />}
            <ActionLink href={ROUTES.adminPossibleOrder(p.id)} variant="quiet">Ver solicitud</ActionLink>
          </div>
        </article>;
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
