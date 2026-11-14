"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useRef, useState, useTransition, type ComponentProps, type ReactNode } from "react";

type Destino = { fecha: string; ruta: string };
type Intencion = Destino & { listado: boolean };
const SeleccionListado = createContext(0);
export function useSeleccionListado() { return useContext(SeleccionListado); }
const Navegacion = createContext<(href: string, listado?: boolean) => void>(() => {});

export function RutasNavigation({ fecha, ruta, children }: Destino & { children: ReactNode }) {
  const router = useRouter();
  const contenido = useRef<HTMLDivElement>(null);
  const [destino, setDestino] = useState<Intencion | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  const [seleccionListado, setSeleccionListado] = useState(0);

  function navegar(href: string, listado = false) {
    if (listado) setSeleccionListado(n => n + 1);
    const url = new URL(href, window.location.origin);
    setDestino({ listado, fecha: url.searchParams.get("fecha") ?? fecha, ruta: url.searchParams.get("ruta") ?? "" });
    iniciarTransicion(() => {
      if (url.href === window.location.href) router.refresh();
      else router.push(`${url.pathname}${url.search}`, { scroll: false });
    });
  }

  // Solo una intención explícita desplaza: no la carga inicial ni los refresh operativos.
  useEffect(() => {
    if (!destino || pendiente || destino.fecha !== fecha || destino.ruta !== ruta) return;
    // Espera el contenido del servidor y el cambio a la vista de pedidos.
    let segundoFrame = 0;
    const frame = requestAnimationFrame(() => {
      segundoFrame = requestAnimationFrame(() => {
        const encabezado = contenido.current?.querySelector<HTMLElement>(
          destino.listado ? '[data-rutas-destino="pedidos"]' : destino.ruta ? '[data-rutas-destino="ruta"]' : '[data-rutas-destino="fecha"]',
        ) ?? contenido.current?.querySelector<HTMLElement>('[data-rutas-destino="fecha"]');
        const margen = encabezado ? parseFloat(getComputedStyle(encabezado).scrollMarginTop) || 0 : 0;
        if (encabezado && (!destino.listado || encabezado.getBoundingClientRect().top > margen)) encabezado.scrollIntoView({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
          block: "start",
        });
        setDestino(null);
      });
    });
    return () => { cancelAnimationFrame(frame); cancelAnimationFrame(segundoFrame); };
  }, [destino, pendiente, fecha, ruta]);

  // Atrás/adelante conserva la restauración de scroll del navegador.
  useEffect(() => {
    const cancelar = () => setDestino(null);
    window.addEventListener("popstate", cancelar);
    return () => window.removeEventListener("popstate", cancelar);
  }, []);

  return <Navegacion.Provider value={navegar}><SeleccionListado.Provider value={seleccionListado}><div ref={contenido}>{children}</div></SeleccionListado.Provider></Navegacion.Provider>;
}

export function RutasLink({ href, destinoListado = false, ...props }: Omit<ComponentProps<typeof Link>, "href" | "onNavigate" | "scroll"> & { href: string; destinoListado?: boolean }) {
  const navegar = useContext(Navegacion);
  return <Link {...props} href={href} scroll={false} onNavigate={event => { event.preventDefault(); navegar(href, destinoListado); }} />;
}

export function RutasFechaForm({ children, ...props }: Omit<ComponentProps<"form">, "action" | "onSubmit" | "onChange">) {
  const navegar = useContext(Navegacion);
  function consultar(form: HTMLFormElement) {
    if (!form.reportValidity()) return;
    const fecha = new FormData(form).get("fecha");
    if (typeof fecha === "string" && fecha) navegar(`/admin/rutas?${new URLSearchParams({ fecha })}`);
  }
  return <form {...props} action="/admin/rutas" onSubmit={event => {
    event.preventDefault(); consultar(event.currentTarget);
  }} onChange={event => {
    if (event.target instanceof HTMLInputElement && event.target.name === "fecha" && event.target.validity.valid) consultar(event.currentTarget);
  }}>{children}</form>;
}
