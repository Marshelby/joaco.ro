import type { Metadata } from "next";
import Link from "next/link";
import { MessageCircle, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { fasePosiblesPedidosHabilitada } from "@/lib/posibles-pedidos/configuracion";
import { listarPosiblesPedidos } from "@/lib/posibles-pedidos/administracion";
import { formatCLP } from "@/lib/formatters";
import { formatFechaEntregaLarga } from "@/lib/delivery-date";
import { ROUTES } from "@/config/routes";
export const metadata: Metadata = { title: "Posibles pedidos", robots: { index: false, follow: false } };
export default async function PosiblesPedidosPage({ searchParams }: { searchParams: Promise<{ estado?: string; pagina?: string }> }) {
  const params = await searchParams;
  const estado = ["pendientes","convertido","descartado","todos"].includes(params.estado ?? "") ? params.estado! : "pendientes";
  const pagina = Math.max(1,Math.min(10000,Number.parseInt(params.pagina ?? "1",10) || 1));
  if (!fasePosiblesPedidosHabilitada()) return <><PageHeader title="Posibles pedidos" description="Solicitudes que requieren revisión y confirmación de Hidro Leufú." /><p className="rounded-xl border bg-card p-6 text-muted-foreground">La integración aún no está habilitada en este entorno. Los pedidos web siguen disponibles en su sección habitual.</p></>;
  let resultado;
  try { resultado = await listarPosiblesPedidos(estado,pagina); }
  catch { return <><PageHeader title="Posibles pedidos" /><p role="alert" className="rounded-xl border bg-card p-6">No pudimos cargar las solicitudes. Revisa tu sesión y que la integración esté disponible en este entorno.</p></>; }
  return <>
    <PageHeader title="Posibles pedidos" eyebrow="Ventas por conversación" description="Revisa solicitudes por WhatsApp antes de crear un pedido oficial. Registrarlas no genera cobros." />
    <nav aria-label="Estado de las solicitudes" className="flex flex-wrap gap-2">{[["pendientes","Pendientes"],["convertido","Convertidas"],["descartado","Descartadas"],["todos","Todas"]].map(([valor,texto]) => <Link key={valor} href={`${ROUTES.adminPossibleOrders}?estado=${valor}`} aria-current={estado===valor ? "page" : undefined} className={`rounded-full border px-4 py-2.5 text-sm font-medium ${estado===valor ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card hover:bg-muted"}`}>{texto}</Link>)}</nav>
    <p className="text-sm text-muted-foreground">{resultado.total} solicitudes · Página {pagina}</p>
    {!resultado.solicitudes.length ? <div className="rounded-2xl border border-dashed p-10 text-center"><MessageCircle aria-hidden="true" className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-lg font-semibold">No hay solicitudes en este estado</h2><p className="mt-2 text-sm text-muted-foreground">Las nuevas solicitudes de WhatsApp aparecerán aquí.</p></div> : <div className="grid gap-3">{resultado.solicitudes.map((p) => <Link key={p.id} href={ROUTES.adminPossibleOrder(p.id)} className="group grid gap-4 rounded-2xl border border-border bg-card p-5 transition-colors hover:border-primary/40 sm:grid-cols-[minmax(0,1fr)_auto] focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"><div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="font-semibold">{p.nombre_solicitante}</h2><span className={`rounded-full px-2.5 py-1 text-xs font-medium ${p.estado==='convertido' ? 'bg-primary/10 text-primary' : p.estado==='descartado' ? 'bg-muted text-muted-foreground' : 'bg-amber-50 text-amber-950'}`}>{({ registrado: "Pendiente", en_gestion: "En gestión", convertido: "Convertida", descartado: "Descartada" })[p.estado]}</span></div><p className="mt-2 text-sm text-muted-foreground">+{p.telefono_contacto} · {formatFechaEntregaLarga(p.fecha_entrega_solicitada)}</p><p className="mt-2 truncate font-mono text-xs text-muted-foreground">{p.codigo_publico}</p></div><div className="flex items-center gap-4 sm:justify-end"><div><p className="text-lg font-semibold">{formatCLP(p.total_estimado)}</p><p className="text-xs text-muted-foreground">Total referencial · v{p.version}</p></div><ArrowUpRight aria-hidden="true" className="size-5 text-muted-foreground group-hover:text-primary" /></div></Link>)}</div>}
    <nav aria-label="Páginas" className="flex justify-between gap-3">{pagina>1 ? <Link href={`?estado=${estado}&pagina=${pagina-1}`} className="rounded-lg border px-4 py-3 text-sm">Anterior</Link> : <span />}{pagina*25<resultado.total ? <Link href={`?estado=${estado}&pagina=${pagina+1}`} className="rounded-lg border px-4 py-3 text-sm">Siguiente</Link> : null}</nav>
  </>;
}
