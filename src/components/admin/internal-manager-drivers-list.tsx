"use client";

import { useEffect, useRef, useState } from "react";
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
  const [open, setOpen] = useState(Boolean(initialQuery));
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const [updates, setUpdates] = useState<Record<string, Usuario & { activo: boolean; administrador: boolean }>>({});
  const [notice, setNotice] = useState("");
  const [retry, setRetry] = useState(0);
  const search = query.trim();
  const loading = search.length >= 2 && result.query !== search;
  // Conserva los cambios confirmados durante la revalidación del servidor.
  const drivers = [
    ...gestion.repartidores.map(r => updates[r.usuario_id] ?? r),
    ...Object.values(updates).filter(r => !gestion.repartidores.some(existing => existing.usuario_id === r.usuario_id)),
  ];
  const enabled = drivers.filter(r => r.activo && !r.administrador);

  function onUpdated(usuario: Usuario, activo: boolean) {
    if (resultsRef.current?.contains(document.activeElement)) resultsRef.current.focus();
    setUpdates(current => ({ ...current, [usuario.usuario_id]: { ...usuario, activo, administrador: false } }));
    setNotice(activo ? "Permiso habilitado." : "Permiso revocado.");
  }

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

  const matchesQuery = (u: Usuario) => [u.nombre, u.correo].some(value => value?.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const matches = search.length >= 2 ? enabled.filter(matchesQuery) : [];
  const candidates = [
    ...result.usuarios,
    ...Object.values(updates).filter(u => !u.activo && matchesQuery(u)),
  ];
  const users = loading || search.length < 2 || result.error ? [] : candidates.filter((u, index) =>
    !enabled.some(r => r.usuario_id === u.usuario_id) &&
    candidates.findIndex(other => other.usuario_id === u.usuario_id) === index,
  );

  return <div className="space-y-4">
    <section className="rounded-lg border border-border" aria-labelledby="buscar-repartidores-title"
      onKeyDown={event => {
        if (event.key === "Escape") { event.preventDefault(); inputRef.current?.focus(); setOpen(false); }
      }}>
      <div className="space-y-2 p-3">
        <h3 id="buscar-repartidores-title" className="text-sm font-semibold">Habilitar repartidor</h3>
        <label htmlFor="buscar-repartidores" className="block text-sm">Buscar por nombre o correo</label>
        <div className="flex items-center gap-2">
          <input ref={inputRef} id="buscar-repartidores" type="search" value={query} maxLength={100} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setOpen(true); }} onKeyDown={event => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); window.requestAnimationFrame(() => resultsRef.current?.focus()); }
          }} aria-describedby="buscar-repartidores-status" aria-controls="buscar-repartidores-resultados" placeholder="Nombre o correo del usuario" className="min-h-11 min-w-0 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring" />
          <button type="button" aria-expanded={open} aria-controls="buscar-repartidores-resultados" onClick={() => setOpen(value => !value)} className="min-h-11 shrink-0 rounded-md border px-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">{open ? "Cerrar" : "Abrir"}</button>
        </div>
        <p id="buscar-repartidores-status" role="status" className="text-xs text-muted-foreground">
          {loading ? "Buscando usuarios…" : result.error && search.length >= 2 ? "Búsqueda no disponible." : search.length < 2 ? "Escribe al menos 2 caracteres para buscar cuentas registradas." : `${matches.length + users.length} coincidencias · Hasta 30 cuentas disponibles por búsqueda.`}
        </p>
      </div>
      <div ref={resultsRef} id="buscar-repartidores-resultados" hidden={!open} role="region" aria-label="Resultados de usuarios registrados" tabIndex={0} aria-busy={loading} className="max-h-72 overflow-y-auto overscroll-contain rounded-b-lg border-t focus-visible:outline-2 focus-visible:outline-ring">
        {search.length < 2 && <p className="px-3 py-3 text-sm text-muted-foreground">Escribe al menos 2 caracteres para ver usuarios registrados.</p>}
        {loading && <p className="px-3 py-3 text-sm text-muted-foreground">Buscando usuarios…</p>}
        {!loading && result.error && search.length >= 2 ? <div role="alert" className="border-t px-3 py-2 text-sm text-destructive">{result.error} <button type="button" onClick={() => { setResult({ query: "", usuarios: [], error: "" }); setRetry(value => value + 1); }} className="min-h-11 rounded px-2 underline focus-visible:outline-2 focus-visible:outline-ring">Reintentar</button></div> : null}
        {!loading && (matches.length > 0 || users.length > 0) && <ul aria-label="Usuarios encontrados" className="divide-y divide-border">
          {matches.map(r => <li key={r.usuario_id} className="flex flex-wrap items-center gap-3 px-3 py-2"><Identity usuario={r} /><span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">Habilitado</span></li>)}
          {users.map(u => <li key={u.usuario_id} className="flex flex-wrap items-center gap-3 px-3 py-2"><Identity usuario={u} /><PermissionForm usuarios={[u]} compact onUpdated={onUpdated} /></li>)}
        </ul>}
        {!loading && !result.error && search.length >= 2 && !matches.length && !users.length && <p role="status" className="border-t px-3 py-3 text-sm text-muted-foreground">No hay usuarios que coincidan con la búsqueda.</p>}
      </div>
    </section>
    <p role="status" className="text-xs text-muted-foreground">{notice}</p>
    <section aria-labelledby="permisos-title" className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="permisos-title" className="text-sm font-semibold">Permisos de reparto</h3>
        <span className="rounded-full bg-primary/10 px-2 py-1 text-xs font-medium text-primary">{enabled.length} habilitados</span>
      </div>
      {!drivers.length ? <p role="status" className="rounded-lg border border-dashed px-3 py-4 text-sm text-muted-foreground">Todavía no hay permisos de reparto registrados.</p> :
        <ul className="divide-y divide-border rounded-lg border border-border">{drivers.map(r => <li key={r.usuario_id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <Identity usuario={r} />
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-medium ${r.activo && !r.administrador ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>{r.administrador ? "Administrador · Sin acceso de reparto" : r.activo ? "Habilitado" : "Revocado"}</span>
            {!r.administrador && <PermissionForm usuarios={[r]} activo={!r.activo} compact onUpdated={onUpdated} />}
          </div>
        </li>)}</ul>}
    </section>
  </div>;
}
