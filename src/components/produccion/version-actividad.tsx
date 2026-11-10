import { etiquetasActividad, registroVisible, type VersionActividad } from "@/lib/produccion/actividades";
import { IdentidadUnidad } from "./identidad";
import { nombreCultivo } from "@/lib/produccion/cultivos";
import { fechaVisible } from "@/lib/produccion/contrato";
export function VersionActividadDetalle({ version: v }: { version: VersionActividad }) {
  return <div className="min-w-0 space-y-3 text-sm">
    <div className="flex flex-wrap items-center gap-2"><IdentidadUnidad tipo={v.tipo_unidad} cultivo={v.cultivo} /><h3 className="text-lg font-semibold">{etiquetasActividad[v.tipo_actividad]}{v.tipo_unidad === "meson" ? ` · ${nombreCultivo(v.cultivo)}` : ""}</h3><span className={`rounded-full border px-3 py-1 text-xs font-semibold ${v.evento === "anulacion" ? "border-destructive/40 text-destructive" : "bg-muted"}`}>Versión {v.numero_version} · {v.evento === "anulacion" ? "Anulada · sin efecto" : v.evento === "correccion" ? "Corrección" : "Registro original"}</span></div>
    <dl className="grid gap-3 sm:grid-cols-2"><div><dt className="text-muted-foreground">Fecha operativa</dt><dd>{fechaVisible(v.fecha_operativa)}</dd></div><div><dt className="text-muted-foreground">Cantidad y unidad</dt><dd>{v.cantidad === null ? "Sin cantidad" : `${Number(v.cantidad).toLocaleString("es-CL", { maximumFractionDigits: 12 })} ${v.unidad_medida}`}</dd></div>
      {v.tipo_actividad === "compra_alimento" && <div><dt className="text-muted-foreground">Precio total CLP</dt><dd>{v.precio_total === undefined ? "No disponible en esta versión histórica" : `$${v.precio_total.toLocaleString("es-CL", { maximumFractionDigits: 2 })} CLP`}</dd></div>}
      <div><dt className="text-muted-foreground">Fecha de registro · Santiago</dt><dd>{registroVisible(v.fecha_registro)}</dd></div><div className="min-w-0"><dt className="text-muted-foreground">Autor · identificador histórico</dt><dd className="break-all">{v.autor_id}</dd></div>
      <div className="sm:col-span-2"><dt className="text-muted-foreground">Observaciones</dt><dd className="whitespace-pre-wrap break-words">{v.observaciones || "Sin observaciones"}</dd></div>{v.motivo && <div className="sm:col-span-2"><dt className="text-muted-foreground">Motivo del cambio</dt><dd className="whitespace-pre-wrap break-words">{v.motivo}</dd></div>}
    </dl>
  </div>;
}
