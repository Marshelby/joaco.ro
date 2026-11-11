import { cerrarSesion } from "@/app/iniciar-sesion/actions";
import { exigirRepartidor } from "@/lib/reparto/server";
import { RepartoMovil, type Jornada } from "./reparto-movil";
export default async function RepartoPage() {
  const db = await exigirRepartidor();
  const { data, error } = await db.rpc("leer_mi_reparto");
  return <main id="main-content" className="mx-auto w-full max-w-xl space-y-5 p-4 pb-16">
    <div className="flex items-center justify-between gap-4"><h1 className="text-2xl font-bold">Mi reparto</h1><form action={cerrarSesion}><button className="min-h-12 px-3 underline">Cerrar sesión</button></form></div>
    <p className="text-sm text-muted-foreground">Confirma únicamente pedidos entregados completos. Las diferencias y los cobros requieren gestión administrativa.</p>
    {error || !Array.isArray(data) ? <p role="alert">No se pudieron consultar tus rutas. Actualiza la página o contacta a administración.</p> : null}
    <RepartoMovil jornadas={Array.isArray(data) ? data as Jornada[] : []} consultaFallida={!!error || !Array.isArray(data)} />
  </main>;
}
