"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { EntregaVisualDialog, type ItemVistaEntrega } from "@/app/(admin)/admin/rutas/entrega-visual-dialog";
import { EntregaFallidaDialog } from "@/app/(admin)/admin/rutas/entrega-fallida-dialog";
import type { DatosVistaEntrega } from "@/app/(admin)/admin/rutas/entrega-preview";
import { cargarVistaReparto, resolverEntregaReparto, registrarFallidaReparto, type AmbitoEntregaReparto } from "./entrega-actions";

export function AccionesEntregaReparto({ ruta, fecha, asignacion, pedido, habilitada }: AmbitoEntregaReparto & {
  pedido: { id: string; numero: string; version: number; cliente: string; direccion: string | null; estado: string; productos: unknown[] };
  habilitada: boolean;
}) {
  const [datos, setDatos] = useState<DatosVistaEntrega | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fallidas = useRef(new Map<string, AmbitoEntregaReparto>());
  const acciones = useMemo(() => {
    const ambito = { ruta, fecha, asignacion };
    async function resolver(s: Parameters<typeof resolverEntregaReparto>[1], diferencias: boolean, consultar = false) {
      // La misma clave conserva también la asignación y ruta originales tras refresh.
      const almacenamiento = `entrega-ambito:${s.p_pedido_id}:${s.p_clave}`;
      let original = ambito;
      try {
        const guardado = sessionStorage.getItem(almacenamiento);
        if (guardado) original = JSON.parse(guardado);
        else if (!consultar) sessionStorage.setItem(almacenamiento, JSON.stringify(ambito));
      } catch { return { error: "No fue posible conservar la asignación del intento. Habilita el almacenamiento antes de confirmar." }; }
      return resolverEntregaReparto(original, s, diferencias, consultar);
    }
    return {
      cargar: (id: string, version: number) => cargarVistaReparto(ambito, id, version),
      confirmar: (s: Parameters<typeof resolverEntregaReparto>[1]) => resolver(s, false),
      diferencias: (s: Parameters<typeof resolverEntregaReparto>[1]) => resolver(s, true),
      recuperar: (s: Parameters<typeof resolverEntregaReparto>[1], diferencias: boolean) => resolver(s, diferencias, true),
      fallida: (s: Parameters<typeof registrarFallidaReparto>[1], confirmado: boolean) => {
        if (!fallidas.current.has(s.p_clave)) fallidas.current.set(s.p_clave, ambito);
        return registrarFallidaReparto(fallidas.current.get(s.p_clave)!, s, confirmado);
      },
    };
  }, [ruta, fecha, asignacion]);
  useEffect(() => {
    let vigente = true;
    setDatos(null); setError(null);
    if (pedido.estado !== "en_reparto") return;
    void acciones.cargar(pedido.id, pedido.version).then(r => {
      if (vigente) { setDatos(r.datos ?? null); setError(r.error ?? null); }
    }).catch(() => { if (vigente) setError("No fue posible consultar la entrega. Actualiza la ruta."); });
    return () => { vigente = false; };
  }, [acciones, pedido.id, pedido.version, pedido.estado]);
  const items: ItemVistaEntrega[] = (datos?.resumen.productos ?? []).map(p => {
    const regla = datos!.reglas.find(r => r.id === p.id)!;
    return { id: p.id, nombreProducto: p.nombre, nombrePresentacion: p.presentacion, unidad: p.unidad,
      cantidad: regla.cantidad, cantidadPreparada: p.cantidad, importeOriginal: regla.total_linea,
      importeOperativo: p.importe, modoCantidadSnapshot: regla.modo_cantidad_snapshot as ItemVistaEntrega["modoCantidadSnapshot"] };
  });
  return <div className="flex flex-wrap gap-2">
    <EntregaVisualDialog pedidoId={pedido.id} versionEsperada={pedido.version} numero={pedido.numero} cliente={pedido.cliente}
      habilitada={habilitada && !!datos} motivoBloqueo={pedido.estado === "en_reparto" ? error ?? (!datos ? "Verificando entrega y cobro…" : null) : null}
      items={items} totalReferencia={datos?.resumen.total ?? 0} acciones={acciones} />
    {pedido.estado === "en_reparto" && <EntregaFallidaDialog habilitada={habilitada} pedidoId={pedido.id}
      versionEsperada={pedido.version} numero={pedido.numero} cliente={pedido.cliente} ubicacion={pedido.direccion}
      productos={pedido.productos.length} totalReferencia={datos?.resumen.total ?? 0} ocultarReferencia={!datos} registrar={acciones.fallida} />}
  </div>;
}
