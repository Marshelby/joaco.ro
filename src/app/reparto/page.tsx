import Link from "next/link";
import { cerrarSesion } from "@/app/iniciar-sesion/actions";
import { exigirRepartidor } from "@/lib/reparto/server";
import { RepartoMovil, type Jornada } from "./reparto-movil";
export default async function RepartoPage() {
  const db = await exigirRepartidor();
  const { data, error } = await db.rpc("leer_mi_reparto");
  const jornadas = Array.isArray(data) ? data as Jornada[] : [];
  const coordenadas = jornadas.length ? await db.rpc("leer_coordenadas_mi_reparto") : null;
  const puntos = new Map<string, { latitude: number | null; longitude: number | null }>();
  if (Array.isArray(coordenadas?.data)) for (const punto of coordenadas.data) {
    if (typeof punto.id === "string") puntos.set(punto.id, {
      latitude: punto.latitude == null ? null : Number(punto.latitude),
      longitude: punto.longitude == null ? null : Number(punto.longitude),
    });
  }
  // No enviar importes u otros campos nuevos de la RPC al navegador.
  const visibles: Jornada[] = jornadas.map(j => ({
    ruta: j.ruta, nombre: j.nombre, fecha: j.fecha, asignacion: j.asignacion, estado: j.estado,
    pedidos: j.pedidos.map(p => ({
      id: p.id, numero: p.numero, cliente: p.cliente, direccion: p.direccion, telefono: p.telefono,
      referencia: p.referencia, preparacion: p.preparacion, estado: p.estado, version: p.version, posicion: p.posicion,
      ...puntos.get(p.id),
      productos: p.productos.map(i => ({ nombre: i.nombre, cantidad: i.cantidad, solicitada: i.solicitada, faltante: i.faltante, enviada: i.enviada, unidad: i.unidad })),
    })),
  }));
  return <main id="main-content" className="mx-auto w-full max-w-7xl space-y-5 p-4 pb-16">
    <Link href="/mi-cuenta" prefetch={false} className="inline-flex min-h-11 items-center rounded-lg text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">← Volver a Mi cuenta</Link>
    <div className="flex items-center justify-between gap-4"><h1 className="text-2xl font-bold">Mi reparto</h1><form action={cerrarSesion}><button className="min-h-12 px-3 underline">Cerrar sesión</button></form></div>
    <p className="text-sm text-muted-foreground">Confirma únicamente la entrega efectiva de todos los productos preparados. El ticket Listo indica preparación. Las diferencias y los cobros requieren gestión administrativa.</p>
    {error || !Array.isArray(data) ? <p role="alert">No se pudieron consultar tus rutas. Actualiza la página o contacta a administración.</p> : null}
    {coordenadas?.error ? <p role="status" className="rounded-lg border p-3 text-sm">No se pudieron consultar las coordenadas de tus paradas. Puedes consultar los datos de entrega; el mapa requiere el contrato de coordenadas autorizado.</p> : null}
    <RepartoMovil jornadas={visibles} consultaFallida={!!error || !Array.isArray(data)} />
  </main>;
}
