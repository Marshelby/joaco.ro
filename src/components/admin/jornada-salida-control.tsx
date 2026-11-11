"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { operarCargaAction } from "@/app/(admin)/admin/pedidos/carga-actions";
import type { CargaJornada } from "@/lib/admin/cargas";
import { Button } from "@/components/ui/button";

type Paso = Parameters<typeof operarCargaAction>[0];

export function JornadaSalidaControl({ fecha, carga, habilitada }: { fecha: string; carga: CargaJornada; habilitada: boolean }) {
  const router = useRouter();
  const cola = useRef<Paso[] | null>(null);
  const ejecutando = useRef(false);
  const [pendiente, iniciar] = useTransition();
  const [mensaje, setMensaje] = useState("");
  if (carga.estado === "cerrada") return <p role="status" className="text-sm">Ruta cerrada. Consulta el resumen de cierre.</p>;
  const cancelados = carga.pedidos.filter(p => p.estado === "cancelado");
  const problemas = carga.pedidos.flatMap(p => {
    if (p.estado === "cancelado") return carga.estado === "lista" && p.incluido ? [`${p.numero}: el pedido incluido está cancelado.`] : [];
    if (p.incluido === false) return [];
    if (p.estado !== "listo_despacho") return [`${p.numero}: estado ${p.estado}; debe estar listo para despacho.`];
    if (p.pendientes > 0 || p.productos.length === 0) return [`${p.numero}: faltan productos o confirmaciones de preparación.`];
    if (carga.estado === "lista" && !p.incluido) return [`${p.numero}: el pedido preparado no está incluido en la carga confirmada. Revisa la carga antes de salir.`];
    return [];
  });
  if (carga.estado === "en_ruta" && !cola.current?.length) return <p role="status" className="text-sm">Salida a ruta registrada.</p>;
  const preparados = carga.pedidos.some(p => p.estado === "listo_despacho" && p.incluido !== false);
  // La cola no depende de las props renovadas por revalidatePath: cada reintento
  // conserva exactamente el payload, la versión y la clave de la RPC pendiente.
  function salir() {
    if (ejecutando.current) return;
    if (document.querySelector('[data-preparacion-pendiente="true"]')) {
      setMensaje("Guarda o cancela los cambios pendientes antes de salir a ruta.");
      return;
    }
    if (!cola.current?.length) {
      if (!habilitada || problemas.length || !preparados) return;
      let version = carga.version;
      const paso = (accion: Paso["accion"], pedidos: Paso["pedidos"] = null): Paso => ({ fecha, version: version++, clave: crypto.randomUUID(), accion, pedidos, motivo: null });
      cola.current = carga.estado === "preparacion" ? [
        paso("guardar", [...carga.pedidos].sort((a, b) => a.id.localeCompare(b.id)).map(p => ({ id: p.id, incluido: p.estado === "listo_despacho" && p.incluido !== false, motivo: p.estado === "cancelado" ? "Pedido cancelado: no se incluye en la salida a ruta." : p.incluido === false ? p.motivo ?? "Exclusión conservada en la salida a ruta." : "" }))),
        paso("confirmar"), paso("salir"),
      ] : [paso("salir")];
    }
    ejecutando.current = true;
    iniciar(async () => {
      try {
        while (cola.current?.length) {
          const resultado = await operarCargaAction(cola.current[0]);
          if (resultado.error) {
            setMensaje(`${resultado.error} Los pasos completados se conservan. Puedes reintentar; si la jornada cambió, recarga para revisarla.`);
            return;
          }
          cola.current.shift();
        }
        cola.current = null;
        setMensaje("Salida a ruta registrada.");
        router.refresh();
      } catch {
        setMensaje("No se recibió respuesta. Reintenta Registrar salida efectiva para recuperar la operación sin duplicarla.");
      } finally { ejecutando.current = false; }
    });
  }
  return <section className="space-y-3" aria-label="Salida a ruta">
    {(preparados || Boolean(cola.current?.length)) && <Button disabled={pendiente || !habilitada || (!cola.current?.length && problemas.length > 0)} onClick={salir}>{pendiente ? "Registrando salida…" : "Registrar salida efectiva"}</Button>}
    {carga.pedidos.some(p => p.incluido === false && p.estado !== "cancelado") && <p className="text-sm">Se conservan los pedidos excluidos, incluidos los reprogramados pendientes de inclusión. <Link className="underline" href={`/admin/pedidos/entregas/${fecha}`}>Revisar e incluir explícitamente en la carga</Link>.</p>}
    {carga.pedidos.some(p => p.estado === "entrega_fallida" && p.incluido === false) && <p className="rounded-lg bg-muted p-3 text-sm">Los pedidos resueltos y excluidos no forman parte del reparto físico. Consulta su motivo en el historial.</p>}
    {cancelados.length > 0 && <p className="text-sm text-muted-foreground">No se incluyen por estar cancelados: {cancelados.map(p => p.numero).join(", ")}. El motivo queda registrado al guardar la selección.</p>}
    {problemas.length > 0 && <ul className="space-y-1 text-sm text-destructive">{problemas.map(problema => <li key={problema}>{problema}</li>)}</ul>}
    <p role="status" className="text-sm">{mensaje}</p>
  </section>;
}
