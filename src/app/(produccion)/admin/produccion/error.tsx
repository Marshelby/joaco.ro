"use client";
import { Sprout } from "lucide-react";
export default function ErrorProduccion({ reset }: { reset: () => void }) {
  return <div role="alert" className="prod-location-card space-y-4 p-6"><span className="prod-icon prod-tone-lechuga"><Sprout size={24} aria-hidden="true" /></span><div><p className="prod-eyebrow">Producción · Hidro Leufú</p><h1 className="text-xl font-semibold">No pudimos cargar Producción</h1></div><p className="max-w-xl text-sm leading-relaxed text-muted-foreground">Revisa tu conexión e intenta nuevamente. Si el problema continúa, verifica el acceso administrativo y la disponibilidad de la base de datos.</p><button onClick={reset} className="prod-button prod-button-primary">Reintentar</button></div>;
}
