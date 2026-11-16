"use client";

import { useEffect, useState } from "react";
import { PermissionForm } from "@/app/(admin)/admin/repartidores/permission-form";
import { buscarUsuariosReparto } from "./internal-manager-drivers-search";

type Usuario = { usuario_id: string; nombre: string | null; correo: string | null };
export type DriverManagement = {
  repartidores: (Usuario & { activo: boolean; administrador: boolean })[];
  usuarios: Usuario[];
};

function Identity({ usuario }: { usuario: Usuario }) {
  return <div className="min-w-0 flex-1">
    <p className="break-words text-sm font-medium">{usuario.nombre || "Sin nombre registrado"}</p>
    <p className="break-all text-xs text-muted-foreground">{usuario.correo || "Sin correo registrado"}</p>
  </div>;
}

export function InternalManagerDriversList({ gestion, initialQuery }: { gestion: DriverManagement; initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [result, setResult] = useState({ query: initialQuery, usuarios: gestion.usuarios, error: "" });
  const [retry, setRetry] = useState(0);
  const search = query.trim();
  const loading = search.length >= 2 && result.query !== search;
  const enabled = gestion.repartidores.filter(r => r.activo && !r.administrador);

  useEffect(() => {
    if (search.length < 2) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const response = await buscarUsuariosReparto(search);
        if (!cancelled) setResult({ query: search, usuarios: response.usuarios ?? [], error: response.error ?? "" });
      } catch {
        if (!cancelled) setResult({ query: search, usuarios: [], error: "No se pudo buscar usuarios. Revisa tu conexión e intenta nuevamente." });
      }
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [search, retry]);

  const matches = search ? enabled.filter(r => [r.nombre, r.correo].some(value => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase()))) : [];
  const users = loading || search.length < 2 || result.error ? [] : result.usuarios.filter(u => !matches.some(r => r.usuario_id === u.usuario_id));

  return <div className="space-y-4">
    <section className="rounded-lg border border-border" aria-labelledby="buscar-repartidores-title">
      <div className="space-y-2 p-3">
        <h3 id="buscar-repartidores-title" className="text-sm font-semibold">Habilitar repartidor</h3>
        <label htmlFor="buscar-repartidores" className="block text-sm">Buscar por nombre o correo</label>
        <input id="buscar-repartidores" type="search" value={query} maxLength={100} onChange={event => setQuery(event.target.value)} aria-describedby="buscar-repartidores-status" aria-controls="buscar-repartidores-resultados" placeholder="Nombre o correo del usuario" className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
        <p id="buscar-repartidores-status" role="status" className="text-xs text-muted-foreground">
          {loading ? "Buscando usuarios…" : result.error && search.length >= 2 ? "Búsqueda no disponible." : search.length < 2 ? "Escribe al menos 2 caracteres para buscar cuentas registradas." : `${matches.length + users.length} coincidencias · Hasta 30 cuentas disponibles por búsqueda.`}
        </p>
      </div>
      <div id="buscar-repartidores-resultados" aria-busy={loading}>
        {!loading && result.error && search.length >= 2 ? <div role="alert" className="border-t px-3 py-2 text-sm text-destructive">{result.error} <button type="button" onClick={() => { setResult({ query: "", usuarios: [], error: "" }); setRetry(value => value + 1); }} className="min-h-11 rounded px-2 underline focus-visible:outline-2 focus-visible:outline-ring">Reintentar</button></div> : null}
        {!loading && (matches.length > 0 || users.length > 0) && <ul aria-label="Usuarios encontrados" tabIndex={0} className="max-h-72 overflow-y-auto overscroll-contain border-t divide-y divide-border rounded-b-lg focus-visible:outline-2 focus-visible:outline-ring">
          {matches.map(r => <li key={r.usuario_id} className="flex flex-wrap items-center gap-3 px-3 py-2"><Identity usuario={r} /><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Ya habilitado</span></li>)}
          {users.map(u => <li key={u.usuario_id} className="flex flex-wrap items-center gap-3 px-3 py-2"><Identity usuario={u} /><PermissionForm usuarios={[u]} compact /></li>)}
        </ul>}
        {!loading && !result.error && search.length >= 2 && !matches.length && !users.length && <p role="status" className="border-t px-3 py-3 text-sm text-muted-foreground">No hay usuarios que coincidan con la búsqueda.</p>}
      </div>
    </section>
    <section aria-labelledby="permisos-title" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="permisos-title" className="text-sm font-semibold">Permisos de reparto</h3>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{enabled.length} habilitados</span>
      </div>
      {!gestion.repartidores.length ? <p role="status" className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Todavía no hay permisos de reparto registrados.</p> :
        <ul className="divide-y divide-border rounded-lg border border-border">{gestion.repartidores.map(r => <li key={r.usuario_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <Identity usuario={r} />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${r.activo && !r.administrador ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.administrador ? "Administrador · Sin acceso de reparto" : r.activo ? "Habilitado" : "Revocado"}</span>
            {!r.administrador && <PermissionForm usuarios={[r]} activo={!r.activo} compact />}
          </div>
        </li>)}</ul>}
    </section>
  </div>;
}
