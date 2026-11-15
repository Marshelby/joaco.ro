import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/feedback/empty-state";
import { ActionLink } from "@/components/ui/action-link";
import { SupplierDialog } from "@/components/admin/supplier-dialog";
import { obtenerProveedores } from "@/lib/admin/proveedores";
import { formatCLP } from "@/lib/formatters";

export const metadata: Metadata = { title: "Proveedores" };

export default async function ProveedoresPage({ searchParams }: { searchParams: Promise<{ q?: string | string[]; pagina?: string | string[] }> }) {
  const parametros = await searchParams;
  const busqueda = typeof parametros.q === "string" ? parametros.q.replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0,120) : "";
  const numero = typeof parametros.pagina === "string" ? Number(parametros.pagina) : 1;
  const pagina = Number.isSafeInteger(numero) && numero > 0 ? Math.min(numero,100000) : 1;
  const resultado = await obtenerProveedores(busqueda, pagina).then((dato) => ({ dato, error: false as const })).catch(() => ({ dato: null, error: true as const }));
  const enlace = (p: number) => `/admin/proveedores?${new URLSearchParams({ q: busqueda, pagina: String(p) })}`;
  return <div className="space-y-8">
    <PageHeader title="Proveedores" description="Revisa los saldos pendientes y los movimientos de cada proveedor." actions={resultado.error ? undefined : <SupplierDialog />} />
    {resultado.error ? <div role="alert" className="rounded-xl border border-border bg-card p-5">No se pudieron cargar los proveedores. Si el módulo aún no está habilitado, revisa e instala manualmente supabase/manual/proveedores_administrativos.sql. Si ya está instalado, revisa la sesión, los permisos y la conexión.</div> : <>
      <form className="space-y-3 rounded-xl border border-border bg-card p-4 sm:p-5" action="/admin/proveedores">
        <label htmlFor="buscar-proveedores" className="text-sm font-medium">Buscar proveedores por nombre</label>
        <div className="flex flex-wrap gap-2"><input id="buscar-proveedores" name="q" type="search" defaultValue={busqueda} maxLength={120} placeholder="Nombre del proveedor" className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" /><button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground">Buscar</button>{busqueda ? <ActionLink href="/admin/proveedores" variant="quiet">Limpiar búsqueda</ActionLink> : null}</div>
        <p role="status" className="text-sm text-muted-foreground">{resultado.dato.total} proveedores encontrados</p>
      </form>
      {resultado.dato.proveedores.length ? <section aria-label="Proveedores" className="space-y-3">{resultado.dato.proveedores.map((p) => <article key={p.id} className="rounded-xl border border-border bg-card p-4 sm:p-5"><div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(10rem,0.65fr)_auto] sm:items-center sm:gap-5"><div className="min-w-0"><h2 className="font-semibold tracking-tight">{p.nombre}</h2><p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{p.descripcion || "Sin descripción"}</p><p className="mt-2 break-words text-sm text-muted-foreground">Teléfono: {p.telefono || "Sin teléfono"}</p><p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">Dirección: {p.direccion || "Sin dirección"}</p></div><dl className="text-sm"><dt className="text-muted-foreground">Saldo pendiente</dt><dd className="mt-1 font-semibold">{formatCLP(p.saldo_actual)}</dd></dl><SupplierDialog proveedorId={p.id} /></div></article>)}</section> : <EmptyState title={busqueda ? "Sin resultados" : "No hay proveedores en esta página"} description="Crea un proveedor o prueba otra búsqueda." />}
      {resultado.dato.total > 50 || pagina > 1 ? <nav aria-label="Paginación de proveedores" className="flex flex-wrap items-center gap-3">{pagina > 1 ? <ActionLink href={enlace(pagina-1)} variant="quiet">Anterior</ActionLink> : null}<span className="text-sm text-muted-foreground">Página {pagina} de {Math.max(1,Math.ceil(resultado.dato.total/50))}</span>{pagina*50 < resultado.dato.total ? <ActionLink href={enlace(pagina+1)} variant="quiet">Siguiente</ActionLink> : null}</nav> : null}
    </>}
  </div>;
}
