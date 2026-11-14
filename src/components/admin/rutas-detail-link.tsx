"use client";

import { createContext, useContext, useLayoutEffect, useRef, type ReactNode } from "react";
import { ActionLink } from "@/components/ui/action-link";
import { ROUTES } from "@/config/routes";

const RutasDetailContext = createContext<{ baseHref: string; guardar: () => void } | null>(null);

export function RutasDetailProvider({ baseHref, modalAbierto, children }: { baseHref: string; modalAbierto: boolean; children: ReactNode }) {
  const contenido = useRef<HTMLDivElement>(null);
  const posicion = useRef<{ x: number; y: number; foco: HTMLElement | null; elementos: { nodo: Element; x: number; y: number }[] } | null>(null);
  function guardar() {
    if (posicion.current) return;
    posicion.current = {
      x: window.scrollX, y: window.scrollY,
      foco: document.activeElement instanceof HTMLElement ? document.activeElement : null,
      elementos: Array.from(contenido.current?.querySelectorAll("*") ?? []).filter(nodo => nodo.scrollTop || nodo.scrollLeft).map(nodo => ({ nodo, x: nodo.scrollLeft, y: nodo.scrollTop })),
    };
  }
  useLayoutEffect(() => {
    if (modalAbierto || !posicion.current) return;
    const anterior = posicion.current;
    posicion.current = null;
    // Espera también la liberación del bloqueo de scroll del diálogo.
    const frame = requestAnimationFrame(() => {
      anterior.foco?.isConnected && anterior.foco.focus({ preventScroll: true });
      for (const { nodo, x, y } of anterior.elementos) if (nodo.isConnected) nodo.scrollTo({ left: x, top: y, behavior: "instant" });
      window.scrollTo({ left: anterior.x, top: anterior.y, behavior: "instant" });
    });
    return () => cancelAnimationFrame(frame);
  }, [modalAbierto]);
  return <RutasDetailContext.Provider value={{ baseHref, guardar }}><div ref={contenido}>{children}</div></RutasDetailContext.Provider>;
}

// Fuera de Rutas conserva la navegación original de las tarjetas compartidas.
export function RutasDetailLink({ tipo, id, children }: { tipo: "pedido" | "cliente"; id: string; children: ReactNode }) {
  const contexto = useContext(RutasDetailContext);
  const baseHref = contexto?.baseHref;
  const href = baseHref ? `${baseHref}&${tipo}=${encodeURIComponent(id)}` : tipo === "pedido" ? ROUTES.adminOrder(id) : ROUTES.adminCustomer(id);
  return <ActionLink href={href} scroll={baseHref ? false : undefined} prefetch={false} onNavigate={() => contexto?.guardar()} variant="secondary">{children}</ActionLink>;
}
