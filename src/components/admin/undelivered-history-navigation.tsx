"use client";

import { destinoNoEntregados } from "@/lib/admin/undelivered-return";
import { useEffect, useRef, useState } from "react";
import { actionLinkVariants } from "@/components/ui/action-link";

const storageKey = "admin:no-entregados:historial";
const listado = "/admin/pedidos?filtro=no-entregados";

export function UndeliveredHistoryLink({ pedidoId, retorno }: { pedidoId: string; retorno: string }) {
  const [destino, setDestino] = useState(retorno);
  useEffect(() => {
    const actual = destinoNoEntregados(`${window.location.pathname}${window.location.search}`);
    if (actual) setDestino(actual);
  }, []);
  return <a className={actionLinkVariants({ variant: "quiet" })}
    href={`/admin/pedidos/${pedidoId}/historial?volver=${encodeURIComponent(destino)}`}
    onClick={(event) => {
      const url = destinoNoEntregados(`${window.location.pathname}${window.location.search}`) ?? listado;
      const section = event.currentTarget.closest("section");
      try {
        sessionStorage.setItem(storageKey, JSON.stringify({ url, y: window.scrollY,
          abiertos: Array.from(section?.querySelectorAll("details") ?? []).flatMap((d, i) => d.open ? [i] : []) }));
      } catch { /* La navegación sigue disponible si el almacenamiento está bloqueado. */ }
      event.currentTarget.href = `/admin/pedidos/${pedidoId}/historial?volver=${encodeURIComponent(url)}`;
    }}>Historial operativo</a>;
}

export function UndeliveredScrollRestoration() {
  const marcador = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    let frame = 0;
    let observer: ResizeObserver | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const guardado = sessionStorage.getItem(storageKey);
      if (!guardado) return;
      const posicion = JSON.parse(guardado) as { url: string; y: number; abiertos?: number[] };
      if (posicion.url !== `${window.location.pathname}${window.location.search}` || !Number.isFinite(posicion.y)) return;
      sessionStorage.removeItem(storageKey);
      const section = marcador.current?.closest("section");
      section?.querySelectorAll("details").forEach((d, i) => { d.open = posicion.abiertos?.includes(i) ?? false; });
      const restaurar = () => { window.scrollTo({ top: Math.max(0, posicion.y), behavior: "instant" }); };
      frame = requestAnimationFrame(() => {
        restaurar();
        if (section) {
          observer = new ResizeObserver(restaurar);
          observer.observe(section);
          timer = setTimeout(() => observer?.disconnect(), 1500);
        }
      });
    } catch { /* El historial del navegador conserva su restauración nativa. */ }
    return () => { cancelAnimationFrame(frame); observer?.disconnect(); if (timer) clearTimeout(timer); };
  }, []);
  return <span ref={marcador} hidden />;
}
