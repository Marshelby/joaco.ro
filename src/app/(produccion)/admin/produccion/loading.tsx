import { Sprout } from "lucide-react";
export default function CargandoProduccion() {
  return <div role="status" className="prod-location-card flex items-center gap-4 p-6"><span className="prod-icon prod-tone-lechuga"><Sprout size={24} aria-hidden="true" /></span><div><p className="font-semibold">Cargando producción…</p><p className="mt-1 text-sm text-muted-foreground">Preparando tus espacios de trabajo.</p></div></div>;
}
