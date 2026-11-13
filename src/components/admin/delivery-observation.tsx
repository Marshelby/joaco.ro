import type { ContextoEntrega } from "@/lib/admin/entrega-contexto";
import { formatDateTimeCL } from "@/lib/formatters";

export function DeliveryObservation({ contexto }: { contexto: ContextoEntrega }) {
  if (!contexto.disponible) return <p className="text-xs text-muted-foreground">Observaciones y detalle histórico de entrega no disponibles: falta instalar el SQL manual.</p>;
  if (!contexto.observacion) return null;
  const o = contexto.observacion;
  return <section className="space-y-1 rounded-lg border border-border p-3 text-sm"><h3 className="font-semibold">Observaciones de entrega</h3><p className="whitespace-pre-wrap break-words">{o.texto}</p><p className="text-xs text-muted-foreground">{o.autor} · {formatDateTimeCL(o.fecha)}</p></section>;
}
