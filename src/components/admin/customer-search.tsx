"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function CustomerSearch({ busqueda, total }: { busqueda: string; total: number }) {
  const router = useRouter();
  const [valor, setValor] = useState(busqueda);
  const [pendiente, iniciar] = useTransition();
  const ultimaBusqueda = useRef(busqueda);
  const editando = useRef(false);

  useEffect(() => {
    if (!editando.current) {
      setValor(busqueda);
      ultimaBusqueda.current = busqueda;
    } else if (busqueda === ultimaBusqueda.current) {
      editando.current = false;
    }
  }, [busqueda]);

  useEffect(() => {
    const termino = valor.trim();
    if (termino === ultimaBusqueda.current) return;
    const temporizador = setTimeout(() => {
      ultimaBusqueda.current = termino;
      const parametros = new URLSearchParams();
      if (termino) parametros.set("q", termino);
      iniciar(() => router.replace(`/admin/clientes${termino ? `?${parametros}` : ""}`, { scroll: false }));
    }, 350);
    return () => clearTimeout(temporizador);
  }, [valor, router]);

  const cargando = pendiente || valor.trim() !== busqueda;
  return <section aria-label="Buscar clientes" className="space-y-2 rounded-xl border border-border bg-card p-4 sm:p-5">
    <label htmlFor="buscar-clientes" className="text-sm font-medium text-foreground">Buscar clientes</label>
    <div className="flex flex-col gap-2 sm:flex-row">
      <input id="buscar-clientes" type="search" value={valor} maxLength={120}
        onChange={(evento) => { editando.current = true; setValor(evento.target.value); }}
        placeholder="Nombre, teléfono o correo electrónico" autoComplete="off"
        aria-controls="resultados-clientes" aria-describedby="estado-busqueda-clientes"
        className="h-11 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      {valor || busqueda ? <Button type="button" variant="outline" onClick={() => {
        editando.current = true;
        setValor("");
        document.getElementById("buscar-clientes")?.focus();
      }}>Limpiar búsqueda</Button> : null}
    </div>
    <p id="estado-busqueda-clientes" role="status" aria-live="polite" className="text-sm text-muted-foreground">
      {cargando ? "Buscando clientes…" : `${total} ${total === 1 ? "cliente encontrado" : "clientes encontrados"}`}
    </p>
  </section>;
}
