"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Search } from "lucide-react";
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
  return <section aria-label="Buscar clientes" className="ml-auto w-full max-w-sm space-y-1">
    <label htmlFor="buscar-clientes" className="sr-only">Buscar clientes</label>
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-3 my-auto size-4 text-muted-foreground" />
        <input id="buscar-clientes" type="search" value={valor} maxLength={120}
          onChange={(evento) => { editando.current = true; setValor(evento.target.value); }}
          placeholder="Nombre, teléfono o correo" autoComplete="off"
          aria-controls="resultados-clientes" aria-describedby="estado-busqueda-clientes"
          className="h-9 w-full min-w-0 rounded-lg border border-border bg-background pr-2 pl-9 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50" />
      </div>
      {valor || busqueda ? <Button type="button" variant="outline" aria-label="Limpiar búsqueda" className="h-9 px-2.5" onClick={() => {
        editando.current = true;
        setValor("");
        document.getElementById("buscar-clientes")?.focus();
      }}>Limpiar</Button> : null}
    </div>
    <p id="estado-busqueda-clientes" role="status" aria-live="polite" className="text-right text-xs text-muted-foreground tabular-nums">
      {cargando ? "Buscando clientes…" : `${total} ${total === 1 ? "cliente encontrado" : "clientes encontrados"}`}
    </p>
  </section>;
}
