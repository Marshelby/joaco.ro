import type { Metadata } from "next";
import { Search } from "lucide-react";
import { tonoJornada } from "@/components/admin/jornada-colores";
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
  return <div className="space-y-4">
    <PageHeader title="Proveedores" className="gap-3 pb-4" description="Revisa los saldos y los movimientos de cada proveedor." actions={resultado.error ? undefined : <SupplierDialog />} />
    {resultado.error ? <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/5 p-3 text-sm text-destructive">No se pudieron cargar los proveedores. Si el módulo aún no está habilitado, revisa e instala manualmente supabase/manual/proveedores_administrativos.sql. Si ya está instalado, revisa la sesión, los permisos y la conexión.</div> : <>
      <form className="grid gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-x-3" action="/admin/proveedores">
        <div className="min-w-0 space-y-1">
          <label htmlFor="buscar-proveedores" className="block text-sm font-medium">Buscar proveedores por nombre</label>
          <div className="relative">
            <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id="buscar-proveedores" name="q" type="search" defaultValue={busqueda} maxLength={120} placeholder="Nombre del proveedor" className="h-11 w-full min-w-0 rounded-lg border border-border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="min-h-11 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50">Buscar</button>
          {busqueda ? <ActionLink href="/admin/proveedores" variant="quiet">Limpiar búsqueda</ActionLink> : null}
        </div>
        <p role="status" className="text-xs text-muted-foreground sm:col-span-2">{resultado.dato.total} proveedores encontrados</p>
      </form>
      {resultado.dato.proveedores.length ? (
        <section aria-label="Proveedores" className="space-y-2">
          {resultado.dato.proveedores.map((p) => (
            <article key={p.id} className="grid min-w-0 gap-2 rounded-xl border border-border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_minmax(8rem,0.45fr)_auto] sm:items-center sm:gap-3">
              <div className="min-w-0 space-y-1 wrap-anywhere">
                <h2 className="font-semibold tracking-tight">{p.nombre}</h2>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{p.descripcion || "Sin descripción"}</p>
                <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                  <p>Teléfono: {p.telefono || "Sin teléfono"}</p>
                  <p className="whitespace-pre-wrap">Dirección: {p.direccion || "Sin dirección"}</p>
                </div>
              </div>
              <dl className={`rounded-lg border px-3 py-2 wrap-anywhere ${p.saldo_actual > 0 ? tonoJornada.incidencia : tonoJornada.completado}`}>
                <dt className="text-xs font-medium">Saldo vigente</dt>
                <dd>
                  <span className="block text-sm font-semibold tabular-nums">{formatCLP(p.saldo_actual)}</span>
                  <span className="block text-xs">{p.saldo_actual > 0 ? "Le debemos" : p.saldo_actual < 0 ? "Nos debe" : "Cuenta al día"}</span>
                </dd>
              </dl>
              <SupplierDialog proveedorId={p.id} />
            </article>
          ))}
        </section>
      ) : <EmptyState title={busqueda ? "Sin resultados" : "No hay proveedores en esta página"} description="Crea un proveedor o prueba otra búsqueda." />}
      {resultado.dato.total > 50 || pagina > 1 ? <nav aria-label="Paginación de proveedores" className="flex flex-wrap items-center gap-3">{pagina > 1 ? <ActionLink href={enlace(pagina-1)} variant="quiet">Anterior</ActionLink> : null}<span className="text-sm text-muted-foreground">Página {pagina} de {Math.max(1,Math.ceil(resultado.dato.total/50))}</span>{pagina*50 < resultado.dato.total ? <ActionLink href={enlace(pagina+1)} variant="quiet">Siguiente</ActionLink> : null}</nav> : null}
    </>}
  </div>;
}
